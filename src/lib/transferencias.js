import { supabase } from './supabase'

const PAGE_SIZE = 30

/* ═══════════════════════════════════════════════════════════════
   LISTA
═══════════════════════════════════════════════════════════════ */

/**
 * Lista paginada de transferencias con filtros opcionales.
 */
export async function getTransferencias({
  producto_id,
  origen,
  destino,
  fecha_desde,
  fecha_hasta,
  page = 0,
} = {}) {
  let q = supabase
    .from('transferencias')
    .select('*, productos(nombre, unidad_venta, categoria)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (producto_id) q = q.eq('producto_id', producto_id)
  if (origen)      q = q.eq('origen', origen)
  if (destino)     q = q.eq('destino', destino)
  if (fecha_desde) q = q.gte('fecha', `${fecha_desde}T00:00:00`)
  if (fecha_hasta) q = q.lte('fecha', `${fecha_hasta}T23:59:59`)

  const { data, error, count } = await q
  if (error) throw error
  return { data: data || [], count: count || 0, pageSize: PAGE_SIZE }
}

/* ═══════════════════════════════════════════════════════════════
   CREAR
   El trigger SQL fn_trg_transferencia_mover_inventario actualiza
   inventario y registra movimientos_inventario automáticamente.
═══════════════════════════════════════════════════════════════ */

export async function crearTransferencia({ producto_id, cantidad, origen, destino, motivo }) {
  const { data, error } = await supabase
    .from('transferencias')
    .insert({
      producto_id,
      cantidad: Number(cantidad),
      origen,
      destino,
      motivo: motivo?.trim() || null,
    })
    .select('*, productos(nombre, unidad_venta)')
    .single()

  if (error) throw error
  return data
}

/* ═══════════════════════════════════════════════════════════════
   STOCK POR PRODUCTO
═══════════════════════════════════════════════════════════════ */

/**
 * Devuelve el stock actual de un producto en las 3 ubicaciones.
 * Usa la vista inventario_resumen.
 */
export async function getStockProducto(producto_id) {
  const { data, error } = await supabase
    .from('inventario_resumen')
    .select('stock_central, stock_punto_a, stock_punto_b')
    .eq('producto_id', producto_id)
    .maybeSingle()

  if (error) throw error
  return data ?? { stock_central: 0, stock_punto_a: 0, stock_punto_b: 0 }
}

/**
 * Devuelve todos los productos activos con su stock total.
 * Útil para el buscador del modal (solo muestra productos con algún stock).
 */
export async function getProductosConStock() {
  const { data, error } = await supabase
    .from('inventario_resumen')
    .select('producto_id, nombre, categoria, unidad_venta, stock_central, stock_punto_a, stock_punto_b, stock_total')
    .order('nombre')

  if (error) throw error
  return (data || []).filter(p =>
    Number(p.stock_central) + Number(p.stock_punto_a) + Number(p.stock_punto_b) > 0
  )
}

export { PAGE_SIZE }
