import { supabase } from './supabase'

// ─── Helpers ──────────────────────────────────────────────────
const hoyISO = () => new Date().toISOString().split('T')[0]

/** Inicio y fin del día en ISO para filtros de TIMESTAMPTZ */
function rangodia(fecha) {
  return {
    desde: `${fecha}T00:00:00`,
    hasta: `${fecha}T23:59:59`,
  }
}

// ─── Catálogo + stock ─────────────────────────────────────────

/**
 * Busca productos activos por nombre (ilike) y devuelve
 * el stock disponible en la ubicación indicada.
 *
 * @param {string} q          Texto a buscar (puede ser vacío)
 * @param {string} ubicacion  'punto_a' | 'punto_b'
 */
export async function buscarProductos(q, ubicacion) {
  let query = supabase
    .from('productos')
    .select('id, nombre, categoria, precio_venta, unidad_venta')
    .eq('activo', true)
    .order('nombre')
    .limit(30)

  if (q && q.trim()) query = query.ilike('nombre', `%${q.trim()}%`)

  const { data: productos, error } = await query
  if (error) throw error
  if (!productos.length) return []

  const ids = productos.map(p => p.id)
  const { data: stocks } = await supabase
    .from('inventario')
    .select('producto_id, cantidad')
    .in('producto_id', ids)
    .eq('ubicacion', ubicacion)

  const stockMap = Object.fromEntries(
    (stocks || []).map(s => [s.producto_id, Number(s.cantidad)])
  )

  return productos.map(p => ({
    ...p,
    precio: p.precio_venta,               // alias conveniente
    stock:  stockMap[p.id] ?? 0,
  }))
}

// ─── Registrar venta ──────────────────────────────────────────

/**
 * Registra la venta y sus ítems de forma ATÓMICA mediante la RPC
 * `fn_registrar_venta` (ver database/correcciones_2026-06.sql).
 * Si falla cualquier ítem, se revierte también la cabecera → no quedan
 * ventas huérfanas. El trigger `trg_items_venta_bajar_inventario`
 * descuenta el stock al insertar cada ítem.
 *
 * @param {object}   ventaData  Campos de la tabla ventas
 * @param {object[]} items      Ítems del carrito
 * @returns {object} Venta insertada (incluye id y fecha)
 */
export async function registrarVenta(ventaData, items) {
  const p_items = items.map(i => ({
    producto_id:     i.producto_id,
    cantidad:        i.cantidad,
    precio_unitario: i.precio,
    descuento:       0,
    subtotal:        Math.round(i.precio * i.cantidad * 100) / 100,
  }))

  const { data, error } = await supabase.rpc('fn_registrar_venta', {
    p_venta: ventaData,
    p_items,
  })
  if (error) throw error
  return data
}

// ─── Corte de caja ────────────────────────────────────────────

/**
 * Devuelve todas las ventas de un día y punto, con sus ítems
 * y el nombre del producto (join con productos).
 *
 * @param {string} fecha   'YYYY-MM-DD'
 * @param {string} punto   'punto_a' | 'punto_b'
 */
export async function getVentasDia(fecha, punto) {
  const { desde, hasta } = rangodia(fecha)
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      id, fecha, subtotal, descuento_total, total,
      metodo_pago, estado, notas,
      items_venta (
        id, cantidad, precio_unitario, descuento, subtotal, producto_id,
        productos ( nombre, unidad_venta )
      )
    `)
    .eq('punto_venta', punto)
    .neq('estado', 'cancelada')          // excluir canceladas del corte
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (error) throw error
  return data || []
}

// ─── Historial ────────────────────────────────────────────────

/**
 * Lista de ventas con filtros opcionales.
 *
 * @param {object} opts
 * @param {string} [opts.desde]   'YYYY-MM-DD'
 * @param {string} [opts.hasta]   'YYYY-MM-DD'
 * @param {string} [opts.punto]   'punto_a' | 'punto_b' | ''
 * @param {number} [opts.limit]
 */
export async function getHistorial({ desde, hasta, punto, limit = 80 } = {}) {
  let q = supabase
    .from('ventas')
    .select('id, fecha, subtotal, descuento_total, total, metodo_pago, punto_venta, estado')
    .order('fecha', { ascending: false })
    .limit(limit)

  if (desde) q = q.gte('fecha', desde + 'T00:00:00')
  if (hasta) q = q.lte('fecha', hasta + 'T23:59:59')
  if (punto) q = q.eq('punto_venta', punto)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

// ─── Detalle ──────────────────────────────────────────────────

/**
 * Venta completa con sus ítems y datos del producto.
 */
export async function getDetalleVenta(id) {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      items_venta (
        id, cantidad, precio_unitario, descuento, subtotal,
        productos ( nombre, categoria, unidad_venta )
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ─── Cancelación ─────────────────────────────────────────────
//  Requiere ejecutar database/ventas_cancelacion.sql primero.
//  El trigger fn_trg_venta_cancelada restaura el inventario.

/**
 * Cancela una venta y registra el motivo.
 * @param {string} id     UUID de la venta
 * @param {string} motivo Razón de la cancelación
 */
export async function cancelarVenta(id, motivo) {
  const { error } = await supabase
    .from('ventas')
    .update({ estado: 'cancelada', motivo_cancelacion: motivo })
    .eq('id', id)
  if (error) throw error
}

// ─── Costos de adquisición por producto ──────────────────────

/**
 * Devuelve el costo real unitario más reciente de cada producto
 * a partir de los viajes de compra completados.
 * Usado en el Corte de Caja para calcular la utilidad estimada.
 *
 * @param {string[]} ids  Array de producto_id (UUIDs)
 * @returns {Object} { [producto_id]: costo_real_unitario }
 */
export async function getCostosProductos(ids) {
  if (!ids || !ids.length) return {}

  const { data, error } = await supabase
    .from('items_viaje')
    .select('producto_id, costo_real_unitario, viajes_compra(fecha, estado)')
    .in('producto_id', ids)
    .gt('costo_real_unitario', 0)

  if (error) {
    console.warn('getCostosProductos:', error.message)
    return {}
  }

  // Por cada producto, conservar el costo del viaje más reciente completado
  const byProduct = {}
  for (const row of (data || [])) {
    const vc = row.viajes_compra
    if (!vc || vc.estado !== 'completado') continue
    const prev = byProduct[row.producto_id]
    if (!prev || vc.fecha > prev.fecha) {
      byProduct[row.producto_id] = {
        costo: Number(row.costo_real_unitario),
        fecha: vc.fecha,
      }
    }
  }

  return Object.fromEntries(
    Object.entries(byProduct).map(([id, { costo }]) => [id, costo])
  )
}

// ─── Re-exports de utilidades ─────────────────────────────────
export { hoyISO }
