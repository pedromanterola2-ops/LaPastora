import { supabase } from './supabase'

const PAGE_SIZE = 25

/* ═══════════════════════════════════════════════════════════════
   MOVIMIENTOS — helpers de presentación
   La tabla movimientos_inventario guarda `cantidad` (siempre > 0) y
   la dirección en `ubicacion_origen` / `ubicacion_destino`.
   Estos helpers derivan la ubicación a mostrar y el signo (+/−).
═══════════════════════════════════════════════════════════════ */

export const UBICACION_LABEL = {
  central: 'Central',
  punto_a: 'Punto A',
  punto_b: 'Punto B',
}

// Etiquetas que coinciden con el CHECK de movimientos_inventario.tipo
export const TIPO_MOVIMIENTO_LABEL = {
  entrada_compra: 'Entrada (compra)',
  salida_venta:   'Salida (venta)',
  transferencia:  'Transferencia',
  ajuste_merma:   'Merma / pérdida',
  ajuste_conteo:  'Ajuste (conteo)',
  distribucion:   'Distribución',
}

// Tipos que suman stock (entrada). El resto resta o es transferencia.
const TIPOS_ENTRADA = ['entrada_compra']

/** Texto de ubicación: "Origen → Destino" para transferencias, una sola para el resto */
export function ubicacionMovimiento(m) {
  const o = UBICACION_LABEL[m.ubicacion_origen]
  const d = UBICACION_LABEL[m.ubicacion_destino]
  if (o && d) return `${o} → ${d}`
  return o || d || '—'
}

/**
 * Cantidad con signo según el tipo de movimiento.
 * Entrada/destino = +  |  salida/origen = −  |  transferencia = neutro (0 → sin color)
 */
export function deltaMovimiento(m) {
  const cant = Number(m.cantidad) || 0
  if (m.tipo === 'transferencia') return 0 // se mueve, no cambia el total
  const esEntrada = TIPOS_ENTRADA.includes(m.tipo) || (!!m.ubicacion_destino && !m.ubicacion_origen)
  return esEntrada ? cant : -cant
}

/** Texto del delta listo para mostrar: "+5", "−3", "5" (transferencia) */
export function deltaTexto(m) {
  const cant = Number(m.cantidad) || 0
  if (m.tipo === 'transferencia') return String(cant)
  const d = deltaMovimiento(m)
  return d > 0 ? `+${d}` : String(d)
}

/* ═══════════════════════════════════════════════════════════════
   VISTA GENERAL
═══════════════════════════════════════════════════════════════ */

export async function getInventarioResumen() {
  const { data, error } = await supabase
    .from('inventario_resumen')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data || []
}

/* ═══════════════════════════════════════════════════════════════
   ALERTAS
═══════════════════════════════════════════════════════════════ */

export async function getAlertasStockBajo() {
  const { data, error } = await supabase
    .from('inventario_resumen')
    .select('producto_id, nombre, categoria, stock_central, stock_punto_a, stock_punto_b, stock_total, existencia_minima')
    .eq('alerta_stock_bajo', true)
    .order('nombre')
  if (error) throw error
  return data || []
}

export async function getProductosProximosACaducar(dias = 7) {
  const { data, error } = await supabase
    .from('viajes_compra')
    .select(`
      id, fecha,
      items_viaje(
        producto_id,
        productos(id, nombre, categoria, unidad_venta, dias_caducidad_estimado)
      )
    `)
    .eq('estado', 'completado')
    .order('fecha', { ascending: false })

  if (error) throw error

  const hoy    = new Date()
  const limite = new Date()
  limite.setDate(limite.getDate() + dias)

  // Tomar la recepción más reciente de cada producto y estimar caducidad
  const porProducto = {}
  for (const viaje of data || []) {
    for (const item of viaje.items_viaje || []) {
      const p = item.productos
      if (!p?.dias_caducidad_estimado) continue
      if (porProducto[item.producto_id]) continue // ya tenemos la más reciente

      const expiry = new Date(`${viaje.fecha}T12:00:00`)
      expiry.setDate(expiry.getDate() + p.dias_caducidad_estimado)

      if (expiry >= hoy && expiry <= limite) {
        porProducto[item.producto_id] = {
          ...p,
          fecha_caducidad_estimada: expiry.toISOString().split('T')[0],
          dias_restantes: Math.ceil((expiry - hoy) / (1000 * 60 * 60 * 24)),
          ultimo_viaje:   viaje.fecha,
        }
      }
    }
  }
  return Object.values(porProducto)
}

