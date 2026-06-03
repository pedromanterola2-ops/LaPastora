import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, AlertCircle, CheckCircle, Package, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { moneda, fechaLarga } from '../lib/format'

/* ─── Helpers ────────────────────────────────────────────────── */
function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function semaforo(dias) {
  if (dias === null) return { nivel: 'sin-datos', icon: Package, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Sin ventas recientes' }
  if (dias <= 0)     return { nivel: 'agotado',  icon: AlertCircle, color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'Agotado' }
  if (dias < 7)      return { nivel: 'critico',  icon: AlertTriangle, color: 'text-red-600',  bg: 'bg-red-50',    border: 'border-red-200',    label: `${dias}d de stock` }
  if (dias < 15)     return { nivel: 'alerta',   icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',  label: `${dias}d de stock` }
  return               { nivel: 'ok',       icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: `${dias}d de stock` }
}

/* ─── Página ─────────────────────────────────────────────────── */
export default function ViajePlanificacion() {
  const navigate         = useNavigate()
  const { id: viajeId }  = useParams()

  const [viaje,    setViaje]    = useState(null)
  const [productos, setProductos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [orden,    setOrden]    = useState('urgencia') // 'urgencia' | 'nombre' | 'stock'

  useEffect(() => { cargarDatos() }, [viajeId])

  async function cargarDatos() {
    setLoading(true)
    try {
      /* 1 — Datos del viaje (para mostrar proveedor/fecha en el header) */
      const { data: vData } = await supabase
        .from('viajes_compra')
        .select('id, fecha, proveedor_id, proveedores(nombre)')
        .eq('id', viajeId)
        .single()
      setViaje(vData)

      /* 2 — Stock actual (view inventario_resumen) */
      const { data: stock } = await supabase
        .from('inventario_resumen')
        .select('*')

      /* 3 — Ventas de los últimos 30 días */
      const hace30 = new Date()
      hace30.setDate(hace30.getDate() - 30)
      const hace30Str = hace30.toISOString()

      const { data: ventasIds } = await supabase
        .from('ventas')
        .select('id')
        .gte('fecha', hace30Str)

      let ventas30 = {}
      if (ventasIds && ventasIds.length > 0) {
        const ids = ventasIds.map(v => v.id)
        const { data: itemsVenta } = await supabase
          .from('items_venta')
          .select('producto_id, cantidad')
          .in('venta_id', ids)

        itemsVenta?.forEach(iv => {
          ventas30[iv.producto_id] = (ventas30[iv.producto_id] || 0) + Number(iv.cantidad)
        })
      }

      /* 4 — Combinar y calcular */
      const resultado = (stock || []).map(p => {
        const vendido30 = ventas30[p.producto_id] || 0
        const avgDiario = vendido30 / 30
        const diasStock = avgDiario > 0
          ? Math.round(p.stock_total / avgDiario)
          : null
        const fechaAgotamiento = diasStock !== null
          ? addDays(new Date(), diasStock)
          : null

        return { ...p, vendido30, avgDiario, diasStock, fechaAgotamiento }
      })

      setProductos(resultado)
    } catch (err) {
      console.error('Error cargando planificación:', err)
    } finally {
      setLoading(false)
    }
  }

  /* ── Ordenamiento ── */
  const productosOrdenados = [...productos].sort((a, b) => {
    if (orden === 'urgencia') {
      // Primero agotados, luego por días asc, luego sin datos al final
      const da = a.diasStock ?? 9999
      const db = b.diasStock ?? 9999
      return da - db
    }
    if (orden === 'stock') return a.stock_total - b.stock_total
    return a.nombre.localeCompare(b.nombre)
  })

  /* ── Métricas resumen ── */
  const criticos = productos.filter(p => p.diasStock !== null && p.diasStock < 7).length
  const alertas  = productos.filter(p => p.diasStock !== null && p.diasStock >= 7 && p.diasStock < 15).length

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 border-b-2 border-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(`/viajes/${viajeId}`)}
          className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-800">Planificación de Compra</h1>
          {viaje && (
            <p className="text-sm text-slate-500 mt-0.5">
              Viaje a <strong>{viaje.proveedores?.nombre}</strong> · {fechaLarga(viaje.fecha)}
            </p>
          )}
        </div>
        <button
          onClick={cargarDatos}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* ── Resumen rápido ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{criticos}</p>
          <p className="text-xs text-red-600 mt-0.5">Críticos (&lt; 7 días)</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{alertas}</p>
          <p className="text-xs text-amber-600 mt-0.5">En alerta (7–14 días)</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{productos.length - criticos - alertas}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Con buen stock</p>
        </div>
      </div>

      {/* ── Leyenda + Orden ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1.5 text-red-600">
            <AlertTriangle size={12} /><span className="font-medium">Rojo:</span> menos de 7 días
          </span>
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle size={12} /><span className="font-medium">Amarillo:</span> 7–14 días
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle size={12} /><span className="font-medium">Verde:</span> 15+ días
          </span>
        </div>
        <select
          value={orden}
          onChange={e => setOrden(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none"
        >
          <option value="urgencia">Ordenar: por urgencia</option>
          <option value="stock">Ordenar: por stock</option>
          <option value="nombre">Ordenar: por nombre</option>
        </select>
      </div>

      {/* ── Tabla principal ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Cabecera (desktop) */}
        <div className="hidden sm:grid sm:grid-cols-[minmax(160px,2fr)_repeat(5,1fr)_140px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Producto</span>
          <span className="text-right">Central</span>
          <span className="text-right">Punto A</span>
          <span className="text-right">Punto B</span>
          <span className="text-right">Total</span>
          <span className="text-right">Prom/día</span>
          <span className="text-right">Stock disponible</span>
        </div>

        <div className="divide-y divide-slate-100">
          {productosOrdenados.map(p => {
            const s     = semaforo(p.diasStock)
            const Icon  = s.icon

            return (
              <div key={p.producto_id} className={`px-5 py-4 ${p.diasStock !== null && p.diasStock < 7 ? 'bg-red-50/30' : ''}`}>

                {/* Layout desktop */}
                <div className="hidden sm:grid sm:grid-cols-[minmax(160px,2fr)_repeat(5,1fr)_140px] gap-3 items-center">
                  {/* Producto */}
                  <div>
                    <p className="font-semibold text-slate-800 text-sm leading-tight">{p.nombre}</p>
                    {p.categoria && <p className="text-xs text-slate-400 mt-0.5">{p.categoria}</p>}
                  </div>

                  {/* Stock por ubicación */}
                  <p className="text-right text-sm text-slate-700">{p.stock_central} <span className="text-xs text-slate-400">{p.unidad_venta}</span></p>
                  <p className="text-right text-sm text-slate-700">{p.stock_punto_a} <span className="text-xs text-slate-400">{p.unidad_venta}</span></p>
                  <p className="text-right text-sm text-slate-700">{p.stock_punto_b} <span className="text-xs text-slate-400">{p.unidad_venta}</span></p>
                  <p className="text-right text-sm font-semibold text-slate-800">{p.stock_total} <span className="text-xs font-normal text-slate-400">{p.unidad_venta}</span></p>

                  {/* Promedio */}
                  <p className="text-right text-sm text-slate-600">
                    {p.avgDiario > 0
                      ? `${p.avgDiario.toFixed(1)} ${p.unidad_venta}`
                      : <span className="text-slate-300">—</span>
                    }
                  </p>

                  {/* Días de stock */}
                  <div className="flex items-center justify-end gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${s.bg} ${s.border} ${s.color}`}>
                      <Icon size={12} />
                      {s.label}
                    </div>
                  </div>
                </div>

                {/* Fecha estimada agotamiento */}
                {p.fechaAgotamiento && p.diasStock !== null && p.diasStock < 30 && (
                  <div className="hidden sm:block mt-1.5 text-xs text-slate-400 pl-0">
                    Se agota aprox. el {p.fechaAgotamiento.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                  </div>
                )}

                {/* Layout mobile (card style) */}
                <div className="sm:hidden">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{p.nombre}</p>
                      {p.categoria && <p className="text-xs text-slate-400">{p.categoria}</p>}
                    </div>
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${s.bg} ${s.border} ${s.color} shrink-0`}>
                      <Icon size={11} />
                      {s.label}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400 mb-0.5">Stock total</p>
                      <p className="font-bold text-slate-800">{p.stock_total} {p.unidad_venta}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400 mb-0.5">Prom. diario</p>
                      <p className="font-bold text-slate-800">
                        {p.avgDiario > 0 ? `${p.avgDiario.toFixed(1)} ${p.unidad_venta}` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400 mb-0.5">Central</p>
                      <p className="font-medium text-slate-700">{p.stock_central}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400 mb-0.5">Punto A / Punto B</p>
                      <p className="font-medium text-slate-700">{p.stock_punto_a} / {p.stock_punto_b}</p>
                    </div>
                  </div>
                  {p.fechaAgotamiento && p.diasStock !== null && p.diasStock < 30 && (
                    <p className="mt-2 text-xs text-slate-400">
                      Se agota aprox. el {p.fechaAgotamiento.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {productos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Package size={36} strokeWidth={1.2} />
            <p className="text-sm">Sin productos en el catálogo</p>
          </div>
        )}
      </div>

      {/* ── Nota ── */}
      <p className="text-xs text-slate-400 text-center">
        Stock basado en el inventario actual · Promedio de ventas de los últimos 30 días ·
        Los días de stock son estimados
      </p>
    </div>
  )
}
