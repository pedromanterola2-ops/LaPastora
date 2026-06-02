import { supabase } from './supabase'
import { GASTOS_KEYS } from './format'

/* ─── Helpers ─────────────────────────────────────────────────── */

/** Rango de fechas para columna TIMESTAMPTZ */
function rangoFecha(fecha) {
  return { desde: `${fecha}T00:00:00`, hasta: `${fecha}T23:59:59.999` }
}

function hoyISO() {
  return new Date().toISOString().split('T')[0]
}

function hace7Dias() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().split('T')[0]
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */

/** Ventas de hoy desglosadas por punto de venta */
export async function getVentasHoyPorPunto() {
  const hoy = hoyISO()
  const { desde, hasta } = rangoFecha(hoy)

  const { data, error } = await supabase
    .from('ventas')
    .select('punto_venta, total, cancelada')
    .gte('fecha', desde)
    .lte('fecha', hasta)
  if (error) throw error

  const activas = (data || []).filter(v => !v.cancelada)
  const puntoA  = activas.filter(v => v.punto_venta === 'punto_a').reduce((a, v) => a + Number(v.total), 0)
  const puntoB  = activas.filter(v => v.punto_venta === 'punto_b').reduce((a, v) => a + Number(v.total), 0)
  return { puntoA, puntoB, total: puntoA + puntoB, numVentas: activas.length }
}

/** Ventas de los últimos 7 días agrupadas por día y punto */
export async function getVentas7Dias() {
  const desde7 = hace7Dias()
  const hoy    = hoyISO()

  const { data, error } = await supabase
    .from('ventas')
    .select('fecha, punto_venta, total, cancelada')
    .gte('fecha', `${desde7}T00:00:00`)
    .lte('fecha', `${hoy}T23:59:59.999`)
  if (error) throw error

  // Generar array de 7 días
  const dias = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dias.push(d.toISOString().split('T')[0])
  }

  const activas = (data || []).filter(v => !v.cancelada)

  return dias.map(dia => {
    const ventasDia = activas.filter(v => v.fecha?.startsWith(dia))
    return {
      fecha:  dia,
      puntoA: ventasDia.filter(v => v.punto_venta === 'punto_a').reduce((a, v) => a + Number(v.total), 0),
      puntoB: ventasDia.filter(v => v.punto_venta === 'punto_b').reduce((a, v) => a + Number(v.total), 0),
    }
  })
}

/** Últimos N viajes de compra */
export async function getUltimosViajes(n = 5) {
  const { data, error } = await supabase
    .from('viajes_compra')
    .select(`
      id, fecha, estado,
      proveedores(nombre),
      gastos_gasolina, gastos_casetas, gastos_comida, gastos_hospedaje, gastos_otros,
      items_viaje(cantidad, precio_unitario_compra)
    `)
    .order('fecha', { ascending: false })
    .limit(n)
  if (error) throw error

  return (data || []).map(v => ({
    id:       v.id,
    fecha:    v.fecha,
    estado:   v.estado,
    proveedor: v.proveedores?.nombre || '—',
    total_merch: (v.items_viaje || []).reduce(
      (a, i) => a + Number(i.cantidad) * Number(i.precio_unitario_compra), 0
    ),
    total_gastos: GASTOS_KEYS.reduce((a, k) => a + (Number(v[k]) || 0), 0),
  })).map(v => ({ ...v, costo_total: v.total_merch + v.total_gastos }))
}