export async function getProductosEstancados(dias = 15) {
  const fechaLimite = new Date()
  fechaLimite.setDate(fechaLimite.getDate() - dias)
  const fechaStr = fechaLimite.toISOString().split('T')[0]

  const [{ data: inv }, { data: ventas }] = await Promise.all([
    supabase
      .from('inventario_resumen')
      .select('producto_id, nombre, categoria, stock_total')
      .gt('stock_total', 0),
    supabase
      .from('ventas')
      .select('items_venta(producto_id)')
      .gte('fecha', fechaStr),
  ])

  if (!inv?.length) return []

  const idsConVentas = new Set(
    (ventas || []).flatMap(v => (v.items_venta || []).map(i => i.producto_id))
  )

  return inv.filter(p => !idsConVentas.has(p.producto_id))
}

/* ═══════════════════════════════════════════════════════════════
   DISTRIBUCIÓN
═══════════════════════════════════════════════════════════════ */

export async function getProductosConStockCentral() {
  const { data, error } = await supabase
    .from('inventario_resumen')
    .select('producto_id, nombre, categoria, stock_central, stock_punto_a, stock_punto_b, stock_total, existencia_minima')
    .gt('stock_central', 0)
    .order('nombre')
  if (error) throw error
  return data || []
}

/** Ventas totales en los últimos N días por punto, para un conjunto de producto_ids */
export async function getVentasPorPunto30Dias(productoIds = []) {
  if (!productoIds.length) return {}

  const fecha30 = new Date()
  fecha30.setDate(fecha30.getDate() - 30)
  const fechaStr = fecha30.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('ventas')
    .select('punto_venta, items_venta(producto_id, cantidad)')
    .gte('fecha', fechaStr)

  if (error) throw error

  const resultado = {}
  for (const venta of data || []) {
    for (const item of venta.items_venta || []) {
      if (!productoIds.includes(item.producto_id)) continue
      if (!resultado[item.producto_id]) {
        resultado[item.producto_id] = { punto_a: 0, punto_b: 0 }
      }
      if (venta.punto_venta === 'punto_a') resultado[item.producto_id].punto_a += Number(item.cantidad)
      if (venta.punto_venta === 'punto_b') resultado[item.producto_id].punto_b += Number(item.cantidad)
    }
  }
  return resultado
}

/** Distribución atómica via fn_distribuir_inventario */
export async function distribuirInventario(items) {
  // items: [{ producto_id, cantidad_a, cantidad_b, notas? }]
  const payload = items
    .filter(i => (Number(i.cantidad_a) || 0) + (Number(i.cantidad_b) || 0) > 0)
    .map(i => ({
      producto_id: i.producto_id,
      cantidad_a:  Number(i.cantidad_a) || 0,
      cantidad_b:  Number(i.cantidad_b) || 0,
      notas:       i.notas || 'Distribución de inventario',
    }))

  if (!payload.length) throw new Error('No hay cantidades para distribuir')

  const { error } = await supabase.rpc('fn_distribuir_inventario', {
    p_items: payload,
  })
  if (error) throw error
}

/* ═══════════════════════════════════════════════════════════════
   AJUSTE DE INVENTARIO
═══════════════════════════════════════════════════════════════ */

// El CHECK de movimientos_inventario.tipo solo admite 'ajuste_conteo' y
// 'ajuste_merma'. El motivo detallado de la UI (conteo, merma, caducado,
// robo, otro) se conserva legible dentro de las notas.
const MOTIVO_A_TIPO = {
  ajuste:   'ajuste_conteo',
  merma:    'ajuste_merma',
  caducado: 'ajuste_merma',
  robo:     'ajuste_merma',
  otro:     'ajuste_merma',
}
const MOTIVO_LABEL = {
  ajuste:   'Conteo físico',
  merma:    'Merma',
  caducado: 'Caducado',
  robo:     'Robo / pérdida',
  otro:     'Otro',
}

