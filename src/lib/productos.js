import { supabase } from './supabase'

// ─── Lista ────────────────────────────────────────────────────

/**
 * Devuelve todos los productos con su stock por ubicación.
 * @param {object} opts
 * @param {string}  [opts.q]          Buscar por nombre (ilike)
 * @param {string}  [opts.categoria]  Filtrar por categoría exacta
 * @param {string}  [opts.estado]     'todos' | 'activo' | 'inactivo'
 */
export async function getProductos({ q = '', categoria = '', estado = 'todos' } = {}) {
  let query = supabase
    .from('productos')
    .select('*, inventario(ubicacion, cantidad)')
    .order('nombre')

  if (q)         query = query.ilike('nombre', `%${q.trim()}%`)
  if (categoria) query = query.eq('categoria', categoria)
  if (estado === 'activo')   query = query.eq('activo', true)
  if (estado === 'inactivo') query = query.eq('activo', false)

  const { data, error } = await query
  if (error) throw error

  return (data || []).map(p => enriquecerStock(p))
}

// ─── Detalle ─────────────────────────────────────────────────

export async function getProducto(id) {
  const { data, error } = await supabase
    .from('productos')
    .select('*, inventario(ubicacion, cantidad)')
    .eq('id', id)
    .single()
  if (error) throw error
  return enriquecerStock(data)
}

// ─── Crear ────────────────────────────────────────────────────

export async function createProducto(payload) {
  const { data, error } = await supabase
    .from('productos')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Actualizar ───────────────────────────────────────────────

export async function updateProducto(id, payload) {
  const { data, error } = await supabase
    .from('productos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Importación masiva desde CSV ────────────────────────────

/**
 * Inserta múltiples productos de una vez.
 * @param {Array<object>} rows  Filas validadas con los campos del producto
 * @returns {Promise<number>}   Cantidad de filas insertadas
 */
export async function importarProductosCSV(rows) {
  if (!rows?.length) throw new Error('No hay filas para importar')

  const payload = rows.map(r => ({
    nombre:                  r.nombre.trim(),
    categoria:               r.categoria?.trim() || null,
    unidad_venta:            r.unidad_venta?.trim() || 'pieza',
    precio_venta:            parseFloat(r.precio_venta) || 0,
    existencia_minima:       parseFloat(r.existencia_minima) || 0,
    dias_caducidad_estimado: r.dias_caducidad_estimado
                               ? parseInt(r.dias_caducidad_estimado, 10) || null
                               : null,
    activo: true,
  }))

  const { error, count } = await supabase
    .from('productos')
    .insert(payload, { count: 'exact' })

  if (error) throw error
  return count ?? payload.length
}

// ─── Toggle activo ────────────────────────────────────────────

export async function toggleActivo(id, activo) {
  const { error } = await supabase
    .from('productos')
    .update({ activo })
    .eq('id', id)
  if (error) throw error
}

// ─── Categorías para autocompletar ───────────────────────────

export async function getCategorias() {
  const { data } = await supabase
    .from('productos')
    .select('categoria')
    .not('categoria', 'is', null)
    .neq('categoria', '')
    .order('categoria')
  return [...new Set((data || []).map(r => r.categoria).filter(Boolean))]
}

// ─── Helper ───────────────────────────────────────────────────

function enriquecerStock(p) {
  const inv = p.inventario || []
  const stockMap = Object.fromEntries(inv.map(i => [i.ubicacion, Number(i.cantidad)]))
  const stockTotal = inv.reduce((s, i) => s + Number(i.cantidad), 0)
  return { ...p, inventario: undefined, stock: stockMap, stock_total: stockTotal }
}
