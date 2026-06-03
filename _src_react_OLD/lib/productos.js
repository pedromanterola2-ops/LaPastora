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

/**
 * Crea un producto. Si `payload.cantidad_inicial > 0`, la función RPC
 * sube ese stock a la bodega central y registra el movimiento.
 */
export async function createProducto(payload) {
  const { data, error } = await supabase.rpc('fn_crear_producto', {
    p_nombre:            payload.nombre,
    p_categoria:         payload.categoria ?? null,
    p_sku:               payload.sku ?? null,
    p_unidad_venta:      payload.unidad_venta ?? 'pieza',
    p_contenido:         payload.contenido ?? 1,
    p_costo:             payload.costo ?? 0,
    p_precio_venta:      payload.precio_venta ?? 0,
    p_fecha_caducidad:   payload.fecha_caducidad || null,
    p_existencia_minima: payload.existencia_minima ?? 0,
    p_cantidad_inicial:  payload.cantidad_inicial ?? 0,
    p_activo:            payload.activo ?? true,
  })
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
 * Inserta múltiples productos de una vez vía RPC. Cada fila puede traer
 * `cantidad_inicial`; la función sube ese stock a la bodega central.
 * @param {Array<object>} rows  Filas validadas con los campos del producto
 * @returns {Promise<number>}   Cantidad de productos creados
 */
export async function importarProductosCSV(rows) {
  if (!rows?.length) throw new Error('No hay filas para importar')

  const payload = rows.map(r => ({
    nombre:            r.nombre.trim(),
    categoria:         r.categoria?.trim() || null,
    sku:               r.sku?.trim() || null,
    unidad_venta:      r.unidad_venta?.trim() || 'pieza',
    contenido:         parseFloat(r.contenido) || 1,
    costo:             parseFloat(r.costo) || 0,
    precio_venta:      parseFloat(r.precio_venta) || 0,
    fecha_caducidad:   r.fecha_caducidad?.trim() || null,
    existencia_minima: parseFloat(r.existencia_minima) || 0,
    cantidad_inicial:  parseFloat(r.cantidad_inicial) || 0,
    activo: true,
  }))

  const { data, error } = await supabase.rpc('fn_importar_productos', {
    p_rows: payload,
  })

  if (error) throw error
  return data ?? payload.length
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
