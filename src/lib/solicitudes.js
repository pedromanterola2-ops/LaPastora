import { supabase } from './supabase'

/* ═══════════════════════════════════════════════════════════════
   SOLICITUDES DE REABASTECIMIENTO
═══════════════════════════════════════════════════════════════ */

export const ESTADO_SOLICITUD = {
  pendiente: 'pendiente',
  revisada:  'revisada',
  aprobada:  'aprobada',
  rechazada: 'rechazada',
}

export const ESTADO_SOLICITUD_LABEL = {
  pendiente: 'Pendiente',
  revisada:  'Revisada',
  aprobada:  'Aprobada',
  rechazada: 'Rechazada',
}

export const ESTADO_SOLICITUD_COLOR = {
  pendiente: 'bg-amber-100 text-amber-700',
  revisada:  'bg-blue-100  text-blue-700',
  aprobada:  'bg-green-100 text-green-700',
  rechazada: 'bg-red-100   text-red-700',
}

/* ───────────────────────────────────────────────────────────────
   CONSULTAS
─────────────────────────────────────────────────────────────── */

/**
 * Lista de solicitudes.
 * - Admin: todas, ordenadas por fecha desc.
 * - Punto: solo las del punto actual.
 * @param {{ punto?: string }} opciones
 */
export async function getSolicitudes({ punto } = {}) {
  let q = supabase
    .from('solicitudes_reabastecimiento')
    .select(`
      id, fecha, punto_venta, estado, notas, notas_admin, updated_at,
      solicitante:solicitante_id ( id, nombre )
    `)
    .order('fecha', { ascending: false })

  if (punto) q = q.eq('punto_venta', punto)

  const { data, error } = await q
  if (error) throw error
  return data
}

/**
 * Detalle de una solicitud con sus items y productos.
 */
export async function getSolicitud(id) {
  const { data, error } = await supabase
    .from('solicitudes_reabastecimiento')
    .select(`
      id, fecha, punto_venta, estado, notas, notas_admin, updated_at,
      solicitante:solicitante_id ( id, nombre ),
      items:items_solicitud (
        id, cantidad_solicitada, cantidad_aprobada, notas,
        producto:producto_id ( id, nombre, unidad_venta, categoria )
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Conteo de solicitudes pendientes (para badge del admin).
 */
export async function getCountSolicitudesPendientes() {
  const { count, error } = await supabase
    .from('solicitudes_reabastecimiento')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  if (error) throw error
  return count ?? 0
}

/**
 * Productos con stock bajo para pre-llenar el formulario.
 * Retorna los productos cuyo stock en `punto` está por debajo de existencia_minima.
 * @param {string} punto  'punto_a' | 'punto_b'
 */
export async function getProductosBajoStockPunto(punto) {
  // inventario_resumen tiene stock_punto_a, stock_punto_b y existencia_minima
  const campo = punto === 'punto_a' ? 'stock_punto_a' : 'stock_punto_b'

  const { data, error } = await supabase
    .from('inventario_resumen')
    .select('producto_id, nombre, unidad_venta, categoria, existencia_minima, stock_punto_a, stock_punto_b')
    .order('nombre')

  if (error) throw error

  // Filtrar: stock en ese punto < existencia_minima (o existencia_minima definida)
  return data
    .filter((p) => {
      const stock = p[campo] ?? 0
      const min   = p.existencia_minima ?? 0
      return stock <= min
    })
    .map((p) => ({
      producto_id:     p.producto_id,
      nombre:          p.nombre,
      unidad_venta:    p.unidad_venta,
      categoria:       p.categoria,
      existencia_minima: p.existencia_minima,
      stock_actual:    p[campo] ?? 0,
    }))
}

/* ───────────────────────────────────────────────────────────────
   MUTACIONES
─────────────────────────────────────────────────────────────── */

/**
 * Crea una solicitud con sus items.
 * @param {{ solicitanteId: string, puntoVenta: string, notas: string, items: Array }}
 */
export async function crearSolicitud({ solicitanteId, puntoVenta, notas, items }) {
  // 1) Insertar cabecera
  const { data: solicitud, error: errSol } = await supabase
    .from('solicitudes_reabastecimiento')
    .insert({
      solicitante_id: solicitanteId,
      punto_venta:    puntoVenta,
      notas:          notas || null,
    })
    .select('id')
    .single()

  if (errSol) throw errSol

  // 2) Insertar items
  const rows = items.map((it) => ({
    solicitud_id:        solicitud.id,
    producto_id:         it.producto_id,
    cantidad_solicitada: it.cantidad,
    notas:               it.notas || null,
  }))

  const { error: errItems } = await supabase
    .from('items_solicitud')
    .insert(rows)

  if (errItems) throw errItems

  return solicitud.id
}

/**
 * Admin actualiza el estado y puede ajustar cantidades aprobadas + notas.
 * @param {{ solicitudId: string, estado: string, notasAdmin: string, items: Array }}
 */
export async function revisarSolicitud({ solicitudId, estado, notasAdmin, items }) {
  // 1) Actualizar cabecera
  const { error: errSol } = await supabase
    .from('solicitudes_reabastecimiento')
    .update({
      estado,
      notas_admin: notasAdmin || null,
    })
    .eq('id', solicitudId)

  if (errSol) throw errSol

  // 2) Actualizar cantidades aprobadas por item
  for (const it of items) {
    const { error } = await supabase
      .from('items_solicitud')
      .update({
        cantidad_aprobada: it.cantidad_aprobada != null ? it.cantidad_aprobada : null,
        notas:             it.notas || null,
      })
      .eq('id', it.id)

    if (error) throw error
  }
}