export async function ajustarInventario({ producto_id, ubicacion, delta, tipo, notas }) {
  const tipoDB = MOTIVO_A_TIPO[tipo] || 'ajuste_conteo'
  // Anteponer el motivo legible a las notas para no perder el detalle
  const etiqueta = MOTIVO_LABEL[tipo]
  const notasFinal = etiqueta && tipo !== 'ajuste'
    ? (notas ? `${etiqueta}: ${notas}` : etiqueta)
    : (notas || null)

  const { error } = await supabase.rpc('fn_ajustar_inventario', {
    p_producto_id: producto_id,
    p_ubicacion:   ubicacion,
    p_delta:       Number(delta),
    p_tipo:        tipoDB,
    p_notas:       notasFinal,
  })
  if (error) throw error
}

export async function getProductosCatalogo() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, categoria, unidad_venta')
    .order('nombre')
  if (error) throw error
  return data || []
}

/* ═══════════════════════════════════════════════════════════════
   HISTORIAL DE MOVIMIENTOS
═══════════════════════════════════════════════════════════════ */

export async function getMovimientos({
  producto_id,
  tipo,
  ubicacion,
  fecha_desde,
  fecha_hasta,
  page = 0,
} = {}) {
  let q = supabase
    .from('movimientos_inventario')
    .select('*, productos(nombre, categoria, unidad_venta)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (producto_id) q = q.eq('producto_id', producto_id)
  if (tipo)        q = q.eq('tipo', tipo)
  // movimientos_inventario usa ubicacion_origen y ubicacion_destino (no 'ubicacion')
  if (ubicacion)   q = q.or(`ubicacion_origen.eq.${ubicacion},ubicacion_destino.eq.${ubicacion}`)
  if (fecha_desde) q = q.gte('fecha', `${fecha_desde}T00:00:00`)
  if (fecha_hasta) q = q.lte('fecha', `${fecha_hasta}T23:59:59`)

  const { data, error, count } = await q
  if (error) throw error
  return { data: data || [], count: count || 0, pageSize: PAGE_SIZE }
}

/** Descarga CSV del historial (sin paginación) */
export async function exportarMovimientosCSV({
  producto_id,
  tipo,
  ubicacion,
  fecha_desde,
  fecha_hasta,
} = {}) {
  let q = supabase
    .from('movimientos_inventario')
    .select('*, productos(nombre, categoria, unidad_venta)')
    .order('fecha', { ascending: false })

  if (producto_id) q = q.eq('producto_id', producto_id)
  if (tipo)        q = q.eq('tipo', tipo)
  // movimientos_inventario usa ubicacion_origen y ubicacion_destino (no 'ubicacion')
  if (ubicacion)   q = q.or(`ubicacion_origen.eq.${ubicacion},ubicacion_destino.eq.${ubicacion}`)
  if (fecha_desde) q = q.gte('fecha', `${fecha_desde}T00:00:00`)
  if (fecha_hasta) q = q.lte('fecha', `${fecha_hasta}T23:59:59`)

  const { data, error } = await q
  if (error) throw error

  const headers = ['Fecha', 'Producto', 'Categoría', 'Unidad', 'Ubicación', 'Cantidad', 'Tipo', 'Notas']
  const rows = (data || []).map(m => [
    new Date(m.fecha || m.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
    m.productos?.nombre  || '',
    m.productos?.categoria || '',
    m.productos?.unidad_venta || '',
    ubicacionMovimiento(m),
    deltaTexto(m),
    TIPO_MOVIMIENTO_LABEL[m.tipo] || m.tipo || '',
    m.notas || '',
  ])

  const escape = cell => `"${String(cell).replace(/"/g, '""')}"`
  return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
}

export { PAGE_SIZE }
