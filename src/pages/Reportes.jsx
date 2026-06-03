import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  BarChart3, Download, RefreshCw, ChevronUp, ChevronDown,
  AlertTriangle, Package, ShoppingBag, TrendingUp, Truck, Clock,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { moneda, fechaCorta, fechaLarga, ESTADO_VIAJE } from '../lib/format'
import {
  getRotacionPorPunto,
  getReporteVentas,
  getReporteEstancados,
  getReporteRentabilidad,
  getReporteViajes,
  getReporteCaducidad,
  exportarCSV,
} from '../lib/reportes'

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Tooltip, Legend
)

/* ═══════════════════════════════════════════════════════════════
   HELPERS / COMPONENTES COMPARTIDOS
═══════════════════════════════════════════════════════════════ */

function hoy() {
  return new Date().toISOString().split('T')[0]
}
function hace30() {
  const d = new Date(); d.setDate(d.getDate() - 29)
  return d.toISOString().split('T')[0]
}
function hace90() {
  const d = new Date(); d.setDate(d.getDate() - 89)
  return d.toISOString().split('T')[0]
}
function inicioMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/* ── Filtro de fechas ── */
function FiltroFechas({ desde, hasta, onChange, extras }) {
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="text-xs text-slate-500 block mb-1">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={e => onChange({ desde: e.target.value, hasta })}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={e => onChange({ desde, hasta: e.target.value })}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      {extras}
      {/* Atajos */}
      <div className="flex gap-1">
        {[
          { label: 'Este mes',  fn: () => onChange({ desde: inicioMes(), hasta: hoy() }) },
          { label: '30 días',   fn: () => onChange({ desde: hace30(),    hasta: hoy() }) },
          { label: '3 meses',   fn: () => onChange({ desde: hace90(),    hasta: hoy() }) },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Botón exportar CSV ── */
function BtnExportar({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
    >
      <Download size={13} />
      CSV
    </button>
  )
}

/* ── Estado vacío ── */
function Vacio({ mensaje = 'Sin datos para el período seleccionado' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
      <BarChart3 size={32} strokeWidth={1.2} />
      <p className="text-sm">{mensaje}</p>
    </div>
  )
}

/* ── Skeleton de tabla ── */
function SkeletonTabla({ cols = 5, rows = 5 }) {
  return (
    <div className="space-y-2 mt-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-8 bg-slate-100 rounded flex-1 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── Cabecera ordenable ── */
function Th({ children, campo, orden, onSort, className = '' }) {
  const activo = orden.campo === campo
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold text-slate-600 cursor-pointer select-none hover:text-slate-800 whitespace-nowrap ${className}`}
      onClick={() => onSort(campo)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {activo
          ? (orden.asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronDown size={12} className="opacity-30" />}
      </span>
    </th>
  )
}

function useOrden(campoInicial, ascInicial = false) {
  const [orden, setOrden] = useState({ campo: campoInicial, asc: ascInicial })
  const onSort = campo => setOrden(o => ({
    campo,
    asc: o.campo === campo ? !o.asc : false,
  }))
  function ordenar(arr) {
    return [...arr].sort((a, b) => {
      const va = a[orden.campo]
      const vb = b[orden.campo]
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return orden.asc ? cmp : -cmp
    })
  }
  return { orden, onSort, ordenar }
}

/* ── Badge de estado viaje ── */
function BadgeEstado({ estado }) {
  const e = ESTADO_VIAJE[estado] || ESTADO_VIAJE.planeado
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${e.cls}`}>
      {e.label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 1 — ROTACIÓN POR PUNTO
═══════════════════════════════════════════════════════════════ */
function ReporteRotacion() {
  const [rango,   setRango]   = useState({ desde: hace30(), hasta: hoy() })
  const [datos,   setDatos]   = useState(null)
  const [loading, setLoading] = useState(false)
  const { orden, onSort, ordenar } = useOrden('total_uds')

  async function cargar() {
    setLoading(true)
    try {
      const d = await getRotacionPorPunto(rango)
      setDatos(d)
    } finally {
      setLoading(false)
    }
  }

  function exportar() {
    if (!datos?.length) return
    exportarCSV(
      ['Producto', 'Categoría', 'Uds. Punto A', 'Uds. Punto B', 'Total uds.', '% Punto A', '% Punto B', 'Ingresos A', 'Ingresos B', 'Total ingresos'],
      datos.map(r => [r.nombre, r.categoria, r.uds_a, r.uds_b, r.total_uds, r.pct_a, r.pct_b, r.ing_a.toFixed(2), r.ing_b.toFixed(2), r.total_ing.toFixed(2)]),
      'rotacion_por_punto'
    )
  }

  const filas = datos ? ordenar(datos) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroFechas desde={rango.desde} hasta={rango.hasta} onChange={setRango} />
        <div className="flex gap-2">
          <BtnExportar onClick={exportar} disabled={!datos?.length} />
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Generar
          </button>
        </div>
      </div>

      {!datos && !loading && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">Selecciona el período y presiona <strong>Generar</strong></p>
        </div>
      )}
      {loading && <SkeletonTabla cols={6} />}
      {datos && !loading && (
        <>
          {filas.length === 0 ? <Vacio /> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <Th campo="nombre"    orden={orden} onSort={onSort}>Producto</Th>
                    <Th campo="categoria" orden={orden} onSort={onSort}>Categoría</Th>
                    <Th campo="uds_a"     orden={orden} onSort={onSort} className="text-right">Uds. Punto A</Th>
                    <Th campo="uds_b"     orden={orden} onSort={onSort} className="text-right">Uds. Punto B</Th>
                    <Th campo="total_uds" orden={orden} onSort={onSort} className="text-right">Total</Th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">% por punto</th>
                    <Th campo="total_ing" orden={orden} onSort={onSort} className="text-right">Ingresos</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map(r => (
                    <tr key={r.producto_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[160px] truncate">{r.nombre}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs">{r.categoria || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.uds_a}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.uds_b}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.total_uds}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 min-w-[110px]">
                          <div className="flex-1 h-2 bg-green-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${r.pct_a}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-14 text-right">
                            {r.pct_a}% / {r.pct_b}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{moneda(r.total_ing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 2 — VENTAS
═══════════════════════════════════════════════════════════════ */
function ReporteVentas() {
  const [rango,      setRango]      = useState({ desde: hace30(), hasta: hoy() })
  const [agrupacion, setAgrupacion] = useState('dia')
  const [datos,      setDatos]      = useState(null)
  const [loading,    setLoading]    = useState(false)
  const { orden, onSort, ordenar }  = useOrden('periodo', false)

  async function cargar() {
    setLoading(true)
    try {
      const d = await getReporteVentas({ ...rango, agrupacion })
      setDatos(d)
    } finally {
      setLoading(false)
    }
  }

  function exportar() {
    if (!datos?.length) return
    exportarCSV(
      ['Período', 'Total', 'Punto A', 'Punto B', 'Efectivo', 'Tarjeta', 'Transferencia', '# Ventas'],
      datos.map(r => [r.periodo, r.total.toFixed(2), r.punto_a.toFixed(2), r.punto_b.toFixed(2), r.efectivo.toFixed(2), r.tarjeta.toFixed(2), r.transferencia.toFixed(2), r.num_ventas]),
      'ventas_por_periodo'
    )
  }

  const filas = datos ? ordenar(datos) : []
  const totalGlobal = (datos || []).reduce((a, r) => a + r.total, 0)

  // Gráfica
  const chartData = datos ? {
    labels: datos.map(r => r.periodo.length === 7 ? r.periodo : fechaCorta(r.periodo)),
    datasets: [
      { label: 'Punto A', data: datos.map(r => r.punto_a), backgroundColor: '#3b82f6', borderRadius: 4, borderSkipped: false },
      { label: 'Punto B', data: datos.map(r => r.punto_b), backgroundColor: '#22c55e', borderRadius: 4, borderSkipped: false },
    ],
  } : null

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } },
      tooltip: { callbacks: { label: ctx => ` ${moneda(ctx.raw)}` } },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
      y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}` } },
    },
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroFechas
          desde={rango.desde}
          hasta={rango.hasta}
          onChange={setRango}
          extras={
            <div>
              <label className="text-xs text-slate-500 block mb-1">Agrupar por</label>
              <select
                value={agrupacion}
                onChange={e => setAgrupacion(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
              </select>
            </div>
          }
        />
        <div className="flex gap-2">
          <BtnExportar onClick={exportar} disabled={!datos?.length} />
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Generar
          </button>
        </div>
      </div>

      {!datos && !loading && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">Selecciona el período y presiona <strong>Generar</strong></p>
        </div>
      )}
      {loading && <SkeletonTabla cols={5} />}

      {datos && !loading && filas.length === 0 && <Vacio />}

      {datos && !loading && filas.length > 0 && (
        <>
          {/* Gráfica */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3">
              Total del período: <span className="text-blue-600">{moneda(totalGlobal)}</span>
            </p>
            <div style={{ height: 200 }}>
              <Bar data={chartData} options={chartOpts} />
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th campo="periodo"       orden={orden} onSort={onSort}>Período</Th>
                  <Th campo="total"         orden={orden} onSort={onSort} className="text-right">Total</Th>
                  <Th campo="punto_a"       orden={orden} onSort={onSort} className="text-right">Punto A</Th>
                  <Th campo="punto_b"       orden={orden} onSort={onSort} className="text-right">Punto B</Th>
                  <Th campo="efectivo"      orden={orden} onSort={onSort} className="text-right">Efectivo</Th>
                  <Th campo="tarjeta"       orden={orden} onSort={onSort} className="text-right">Tarjeta</Th>
                  <Th campo="transferencia" orden={orden} onSort={onSort} className="text-right">Transf.</Th>
                  <Th campo="num_ventas"    orden={orden} onSort={onSort} className="text-right"># Ventas</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map(r => (
                  <tr key={r.periodo} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      {r.periodo.length === 7 ? r.periodo : fechaCorta(r.periodo)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{moneda(r.total)}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600 tabular-nums">{moneda(r.punto_a)}</td>
                    <td className="px-3 py-2.5 text-right text-green-600 tabular-nums">{moneda(r.punto_b)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{moneda(r.efectivo)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{moneda(r.tarjeta)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{moneda(r.transferencia)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{r.num_ventas}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-600">TOTAL</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800">{moneda(totalGlobal)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-600 tabular-nums">{moneda((datos||[]).reduce((a,r)=>a+r.punto_a,0))}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-600 tabular-nums">{moneda((datos||[]).reduce((a,r)=>a+r.punto_b,0))}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 3 — PRODUCTOS ESTANCADOS
═══════════════════════════════════════════════════════════════ */
function ReporteEstancados() {
  const [dias,    setDias]    = useState(15)
  const [datos,   setDatos]   = useState(null)
  const [loading, setLoading] = useState(false)
  const { orden, onSort, ordenar } = useOrden('valor_total')

  async function cargar() {
    setLoading(true)
    try {
      const d = await getReporteEstancados({ dias })
      setDatos(d)
    } finally {
      setLoading(false)
    }
  }

  function exportar() {
    if (!datos?.length) return
    exportarCSV(
      ['Producto', 'Categoría', 'Stock Central', 'Stock Punto A', 'Stock Punto B', 'Stock Total', 'Costo Unit.', 'Valor Estimado'],
      datos.map(r => [r.nombre, r.categoria || '', r.stock_central, r.stock_punto_a, r.stock_punto_b, r.stock_total, r.costo_unitario.toFixed(2), r.valor_total.toFixed(2)]),
      'productos_estancados'
    )
  }

  const filas = datos ? ordenar(datos) : []
  const valorTotal = (datos || []).reduce((a, r) => a + r.valor_total, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Sin ventas en los últimos</label>
            <select
              value={dias}
              onChange={e => setDias(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value={7}>7 días</option>
              <option value={15}>15 días</option>
              <option value={30}>30 días</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <BtnExportar onClick={exportar} disabled={!datos?.length} />
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Generar
          </button>
        </div>
      </div>

      {!datos && !loading && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">Presiona <strong>Generar</strong> para buscar productos sin ventas</p>
        </div>
      )}
      {loading && <SkeletonTabla cols={6} />}

      {datos && !loading && (
        <>
          {filas.length === 0 ? (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
              <p className="text-sm font-medium text-emerald-700">✓ No hay productos estancados en este período</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>{filas.length} producto{filas.length !== 1 ? 's' : ''}</strong> sin ventas en {dias} días —
                  valor inventario parado: <strong>{moneda(valorTotal)}</strong>
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <Th campo="nombre"      orden={orden} onSort={onSort}>Producto</Th>
                      <Th campo="categoria"   orden={orden} onSort={onSort}>Categoría</Th>
                      <Th campo="stock_central" orden={orden} onSort={onSort} className="text-right">Central</Th>
                      <Th campo="stock_punto_a" orden={orden} onSort={onSort} className="text-right">Punto A</Th>
                      <Th campo="stock_punto_b" orden={orden} onSort={onSort} className="text-right">Punto B</Th>
                      <Th campo="stock_total"   orden={orden} onSort={onSort} className="text-right">Total</Th>
                      <Th campo="costo_unitario" orden={orden} onSort={onSort} className="text-right">Costo unit.</Th>
                      <Th campo="valor_total"    orden={orden} onSort={onSort} className="text-right">Valor parado</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map(r => (
                      <tr key={r.producto_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[150px] truncate">{r.nombre}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{r.categoria || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.stock_central}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.stock_punto_a}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.stock_punto_b}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.stock_total}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                          {r.costo_unitario > 0 ? moneda(r.costo_unitario) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-amber-700 tabular-nums">
                          {r.valor_total > 0 ? moneda(r.valor_total) : <span className="text-slate-400 font-normal">Sin costo</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 4 — RENTABILIDAD
═══════════════════════════════════════════════════════════════ */
function ReporteRentabilidad() {
  const [rango,   setRango]   = useState({ desde: hace90(), hasta: hoy() })
  const [datos,   setDatos]   = useState(null)
  const [loading, setLoading] = useState(false)
  const { orden, onSort, ordenar } = useOrden('margen_pct')

  async function cargar() {
    setLoading(true)
    try {
      const d = await getReporteRentabilidad(rango)
      setDatos(d)
    } finally {
      setLoading(false)
    }
  }

  function exportar() {
    if (!datos?.length) return
    exportarCSV(
      ['Producto', 'Categoría', 'Uds. Vendidas', 'Precio Prom.', 'Costo Prom.', 'Margen $', 'Margen %', 'Utilidad Total'],
      datos.map(r => [r.nombre, r.categoria || '', r.uds_vendidas, r.precio_prom.toFixed(2), r.costo_prom.toFixed(2), r.margen_pesos.toFixed(2), r.margen_pct.toFixed(1), r.utilidad_total.toFixed(2)]),
      'rentabilidad'
    )
  }

  const filas   = datos ? ordenar(datos) : []
  const utilTotal = (datos || []).reduce((a, r) => a + r.utilidad_total, 0)
  const sinCosto  = (datos || []).filter(r => r.costo_prom === 0).length

  function clsMargen(pct) {
    if (pct < 0)   return 'text-red-600 font-semibold'
    if (pct < 10)  return 'text-orange-600 font-semibold'
    if (pct >= 40) return 'text-emerald-700 font-semibold'
    return 'text-slate-700'
  }

  function bgRowMargen(pct) {
    if (pct < 0)  return 'bg-red-50'
    if (pct < 10) return 'bg-orange-50'
    return ''
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroFechas desde={rango.desde} hasta={rango.hasta} onChange={setRango} />
        <div className="flex gap-2">
          <BtnExportar onClick={exportar} disabled={!datos?.length} />
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Generar
          </button>
        </div>
      </div>

      {!datos && !loading && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">Selecciona el período y presiona <strong>Generar</strong></p>
        </div>
      )}
      {loading && <SkeletonTabla cols={6} />}

      {datos && !loading && (
        <>
          {filas.length === 0 ? <Vacio mensaje="Sin ventas en el período seleccionado" /> : (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Utilidad total estimada</p>
                  <p className={`text-lg font-bold tabular-nums ${utilTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{moneda(utilTotal)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Productos en rojo (&lt;10%)</p>
                  <p className="text-lg font-bold text-orange-600 tabular-nums">
                    {(datos || []).filter(r => r.margen_pct < 10 && r.costo_prom > 0).length}
                  </p>
                </div>
                {sinCosto > 0 && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
                    <p className="text-xs text-amber-700">Sin costo registrado</p>
                    <p className="text-lg font-bold text-amber-700 tabular-nums">{sinCosto}</p>
                  </div>
                )}
              </div>

              {/* Leyenda */}
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 inline-block border border-red-200" /> Margen negativo</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 inline-block border border-orange-200" /> Margen &lt; 10%</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <Th campo="nombre"         orden={orden} onSort={onSort}>Producto</Th>
                      <Th campo="categoria"      orden={orden} onSort={onSort}>Categoría</Th>
                      <Th campo="uds_vendidas"   orden={orden} onSort={onSort} className="text-right">Uds.</Th>
                      <Th campo="precio_prom"    orden={orden} onSort={onSort} className="text-right">Precio prom.</Th>
                      <Th campo="costo_prom"     orden={orden} onSort={onSort} className="text-right">Costo prom.</Th>
                      <Th campo="margen_pesos"   orden={orden} onSort={onSort} className="text-right">Margen $</Th>
                      <Th campo="margen_pct"     orden={orden} onSort={onSort} className="text-right">Margen %</Th>
                      <Th campo="utilidad_total" orden={orden} onSort={onSort} className="text-right">Utilidad total</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map(r => (
                      <tr key={r.producto_id} className={`hover:opacity-90 transition-colors ${bgRowMargen(r.costo_prom > 0 ? r.margen_pct : 100)}`}>
                        <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[150px] truncate">{r.nombre}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{r.categoria || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.uds_vendidas}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{moneda(r.precio_prom)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {r.costo_prom > 0 ? moneda(r.costo_prom) : <span className="text-slate-400 text-xs">Sin costo</span>}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${r.costo_prom > 0 ? clsMargen(r.margen_pct) : 'text-slate-400'}`}>
                          {r.costo_prom > 0 ? moneda(r.margen_pesos) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${r.costo_prom > 0 ? clsMargen(r.margen_pct) : 'text-slate-400'}`}>
                          {r.costo_prom > 0 ? `${r.margen_pct.toFixed(1)}%` : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.costo_prom > 0 ? clsMargen(r.margen_pct) : 'text-slate-400'}`}>
                          {r.costo_prom > 0 ? moneda(r.utilidad_total) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 5 — VIAJES DE COMPRA
═══════════════════════════════════════════════════════════════ */
function ReporteViajes() {
  const [rango,   setRango]   = useState({ desde: hace90(), hasta: hoy() })
  const [datos,   setDatos]   = useState(null)
  const [loading, setLoading] = useState(false)
  const { orden, onSort, ordenar } = useOrden('fecha', false)

  async function cargar() {
    setLoading(true)
    try {
      const d = await getReporteViajes(rango)
      setDatos(d)
    } finally {
      setLoading(false)
    }
  }

  function exportar() {
    if (!datos?.viajes?.length) return
    exportarCSV(
      ['Fecha', 'Proveedor', 'Ciudad', 'Estado', 'Mercancía', 'Gastos traslado', 'Costo total'],
      datos.viajes.map(r => [r.fecha, r.proveedor, r.ciudad, r.estado, r.total_merch.toFixed(2), r.total_gastos.toFixed(2), r.costo_total.toFixed(2)]),
      'viajes_compra'
    )
  }

  const filas = datos ? ordenar(datos.viajes) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroFechas desde={rango.desde} hasta={rango.hasta} onChange={setRango} />
        <div className="flex gap-2">
          <BtnExportar onClick={exportar} disabled={!datos?.viajes?.length} />
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Generar
          </button>
        </div>
      </div>

      {!datos && !loading && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">Selecciona el período y presiona <strong>Generar</strong></p>
        </div>
      )}
      {loading && <SkeletonTabla cols={5} />}

      {datos && !loading && (
        <>
          {filas.length === 0 ? <Vacio /> : (
            <>
              {/* Resumen global */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: '# Viajes',          value: datos.totalesGlobales.num_viajes,              fmt: v => v },
                  { label: 'Total mercancía',    value: datos.totalesGlobales.total_merch,             fmt: moneda },
                  { label: 'Total traslados',    value: datos.totalesGlobales.total_gastos,            fmt: moneda },
                  { label: 'Costo total',        value: datos.totalesGlobales.costo_total,             fmt: moneda },
                ].map(({ label, value, fmt }) => (
                  <div key={label} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-lg font-bold text-slate-800 tabular-nums">{fmt(value)}</p>
                  </div>
                ))}
              </div>

              {/* Promedio por proveedor */}
              {Object.keys(datos.porProveedor).length > 0 && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-2">Promedio por viaje por proveedor</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(datos.porProveedor).map(([nombre, info]) => (
                      <div key={nombre} className="text-xs text-blue-800">
                        <strong>{nombre}</strong>: {moneda(info.total / info.count)} / viaje ({info.count} viaje{info.count !== 1 ? 's' : ''})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <Th campo="fecha"        orden={orden} onSort={onSort}>Fecha</Th>
                      <Th campo="proveedor"    orden={orden} onSort={onSort}>Proveedor</Th>
                      <Th campo="ciudad"       orden={orden} onSort={onSort}>Ciudad</Th>
                      <Th campo="estado"       orden={orden} onSort={onSort}>Estado</Th>
                      <Th campo="total_merch"  orden={orden} onSort={onSort} className="text-right">Mercancía</Th>
                      <Th campo="total_gastos" orden={orden} onSort={onSort} className="text-right">Traslados</Th>
                      <Th campo="costo_total"  orden={orden} onSort={onSort} className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{fechaCorta(v.fecha)}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">{v.proveedor}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{v.ciudad}</td>
                        <td className="px-3 py-2.5"><BadgeEstado estado={v.estado} /></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{moneda(v.total_merch)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{moneda(v.total_gastos)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{moneda(v.costo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE 6 — INVENTARIO PRÓXIMO A CADUCAR
═══════════════════════════════════════════════════════════════ */
function ReporteCaducidad() {
  const [horizonte, setHorizonte] = useState(30)
  const [datos,     setDatos]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const { orden, onSort, ordenar } = useOrden('dias_restantes', true)

  async function cargar() {
    setLoading(true)
    try {
      const d = await getReporteCaducidad({ diasHorizonte: horizonte })
      setDatos(d)
    } finally {
      setLoading(false)
    }
  }

  function exportar() {
    if (!datos?.length) return
    exportarCSV(
      ['Producto', 'Categoría', 'Días restantes', 'Fecha caducidad (est.)', 'Stock Central', 'Punto A', 'Punto B', 'Total', 'Costo unit.', 'Valor estimado'],
      datos.map(r => [r.nombre, r.categoria || '', r.dias_restantes, r.fecha_caducidad_estimada, r.stock_central, r.stock_punto_a, r.stock_punto_b, r.stock_total, r.costo_unitario.toFixed(2), r.valor_estimado.toFixed(2)]),
      'caducidad'
    )
  }

  const filas        = datos ? ordenar(datos) : []
  const urgentes     = filas.filter(r => r.urgente)
  const valorTotal   = (datos || []).reduce((a, r) => a + r.valor_estimado, 0)

  function clsDias(dias, urgente) {
    if (urgente)  return 'text-red-600 font-bold'
    if (dias <= 15) return 'text-amber-600 font-semibold'
    return 'text-slate-600'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Próximos a caducar en</label>
          <select
            value={horizonte}
            onChange={e => setHorizonte(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
          </select>
        </div>
        <div className="flex gap-2">
          <BtnExportar onClick={exportar} disabled={!datos?.length} />
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Generar
          </button>
        </div>
      </div>

      {!datos && !loading && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">Presiona <strong>Generar</strong> para ver productos próximos a caducar</p>
        </div>
      )}
      {loading && <SkeletonTabla cols={6} />}

      {datos && !loading && (
        <>
          {filas.length === 0 ? (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
              <p className="text-sm font-medium text-emerald-700">✓ Sin productos próximos a caducar en los próximos {horizonte} días</p>
            </div>
          ) : (
            <>
              {/* Resumen */}
              <div className="flex flex-wrap gap-3">
                {urgentes.length > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 rounded-xl border border-red-200 px-4 py-2.5">
                    <AlertTriangle size={15} className="text-red-500" />
                    <p className="text-sm text-red-700">
                      <strong>{urgentes.length}</strong> producto{urgentes.length !== 1 ? 's' : ''} caducan en 7 días o menos
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-amber-50 rounded-xl border border-amber-200 px-4 py-2.5">
                  <Clock size={15} className="text-amber-500" />
                  <p className="text-sm text-amber-700">
                    Valor total en riesgo: <strong>{moneda(valorTotal)}</strong>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <Th campo="nombre"                   orden={orden} onSort={onSort}>Producto</Th>
                      <Th campo="categoria"                orden={orden} onSort={onSort}>Categoría</Th>
                      <Th campo="dias_restantes"           orden={orden} onSort={onSort} className="text-right">Días rest.</Th>
                      <Th campo="fecha_caducidad_estimada" orden={orden} onSort={onSort}>Caducidad (est.)</Th>
                      <Th campo="stock_punto_a"            orden={orden} onSort={onSort} className="text-right">Punto A</Th>
                      <Th campo="stock_punto_b"            orden={orden} onSort={onSort} className="text-right">Punto B</Th>
                      <Th campo="stock_total"              orden={orden} onSort={onSort} className="text-right">Total</Th>
                      <Th campo="valor_estimado"           orden={orden} onSort={onSort} className="text-right">Valor est.</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map(r => (
                      <tr
                        key={r.producto_id}
                        className={`hover:opacity-90 transition-colors ${r.urgente ? 'bg-red-50' : r.dias_restantes <= 15 ? 'bg-amber-50' : ''}`}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[150px] truncate">{r.nombre}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{r.categoria || '—'}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${clsDias(r.dias_restantes, r.urgente)}`}>
                          {r.dias_restantes === 0 ? 'Hoy' : `${r.dias_restantes}d`}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{fechaCorta(r.fecha_caducidad_estimada)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.stock_punto_a}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.stock_punto_b}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.stock_total}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {r.valor_estimado > 0 ? moneda(r.valor_estimado) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL — REPORTES
═══════════════════════════════════════════════════════════════ */

const TABS = [
  {
    id:          'rotacion',
    label:       'Rotación por punto',
    labelCorto:  'Rotación',
    icon:        ShoppingBag,
    descripcion: 'Distribución de ventas entre Punto A y B',
    Component:   ReporteRotacion,
  },
  {
    id:          'ventas',
    label:       'Ventas por período',
    labelCorto:  'Ventas',
    icon:        TrendingUp,
    descripcion: 'Tendencia de ventas y desglose por punto y pago',
    Component:   ReporteVentas,
  },
  {
    id:          'estancados',
    label:       'Productos estancados',
    labelCorto:  'Estancados',
    icon:        Package,
    descripcion: 'Productos sin movimiento y su valor en inventario',
    Component:   ReporteEstancados,
  },
  {
    id:          'rentabilidad',
    label:       'Rentabilidad',
    labelCorto:  'Margen',
    icon:        BarChart3,
    descripcion: 'Margen bruto por producto',
    Component:   ReporteRentabilidad,
  },
  {
    id:          'viajes',
    label:       'Viajes de compra',
    labelCorto:  'Viajes',
    icon:        Truck,
    descripcion: 'Costos de compra y traslado por período',
    Component:   ReporteViajes,
  },
  {
    id:          'caducidad',
    label:       'Próximos a caducar',
    labelCorto:  'Caducidad',
    icon:        Clock,
    descripcion: 'Productos con fecha de caducidad próxima',
    Component:   ReporteCaducidad,
  },
]

export default function Reportes() {
  const { profile } = useAuth()
  const rol = profile?.rol ?? 'admin'

  // La pestaña de Rentabilidad solo es visible para admin
  const tabsVisibles = TABS.filter(t => t.id !== 'rentabilidad' || rol === 'admin')

  const [tabActivo, setTabActivo] = useState('rotacion')
  const tab = tabsVisibles.find(t => t.id === tabActivo) ?? tabsVisibles[0]
  const ActiveComponent = tab?.Component || null

  return (
    <div className="space-y-5">

      {/* ── Encabezado ── */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Reportes</h1>
        <p className="text-sm text-slate-500 mt-0.5">Análisis e informes del negocio</p>
      </div>

      {/* ── Tabs de navegación (scroll horizontal en mobile) ── */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 min-w-max sm:min-w-0 sm:flex-wrap">
          {tabsVisibles.map(t => {
            const Icon = t.icon
            const activo = t.id === tabActivo
            return (
              <button
                key={t.id}
                onClick={() => setTabActivo(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap
                  ${activo
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                  }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{t.labelCorto}</span>
                <span className="sm:hidden">{t.labelCorto}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Contenedor del reporte activo ── */}
      {tab && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <tab.icon size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">{tab.label}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 ml-6">{tab.descripcion}</p>
          </div>
          <ActiveComponent />
        </div>
      )}

    </div>
  )
}
