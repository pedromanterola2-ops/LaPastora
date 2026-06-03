import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Receipt, TrendingUp, AlertTriangle,
  ShoppingCart, RefreshCw, ArrowRight, Truck,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Tooltip, Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { moneda, fechaCorta, ESTADO_VIAJE, totalGastosViaje, totalMerchViaje } from '../lib/format'
import {
  getVentasHoyPorPunto,
  getVentas7Dias,
  getUltimosViajes,
  getCountAlertas,
} from '../lib/reportes'
import AlertasInventario from '../components/inventario/AlertasInventario'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

/* ─── Helpers ─────────────────────────────────────────────────── */
const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function labelDia(fechaStr) {
  const d = new Date(`${fechaStr}T12:00:00`)
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)
  const diff = Math.round((hoy - d) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return diasSemana[d.getDay()]
}

/* ─── Tarjeta de métrica ────────────────────────────────────────── */
function MetricCard({ label, value, sub, icon: Icon, colorBg, colorIcon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all w-full"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
          <p className="text-xl font-semibold text-slate-800 mt-0.5 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${colorBg}`}>
          <Icon size={17} className={colorIcon} />
        </div>
      </div>
    </button>
  )
}

/* ─── Gráfica 7 días ─────────────────────────────────────────────── */
function Grafica7Dias({ datos, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="h-4 bg-slate-100 rounded w-48 mb-4 animate-pulse" />
        <div className="h-40 bg-slate-50 rounded-lg animate-pulse" />
      </div>
    )
  }

  const labels   = datos.map(d => labelDia(d.fecha))
  const maxVal   = Math.max(...datos.map(d => d.puntoA + d.puntoB), 1)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Punto A',
        data:  datos.map(d => d.puntoA),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Punto B',
        data:  datos.map(d => d.puntoB),
        backgroundColor: '#22c55e',
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 12 }, boxWidth: 12, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${moneda(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        stacked: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 11 },
          callback: v => {
            if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
            return `$${v}`
          },
        },
        suggestedMax: maxVal * 1.15,
      },
    },
  }

  const totalSemana = datos.reduce((a, d) => a + d.puntoA + d.puntoB, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Ventas — últimos 7 días</h2>
          <p className="text-xs text-slate-400 mt-0.5">Total: {moneda(totalSemana)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />Punto A
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />Punto B
          </span>
        </div>
      </div>
      <div style={{ height: 180 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}

/* ─── Últimos viajes ─────────────────────────────────────────────── */
function UltimosViajes({ viajes, loading, onVerTodos }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="h-4 bg-slate-100 rounded w-40 mb-4 animate-pulse" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Últimos viajes de compra</h2>
        <button
          onClick={onVerTodos}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
        >
          Ver todos <ArrowRight size={11} />
        </button>
      </div>

      {viajes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
          <Truck size={26} strokeWidth={1.2} />
          <p className="text-xs">Sin viajes registrados</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {viajes.map(v => {
            const est = ESTADO_VIAJE[v.estado] || ESTADO_VIAJE.planeado
            return (
              <li key={v.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{v.proveedor}</p>
                  <p className="text-xs text-slate-400">{fechaCorta(v.fecha)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-700 tabular-nums">
                    {moneda(v.costo_total)}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${est.cls}`}>
                    {est.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ─── Dashboard principal ────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()

  const [loading,     setLoading]     = useState(true)
  const [ventasHoy,   setVentasHoy]   = useState(null)
  const [ventas7d,    setVentas7d]    = useState([])
  const [viajes,      setViajes]      = useState([])
  const [numAlertas,  setNumAlertas]  = useState(0)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const [vh, v7, vj, na] = await Promise.all([
        getVentasHoyPorPunto(),
        getVentas7Dias(),
        getUltimosViajes(5),
        getCountAlertas(),
      ])
      setVentasHoy(vh)
      setVentas7d(v7)
      setViajes(vj)
      setNumAlertas(na)
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  /* ── Tarjetas superiores ── */
  const tarjetas = [
    {
      label:     'Ventas hoy — Punto A',
      value:     ventasHoy ? moneda(ventasHoy.puntoA) : '—',
      sub:       ventasHoy ? `Total: ${moneda(ventasHoy.total)}` : undefined,
      icon:      Receipt,
      colorBg:   'bg-blue-50',
      colorIcon: 'text-blue-600',
      onClick:   () => navigate('/ventas'),
    },
    {
      label:     'Ventas hoy — Punto B',
      value:     ventasHoy ? moneda(ventasHoy.puntoB) : '—',
      sub:       ventasHoy ? `${ventasHoy.numVentas} venta${ventasHoy.numVentas !== 1 ? 's' : ''}` : undefined,
      icon:      TrendingUp,
      colorBg:   'bg-green-50',
      colorIcon: 'text-green-600',
      onClick:   () => navigate('/ventas'),
    },
    {
      label:     'Alertas activas',
      value:     loading ? '—' : numAlertas,
      sub:       numAlertas > 0 ? 'Stock bajo en inventario' : 'Sin alertas urgentes',
      icon:      AlertTriangle,
      colorBg:   numAlertas > 0 ? 'bg-red-50'    : 'bg-emerald-50',
      colorIcon: numAlertas > 0 ? 'text-red-500' : 'text-emerald-500',
      onClick:   () => navigate('/inventario'),
    },
    {
      label:     'Productos en sistema',
      value:     '—',  // se actualiza abajo vía AlertasInventario que ya consulta inventario_resumen
      sub:       'Ver inventario completo',
      icon:      Package,
      colorBg:   'bg-slate-50',
      colorIcon: 'text-slate-500',
      onClick:   () => navigate('/inventario'),
    },
  ]

  return (
    <div className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={cargar}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Actualizar datos"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── Tarjetas de resumen ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tarjetas.map(t => (
          <MetricCard key={t.label} {...t} />
        ))}
      </div>

      {/* ── Gráfica + Alertas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Grafica7Dias datos={ventas7d} loading={loading} />
        <AlertasInventario />
      </div>

      {/* ── Últimos viajes + Accesos rápidos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UltimosViajes
          viajes={viajes}
          loading={loading}
          onVerTodos={() => navigate('/viajes')}
        />

        {/* Accesos rápidos */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Nueva venta',       icon: Receipt,      path: '/ventas',              bg: 'bg-blue-50',    txt: 'text-blue-700'  },
              { label: 'Nuevo viaje',        icon: Truck,        path: '/viajes/nuevo',        bg: 'bg-amber-50',   txt: 'text-amber-700' },
              { label: 'Ver inventario',     icon: Package,      path: '/inventario',          bg: 'bg-slate-50',   txt: 'text-slate-700' },
              { label: 'Ver reportes',       icon: TrendingUp,   path: '/reportes',            bg: 'bg-indigo-50',  txt: 'text-indigo-700'},
            ].map(({ label, icon: Icon, path, bg, txt }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2 p-3 rounded-xl ${bg} hover:opacity-80 transition-opacity text-left`}
              >
                <Icon size={15} className={txt} />
                <span className={`text-xs font-medium ${txt}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
