import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, TrendingDown, Package, ArrowRight, RefreshCw } from 'lucide-react'
import { fechaCorta } from '../../lib/format'
import {
  getAlertasStockBajo,
  getProductosProximosACaducar,
  getProductosEstancados,
} from '../../lib/inventario'

/* ─── Sección de alerta individual ──────────────────────────── */
function AlertSection({ icon, title, colorClass, items, total, actionLabel, onAction }) {
  return (
    <div className={`rounded-xl border p-3 ${colorClass.bg} ${colorClass.border}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className={`text-xs font-semibold ${colorClass.text}`}>{title}</p>
        </div>
        <button
          onClick={onAction}
          className={`text-xs font-medium shrink-0 flex items-center gap-1 transition-colors ${colorClass.btn}`}
        >
          {actionLabel}
          <ArrowRight size={11} />
        </button>
      </div>
      <ul className={`text-xs space-y-0.5 ${colorClass.text} opacity-80`}>
        {items.slice(0, 3).map((item, i) => (
          <li key={i}>• {item}</li>
        ))}
        {total > 3 && (
          <li className="opacity-50">…y {total - 3} más</li>
        )}
      </ul>
    </div>
  )
}

const COLOR = {
  rojo:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   btn: 'text-red-600 hover:text-red-800' },
  amber:  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', btn: 'text-amber-600 hover:text-amber-800' },
  azul:   { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  btn: 'text-blue-600 hover:text-blue-800' },
}

/* ─── Panel principal ────────────────────────────────────────── */
export default function AlertasInventario() {
  const navigate = useNavigate()

  const [loading,    setLoading]    = useState(true)
  const [stockBajo,  setStockBajo]  = useState([])
  const [caducidad,  setCaducidad]  = useState([])
  const [estancados, setEstancados] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const [s, c, e] = await Promise.all([
        getAlertasStockBajo(),
        getProductosProximosACaducar(7),
        getProductosEstancados(15),
      ])
      setStockBajo(s)
      setCaducidad(c)
      setEstancados(e)
    } catch (err) {
      console.error('Error al cargar alertas:', err)
    } finally {
      setLoading(false)
    }
  }

  const total = stockBajo.length + caducidad.length + estancados.length

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="h-4 bg-slate-100 rounded w-40 mb-4 animate-pulse" />
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  /* ── Sin alertas ── */
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Alertas de inventario</h2>
          <button onClick={cargar} className="text-slate-400 hover:text-slate-600 transition-colors" title="Actualizar">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-5 gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <Package size={18} className="text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-emerald-600">Sin alertas activas</p>
          <p className="text-xs text-slate-400">El inventario está en orden</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Alertas de inventario</h2>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="text-slate-400 hover:text-slate-600 transition-colors" title="Actualizar">
            <RefreshCw size={14} />
          </button>
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
            {total}
          </span>
        </div>
      </div>

      {/* Stock bajo */}
      {stockBajo.length > 0 && (
        <AlertSection
          icon={<AlertTriangle size={13} className="text-red-500 shrink-0" />}
          title={`${stockBajo.length} producto${stockBajo.length !== 1 ? 's' : ''} con stock bajo`}
          colorClass={COLOR.rojo}
          items={stockBajo.map(p => {
            const partes = []
            if (p.stock_central < (p.existencia_minima || 0)) partes.push('Central')
            if (p.stock_punto_a < (p.existencia_minima || 0)) partes.push('Punto A')
            if (p.stock_punto_b < (p.existencia_minima || 0)) partes.push('Punto B')
            return `${p.nombre}${partes.length ? ` (${partes.join(', ')})` : ''}`
          })}
          total={stockBajo.length}
          actionLabel="Ver inventario"
          onAction={() => navigate('/inventario?alerta=1')}
        />
      )}

      {/* Próximos a caducar */}
      {caducidad.length > 0 && (
        <AlertSection
          icon={<Clock size={13} className="text-amber-500 shrink-0" />}
          title={`${caducidad.length} producto${caducidad.length !== 1 ? 's' : ''} próximos a caducar`}
          colorClass={COLOR.amber}
          items={caducidad.map(p =>
            `${p.nombre} — ${p.dias_restantes === 0 ? 'hoy' : `en ${p.dias_restantes} día${p.dias_restantes !== 1 ? 's' : ''}`} (est.)`
          )}
          total={caducidad.length}
          actionLabel="Ver inventario"
          onAction={() => navigate('/inventario')}
        />
      )}

      {/* Estancados */}
      {estancados.length > 0 && (
        <AlertSection
          icon={<TrendingDown size={13} className="text-blue-500 shrink-0" />}
          title={`${estancados.length} producto${estancados.length !== 1 ? 's' : ''} sin ventas en 15 días`}
          colorClass={COLOR.azul}
          items={estancados.map(p => `${p.nombre} (stock: ${p.stock_total})`)}
          total={estancados.length}
          actionLabel="Ver historial"
          onAction={() => navigate('/inventario?tab=historial')}
        />
      )}
    </div>
  )
}