/** Conteo de alertas activas (stock bajo + próximos a caducar) */
export async function getCountAlertas() {
  const { count } = await supabase
    .from('inventario_resumen')
    .select('*', { count: 'exact', head: true })
    .eq('alerta_stock_bajo', true)
  return count || 0
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 1 — ROTACIÓN POR PUNTO
═══════════════════════════════════════════════════════════════ */

/**
 * Unidades e ingresos vendidos por producto y punto en el rango.
 * Usa la vista ventas_por_producto_punto (agrupada por mes).
 */
export async function getRotacionPorPunto({ fecha_desde, fecha_hasta }) {
  const mesDe  = fecha_desde.slice(0, 7)  // 'YYYY-MM'
  const mesHasta = fecha_hasta.slice(0, 7)

  const { data, error } = await supabase
    .from('ventas_por_producto_punto')
    .select('producto_id, producto, categoria, punto_venta, unidades_vendidas, ingresos_netos')
    .gte('mes', `${mesDe}-01`)
    .lte('mes', `${mesHasta}-01`)
  if (error) throw error

  const porProducto = {}
  for (const row of data || []) {
    if (!porProducto[row.producto_id]) {
      porProducto[row.producto_id] = {
        producto_id: row.producto_id,
        nombre:      row.producto,
        categoria:   row.categoria,
        uds_a:       0, uds_b:       0,
        ing_a:       0, ing_b:       0,
      }
    }
    const p = porProducto[row.producto_id]
    if (row.punto_venta === 'punto_a') {
      p.uds_a += Number(row.unidades_vendidas || 0)
      p.ing_a += Number(row.ingresos_netos   || 0)
    } else if (row.punto_venta === 'punto_b') {
      p.uds_b += Number(row.unidades_vendidas || 0)
      p.ing_b += Number(row.ingresos_netos   || 0)
    }
  }

  return Object.values(porProducto).map(p => {
    const total = p.uds_a + p.uds_b
    return {
      ...p,
      total_uds:   total,
      total_ing:   p.ing_a + p.ing_b,
      pct_a: total > 0 ? Math.round(p.uds_a * 100 / total) : 0,
      pct_b: total > 0 ? Math.round(p.uds_b * 100 / total) : 0,
    }
  }).sort((a, b) => b.total_uds - a.total_uds)
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 2 — VENTAS POR PERÍODO
═══════════════════════════════════════════════════════════════ */

export async function getReporteVentas({ fecha_desde, fecha_hasta, agrupacion = 'dia' }) {
  const { data, error } = await supabase
    .from('ventas')
    .select('fecha, punto_venta, metodo_pago, total, cancelada')
    .gte('fecha', `${fecha_desde}T00:00:00`)
    .lte('fecha', `${fecha_hasta}T23:59:59.999`)
    .order('fecha')
  if (error) throw error

  const activas = (data || []).filter(v => !v.cancelada)

  const grupos = {}
  for (const v of activas) {
    const fechaStr = typeof v.fecha === 'string' ? v.fecha.split('T')[0] : v.fecha
    let key
    if (agrupacion === 'dia') {
      key = fechaStr
    } else if (agrupacion === 'semana') {
      const d = new Date(`${fechaStr}T12:00:00`)
      const start = new Date(d)
      start.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)) // lunes
      key = start.toISOString().split('T')[0]
    } else {
      key = fechaStr.slice(0, 7) // mes
    }

    if (!grupos[key]) {
      grupos[key] = {
        periodo: key, total: 0,
        punto_a: 0, punto_b: 0,
        efectivo: 0, tarjeta: 0, transferencia: 0,
        num_ventas: 0,
      }
    }
    grupos[key].total      += Number(v.total)
    grupos[key].num_ventas += 1
    if (v.punto_venta  === 'punto_a')      grupos[key].punto_a      += Number(v.total)
    if (v.punto_venta  === 'punto_b')      grupos[key].punto_b      += Number(v.total)
    if (v.metodo_pago  === 'efectivo')     grupos[key].efectivo     += Number(v.total)
    if (v.metodo_pago  === 'tarjeta')      grupos[key].tarjeta      += Number(v.total)
    if (v.metodo_pago  === 'transferencia')grupos[key].transferencia += Number(v.total)
  }

  return Object.values(grupos).sort((a, b) => a.periodo.localeCompare(b.periodo))
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 3 — PRODUCTOS ESTANCADOS
═══════════════════════════════════════════════════════════════ */

export async function getReporteEstancados({ dias = 15 }) {
  const fechaLimite = new Date()
  fechaLimite.setDate(fechaLimite.getDate() - dias)
  const fechaStr = fechaLimite.toISOString().split('T')[0]

  const [{ data: inv }, { data: ventas }, { data: costos }] = await Promise.all([
    supabase
      .from('inventario_resumen')
      .select('producto_id, nombre, categoria, stock_central, stock_punto_a, stock_punto_b, stock_total, precio_venta'),
    supabase
      .from('ventas')
      .select('items_venta(producto_id), cancelada')
      .gte('fecha', `${fechaStr}T00:00:00`),
    supabase
      .from('items_viaje')
      .select('producto_id, costo_real_unitario')
      .gt('costo_real_unitario', 0)
      .order('created_at', { ascending: false }),
  ])

  const idsConVentas = new Set(
    (ventas || [])
      .filter(v => !v.cancelada)
      .flatMap(v => (v.items_venta || []).map(i => i.producto_id))
  )

  // Último costo real por producto
  const ultimoCosto = {}
  for (const item of costos || []) {
    if (!ultimoCosto[item.producto_id]) {
      ultimoCosto[item.producto_id] = Number(item.costo_real_unitario)
    }
  }

  return (inv || [])
    .filter(p => p.stock_total > 0 && !idsConVentas.has(p.producto_id))
    .map(p => {
      const costo = ultimoCosto[p.producto_id] || 0
      return {
        ...p,
        costo_unitario:  costo,
        valor_central:   costo * p.stock_central,
        valor_punto_a:   costo * p.stock_punto_a,
        valor_punto_b:   costo * p.stock_punto_b,
        valor_total:     costo * p.stock_total,
        // Si no hay costo real, usar precio venta como referencia
        valor_precio:    Number(p.precio_venta) * p.stock_total,
      }
    })
    .sort((a, b) => b.valor_total - a.valor_total)
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 4 — RENTABILIDAD
═══════════════════════════════════════════════════════════════ */

export async function getReporteRentabilidad({ fecha_desde, fecha_hasta }) {
  // 1. Ventas en el rango
  const { data: itemsVenta, error: eVentas } = await supabase
    .from('items_venta')
    .select(`
      producto_id,
      cantidad,
      precio_unitario,
      ventas!inner(fecha, cancelada)
    `)
    .gte('ventas.fecha', `${fecha_desde}T00:00:00`)
    .lte('ventas.fecha', `${fecha_hasta}T23:59:59.999`)
    .eq('ventas.cancelada', false)
  if (eVentas) throw eVentas

  // Filtrar ventas no canceladas (Supabase puede no filtrar correctamente el .eq en join)
  const itemsActivos = (itemsVenta || []).filter(i => !i.ventas?.cancelada)

  if (!itemsActivos.length) return []

  // 2. Costo más reciente por producto (de todos los viajes completados)
  const { data: costosHistorico } = await supabase
    .from('items_viaje')
    .select(`
      producto_id,
      costo_real_unitario,
      viajes_compra!inner(fecha, estado)
    `)
    .eq('viajes_compra.estado', 'completado')
    .gt('costo_real_unitario', 0)
    .order('viajes_compra(fecha)', { ascending: false })

  // Costo promedio ponderado en el rango de fechas
  const costosPorProd = {}
  const countPorProd  = {}
  for (const item of costosHistorico || []) {
    const viaFecha = item.viajes_compra?.fecha
    if (viaFecha >= fecha_desde && viaFecha <= fecha_hasta) {
      if (!costosPorProd[item.producto_id]) {
        costosPorProd[item.producto_id] = 0
        countPorProd[item.producto_id]  = 0
      }
      costosPorProd[item.producto_id] += Number(item.costo_real_unitario)
      countPorProd[item.producto_id]  += 1
    }
  }

  // Costo más reciente (fallback si no hay compras en el rango)
  const ultimoCosto = {}
  for (const item of costosHistorico || []) {
    if (!ultimoCosto[item.producto_id]) {
      ultimoCosto[item.producto_id] = Number(item.costo_real_unitario)
    }
  }

  // 3. Agregar ventas por producto
  const porProducto = {}
  for (const item of itemsActivos) {
    if (!porProducto[item.producto_id]) {
      porProducto[item.producto_id] = {
        producto_id:    item.producto_id,
        nombre:         null,
        categoria:      null,
        uds_vendidas:   0,
        ingresos:       0,
      }
    }
    porProducto[item.producto_id].uds_vendidas += Number(item.cantidad)
    porProducto[item.producto_id].ingresos     += Number(item.cantidad) * Number(item.precio_unitario)
  }

  // 4. Nombres de productos
  const ids = Object.keys(porProducto)
  if (ids.length) {
    const { data: prods } = await supabase
      .from('productos')
      .select('id, nombre, categoria')
      .in('id', ids)
    for (const p of prods || []) {
      if (porProducto[p.id]) {
        porProducto[p.id].nombre    = p.nombre
        porProducto[p.id].categoria = p.categoria
      }
    }
  }

  // 5. Calcular margen
  return Object.values(porProducto).map(p => {
    const precio_prom = p.uds_vendidas > 0 ? p.ingresos / p.uds_vendidas : 0
    const costo_prom  = costosPorProd[p.producto_id]
      ? costosPorProd[p.producto_id] / countPorProd[p.producto_id]
      : (ultimoCosto[p.producto_id] || 0)
    const margen_pesos = precio_prom - costo_prom
    const margen_pct   = precio_prom > 0 ? (margen_pesos / precio_prom) * 100 : 0
    const utilidad_total = margen_pesos * p.uds_vendidas
    return {
      ...p,
      precio_prom,
      costo_prom,
      margen_pesos,
      margen_pct,
      utilidad_total,
    }
  }).sort((a, b) => b.margen_pct - a.margen_pct)
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 5 — VIAJES DE COMPRA
═══════════════════════════════════════════════════════════════ */

export async function getReporteViajes({ fecha_desde, fecha_hasta }) {
  const { data, error } = await supabase
    .from('viajes_compra')
    .select(`
      id, fecha, estado, notas,
      proveedores(nombre, ciudad),
      gastos_gasolina, gastos_casetas, gastos_comida, gastos_hospedaje, gastos_otros,
      items_viaje(cantidad, precio_unitario_compra)
    `)
    .gte('fecha', fecha_desde)
    .lte('fecha', fecha_hasta)
    .order('fecha', { ascending: false })
  if (error) throw error

  const viajes = (data || []).map(v => {
    const totalMerch   = (v.items_viaje || []).reduce(
      (a, i) => a + Number(i.cantidad) * Number(i.precio_unitario_compra), 0
    )
    const totalGastos  = GASTOS_KEYS.reduce((a, k) => a + (Number(v[k]) || 0), 0)
    return {
      id:              v.id,
      fecha:           v.fecha,
      estado:          v.estado,
      proveedor:       v.proveedores?.nombre || '—',
      ciudad:          v.proveedores?.ciudad || '—',
      total_merch:     totalMerch,
      total_gastos:    totalGastos,
      costo_total:     totalMerch + totalGastos,
    }
  })

  // Promedios por proveedor
  const porProveedor = {}
  for (const v of viajes) {
    if (!porProveedor[v.proveedor]) {
      porProveedor[v.proveedor] = { count: 0, total: 0 }
    }
    porProveedor[v.proveedor].count += 1
    porProveedor[v.proveedor].total += v.costo_total
  }

  const totalesGlobales = {
    total_merch:  viajes.reduce((a, v) => a + v.total_merch,  0),
    total_gastos: viajes.reduce((a, v) => a + v.total_gastos, 0),
    costo_total:  viajes.reduce((a, v) => a + v.costo_total,  0),
    num_viajes:   viajes.length,
  }

  return { viajes, porProveedor, totalesGlobales }
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 6 — INVENTARIO PRÓXIMO A CADUCAR
═══════════════════════════════════════════════════════════════ */

export async function getReporteCaducidad({ diasHorizonte = 30 }) {
  const { data: viajesData, error } = await supabase
    .from('viajes_compra')
    .select(`
      id, fecha,
      items_viaje(
        producto_id,
        costo_real_unitario,
        productos(id, nombre, categoria, unidad_venta, dias_caducidad_estimado)
      )
    `)
    .eq('estado', 'completado')
    .order('fecha', { ascending: false })
    .limit(50)
  if (error) throw error

  const { data: inv } = await supabase
    .from('inventario_resumen')
    .select('producto_id, stock_central, stock_punto_a, stock_punto_b, stock_total')

  const invMap = Object.fromEntries((inv || []).map(i => [i.producto_id, i]))

  const hoy    = new Date()
  const limite = new Date()
  limite.setDate(limite.getDate() + diasHorizonte)

  const porProducto = {}
  for (const viaje of viajesData || []) {
    for (const item of viaje.items_viaje || []) {
      const p = item.productos
      if (!p?.dias_caducidad_estimado) continue
      if (porProducto[item.producto_id]) continue // usar la recepción más reciente

      const expiry = new Date(`${viaje.fecha}T12:00:00`)
      expiry.setDate(expiry.getDate() + p.dias_caducidad_estimado)

      if (expiry < hoy || expiry > limite) continue

      const stockInfo = invMap[item.producto_id] || {}
      const costo     = Number(item.costo_real_unitario) || 0
      const diasRest  = Math.ceil((expiry - hoy) / (1000 * 60 * 60 * 24))

      porProducto[item.producto_id] = {
        producto_id:              p.id,
        nombre:                   p.nombre,
        categoria:                p.categoria,
        unidad_venta:             p.unidad_venta,
        dias_caducidad_estimado:  p.dias_caducidad_estimado,
        fecha_caducidad_estimada: expiry.toISOString().split('T')[0],
        dias_restantes:           diasRest,
        urgente:                  diasRest <= 7,
        ultimo_viaje:             viaje.fecha,
        stock_central:            stockInfo.stock_central  || 0,
        stock_punto_a:            stockInfo.stock_punto_a  || 0,
        stock_punto_b:            stockInfo.stock_punto_b  || 0,
        stock_total:              stockInfo.stock_total    || 0,
        costo_unitario:           costo,
        valor_estimado:           costo * (stockInfo.stock_total || 0),
      }
    }
  }

  return Object.values(porProducto).sort((a, b) => a.dias_restantes - b.dias_restantes)
}

/* ═══════════════════════════════════════════════════════════════
   UTILIDAD — Exportar CSV genérico
═══════════════════════════════════════════════════════════════ */

export function exportarCSV(headers, rows, nombreArchivo = 'reporte') {
  const esc = cell => `"${String(cell ?? '').replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${nombreArchivo}_${hoyISO()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
