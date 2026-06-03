import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Package, ArrowLeftRight, Search, Filter, Download,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  X, RefreshCw, ClipboardList,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getInventarioResumen,
  getMovimientos,
  exportarMovimientosCSV,
  ajustarInventario,
  getProductosCatalogo,
  ubicacionMovimiento,
  deltaMovimiento,
  deltaTexto,
  TIPO_MOVIMIENTO_LABEL,
  PAGE_SIZE,
} from '../lib/inventario'

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

function nivelStock(item) {
  if (item.alerta_stock_bajo) return 'rojo'
  const min = Number(item.existencia_minima) || 0
  if (min > 0 && Number(item.stock_total) < min * 2) return 'amarillo'
  return 'verde'
}

const NIVEL_ROW = {
  rojo:     'bg-red-50/70 border-l-4 border-l-red-400',
  amarillo: 'bg-amber-50/70 border-l-4 border-l-amber-400',
  verde:    'border-l-4 border-l-transparent',
}
const NIVEL_BADGE = {
  rojo:     'bg-red-100 text-red-700',
  amarillo: 'bg-amber-100 text-amber-700',
  verde:    'bg-emerald-100 text-emerald-700',
}
const NIVEL_LABEL = { rojo: 'Bajo', amarillo: 'Alerta', verde: 'OK' }

const UBICACION_LABEL = { central: 'Central', punto_a: 'Punto A', punto_b: 'Punto B' }

const MOTIVOS_AJUSTE = [
  { value: 'ajuste',   label: 'Conteo físico' },
  { value: 'merma',    label: 'Merma' },
  { value: 'caducado', label: 'Caducado' },
  { value: 'robo',     label: 'Robo / pérdida' },
  { value: 'otro',     label: 'Otro' },
]

/* ═══════════════════════════════════════════════════════════════
   PÁGINA CONTENEDOR
═══════════════════════════════════════════════════════════════ */

export default function Inventario() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabActivo = searchParams.get('tab') || 'general'

  function cambiarTab(tab) {
    setSearchParams(tab === 'general' ? {} : { tab })
  }

  return (
    <div className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Inventario</h1>
          <p className="text-sm text-slate-500 mt-0.5">Control de stock y movimientos</p>
        </div>
        <button
          onClick={() => navigate('/inventario/distribucion')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeftRight size={16} />
          Distribuir mercancía
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {[
            { key: 'general',   label: 'Vista General' },
            { key: 'ajuste',    label: 'Ajuste'        },
            { key: 'historial', label: 'Historial'     },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => cambiarTab(key)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tabActivo === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido del tab ── */}
      <div className="pt-1">
        {tabActivo === 'general'   && <TabVistaGeneral />}
        {tabActivo === 'ajuste'    && <TabAjuste />}
        {tabActivo === 'historial' && <TabHistorial />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1 — VISTA GENERAL
═══════════════════════════════════════════════════════════════ */

function TabVistaGeneral() {
  const [searchParams] = useSearchParams()
  const [inventario,   setInventario]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroCat,    setFiltroCat]    = useState('')
  const [soloAlertas,  setSoloAlertas]  = useState(searchParams.get('alerta') === '1')

  useEffect(() => { cargar() }, []) // eslint-disable-line

  async function cargar() {
    setLoading(true)
    try {
      const data = await getInventarioResumen()
      setInventario(data)
    } catch (err) {
      toast.error('Error al cargar inventario')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const categorias = [...new Set(inventario.map(i => i.categoria).filter(Boolean))].sort()

  const filtrados = inventario.filter(item => {
    if (busqueda    && !item.nombre?.toLowerCase().includes(busqueda.toLowerCase())) return false
    if (filtroCat   && item.categoria !== filtroCat)                                  return false
    if (soloAlertas && nivelStock(item) === 'verde')                                  return false
    return true
  })

  const conAlertas = inventario.filter(i => nivelStock(i) !== 'verde').length

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">

      {/* Chips resumen */}
      {inventario.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {inventario.length} productos
          </span>
          {conAlertas > 0 && (
            <button
              onClick={() => setSoloAlertas(v => !v)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                soloAlertas
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              {conAlertas} con alerta{conAlertas !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>

        <select
          value={filtroCat}
          onChange={e => setFiltroCat(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {(busqueda || filtroCat || soloAlertas) && (
          <button
            onClick={() => { setBusqueda(''); setFiltroCat(''); setSoloAlertas(false) }}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <X size={12} /> Limpiar
          </button>
        )}

        <button
          onClick={cargar}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Actualizar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Empty state */}
      {filtrados.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Package size={36} strokeWidth={1.2} />
          <p className="text-sm font-medium">
            {inventario.length > 0 ? 'Sin resultados con esos filtros' : 'Sin productos en inventario'}
          </p>
          {!inventario.length && (
            <p className="text-xs">Completa un viaje de compra para cargar mercancía</p>
          )}
        </div>
      )}

      {/* ── Tabla desktop ── */}
      {filtrados.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Producto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Central</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Punto A</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Punto B</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center pr-5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(item => {
                  const nivel = nivelStock(item)
                  const min   = Number(item.existencia_minima) || 0

                  function colStock(val) {
                    return min > 0 && Number(val) < min
                      ? 'text-red-600 font-bold'
                      : 'text-slate-700 font-semibold'
                  }

                  return (
                    <tr key={item.producto_id} className={`transition-colors ${NIVEL_ROW[nivel]}`}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{item.nombre}</p>
                        {min > 0 && <p className="text-xs text-slate-400 mt-0.5">Mín: {min}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{item.categoria || '—'}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${colStock(item.stock_central)}`}>
                        {Number(item.stock_central)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${colStock(item.stock_punto_a)}`}>
                        {Number(item.stock_punto_a)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${colStock(item.stock_punto_b)}`}>
                        {Number(item.stock_punto_b)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                        {Number(item.stock_total)}
                      </td>
                      <td className="px-4 py-3 text-center pr-5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${NIVEL_BADGE[nivel]}`}>
                          {NIVEL_LABEL[nivel]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Cards mobile ── */}
          <div className="md:hidden space-y-2">
            {filtrados.map(item => {
              const nivel = nivelStock(item)
              const min   = Number(item.existencia_minima) || 0

              return (
                <div key={item.producto_id} className={`bg-white rounded-xl border border-slate-200 p-4 ${NIVEL_ROW[nivel]}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 leading-tight">{item.nombre}</p>
                      {item.categoria && <p className="text-xs text-slate-400 mt-0.5">{item.categoria}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${NIVEL_BADGE[nivel]}`}>
                      {NIVEL_LABEL[nivel]}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Central', val: item.stock_central },
                      { label: 'Punto A', val: item.stock_punto_a },
                      { label: 'Punto B', val: item.stock_punto_b },
                      { label: 'Total',   val: item.stock_total,   bold: true },
                    ].map(({ label, val, bold }) => {
                      const bajo = min > 0 && Number(val) < min
                      return (
                        <div key={label} className="bg-slate-50/80 rounded-lg py-2">
                          <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                          <p className={`font-bold ${bold ? 'text-base text-slate-900' : 'text-sm'} ${bajo ? 'text-red-600' : 'text-slate-800'}`}>
                            {Number(val)}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {min > 0 && <p className="mt-2 text-xs text-slate-400">Mínimo: {min}</p>}
                </div>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400" /> Stock bajo en algún punto</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /> Total {'<'} 2× mínimo</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400" /> En orden</span>
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2 — AJUSTE DE INVENTARIO
═══════════════════════════════════════════════════════════════ */

const AJUSTE_VACIO = {
  producto_id: '',
  ubicacion:   '',
  tipo_mov:    'salida',
  cantidad:    '',
  motivo:      'ajuste',
  notas:       '',
}

function TabAjuste() {
  const [productos,   setProductos]   = useState([])
  const [form,        setForm]        = useState(AJUSTE_VACIO)
  const [confirmando, setConfirmando] = useState(false)
  const [guardando,   setGuardando]   = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    getProductosCatalogo()
      .then(setProductos)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const productoSel = productos.find(p => p.id === form.producto_id)

  function validar() {
    if (!form.producto_id) return 'Selecciona un producto'
    if (!form.ubicacion)   return 'Selecciona la ubicación'
    const cant = Number(form.cantidad)
    if (!form.cantidad || isNaN(cant) || cant <= 0) return 'Ingresa una cantidad válida (mayor que 0)'
    return null
  }

  function pedirConfirmacion() {
    const err = validar()
    if (err) { toast.error(err); return }
    setConfirmando(true)
  }

  async function aplicar() {
    setGuardando(true)
    try {
      const delta = form.tipo_mov === 'salida'
        ? -Math.abs(Number(form.cantidad))
        :  Math.abs(Number(form.cantidad))

      await ajustarInventario({
        producto_id: form.producto_id,
        ubicacion:   form.ubicacion,
        delta,
        tipo:        form.motivo,
        notas:       form.notas || null,
      })

      toast.success('Ajuste registrado correctamente')
      setForm(AJUSTE_VACIO)
      setConfirmando(false)
    } catch (err) {
      toast.error(err.message || 'Error al registrar el ajuste')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="max-w-xl space-y-5">

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
        <p>Usa este formulario para corregir diferencias de conteo físico, registrar mermas o productos caducados. El ajuste queda registrado en el historial de movimientos.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">

        {/* Producto */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Producto <span className="text-red-500">*</span>
          </label>
          <select
            value={form.producto_id}
            onChange={e => set('producto_id', e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="">— Selecciona un producto —</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          {productoSel && (
            <p className="text-xs text-slate-400 mt-1">{productoSel.categoria} · {productoSel.unidad_venta}</p>
          )}
        </div>

        {/* Ubicación */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Ubicación <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(UBICACION_LABEL).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => set('ubicacion', val)}
                className={`py-2 text-sm font-medium rounded-lg border transition-all ${
                  form.ubicacion === val
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo de movimiento */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo de corrección</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set('tipo_mov', 'salida')}
              className={`py-2.5 px-3 text-sm font-medium rounded-lg border text-left transition-all ${
                form.tipo_mov === 'salida'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              − Quitar del inventario
            </button>
            <button
              type="button"
              onClick={() => set('tipo_mov', 'entrada')}
              className={`py-2.5 px-3 text-sm font-medium rounded-lg border text-left transition-all ${
                form.tipo_mov === 'entrada'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              + Agregar al inventario
            </button>
          </div>
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Cantidad <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            value={form.cantidad}
            onChange={e => set('cantidad', e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          {productoSel && (
            <p className="text-xs text-slate-400 mt-1">Unidad: {productoSel.unidad_venta}</p>
          )}
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Motivo <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS_AJUSTE.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('motivo', value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  form.motivo === value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notas (opcional)</label>
          <textarea
            rows={2}
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            placeholder="Observaciones, número de conteo, etc."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <button
          onClick={pedirConfirmacion}
          className="w-full py-3 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-900 transition-colors"
        >
          Revisar antes de aplicar →
        </button>
      </div>

      {/* ── Modal de confirmación ── */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-slate-800">Confirmar ajuste de inventario</h2>
              <button onClick={() => setConfirmando(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1 text-sm">
              {[
                ['Producto',   productoSel?.nombre],
                ['Ubicación',  UBICACION_LABEL[form.ubicacion]],
                ['Movimiento', form.tipo_mov === 'salida'
                  ? `−${Number(form.cantidad)} (quitar)`
                  : `+${Number(form.cantidad)} (agregar)`
                ],
                ['Motivo',     MOTIVOS_AJUSTE.find(m => m.value === form.motivo)?.label],
                ...(form.notas ? [['Notas', form.notas]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-100 gap-4">
                  <span className="text-slate-500 shrink-0">{k}</span>
                  <span className={`font-medium text-right ${k === 'Movimiento' ? (form.tipo_mov === 'salida' ? 'text-red-700' : 'text-emerald-700') : 'text-slate-800'}`}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={aplicar}
                disabled={guardando}
                className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {guardando
                  ? <><div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Aplicando…</>
                  : <><CheckCircle size={15} /> Aplicar ajuste</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3 — HISTORIAL DE MOVIMIENTOS
═══════════════════════════════════════════════════════════════ */

const FILTROS_VACIO = {
  producto_id: '',
  tipo:        '',
  ubicacion:   '',
  fecha_desde: '',
  fecha_hasta: '',
}

function TabHistorial() {
  const [movimientos, setMovimientos] = useState([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [productos,   setProductos]   = useState([])
  const [filtros,     setFiltros]     = useState(FILTROS_VACIO)

  useEffect(() => {
    getProductosCatalogo().then(setProductos).catch(console.error)
  }, [])

  useEffect(() => { cargar() }, [filtros, page]) // eslint-disable-line

  async function cargar() {
    setLoading(true)
    try {
      const { data, count } = await getMovimientos({ ...filtros, page })
      setMovimientos(data)
      setTotal(count)
    } catch (err) {
      toast.error('Error al cargar historial')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function setFiltro(k, v) {
    setFiltros(f => ({ ...f, [k]: v }))
    setPage(0)
  }

  function limpiar() {
    setFiltros(FILTROS_VACIO)
    setPage(0)
  }

  async function exportarCSV() {
    try {
      const csv  = await exportarMovimientosCSV(filtros)
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `movimientos_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV descargado')
    } catch (err) {
      toast.error('Error al exportar')
      console.error(err)
    }
  }

  const totalPags = Math.ceil(total / PAGE_SIZE)
  const hayFiltros = Object.values(filtros).some(Boolean)

  return (
    <div className="space-y-4">

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter size={14} /> Filtros
          </div>
          <div className="flex items-center gap-2">
            {hayFiltros && (
              <button onClick={limpiar} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <X size={11} /> Limpiar
              </button>
            )}
            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Download size={13} /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <select
            value={filtros.producto_id}
            onChange={e => setFiltro('producto_id', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos los productos</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>

          <select
            value={filtros.tipo}
            onChange={e => setFiltro('tipo', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_MOVIMIENTO).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            value={filtros.ubicacion}
            onChange={e => setFiltro('ubicacion', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todas las ubicaciones</option>
            {Object.entries(UBICACION_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 shrink-0">Desde</label>
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={e => setFiltro('fecha_desde', e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 shrink-0">Hasta</label>
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={e => setFiltro('fecha_hasta', e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {!loading && (
        <p className="text-xs text-slate-500">
          {total} movimiento{total !== 1 ? 's' : ''}
          {hayFiltros ? ' con estos filtros' : ' registrados'}
        </p>
      )}

      {/* Lista */}
      {loading ? <Spinner /> : movimientos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <ClipboardList size={36} strokeWidth={1.2} />
          <p className="text-sm font-medium">Sin movimientos{hayFiltros ? ' con estos filtros' : ''}</p>
        </div>
      ) : (
        <>
          {/* Tabla desktop */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Producto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Ubicación</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Tipo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 pr-5">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientos.map(m => {
                  const delta = deltaMovimiento(m)
                  return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(m.fecha).toLocaleString('es-MX', {
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                        timeZone: 'America/Mexico_City',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{m.productos?.nombre || '—'}</p>
                      {m.productos?.categoria && (
                        <p className="text-xs text-slate-400">{m.productos.categoria}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">
                      {ubicacionMovimiento(m)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums text-base ${
                      delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-500'
                    }`}>
                      {deltaTexto(m)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {TIPO_MOVIMIENTO_LABEL[m.tipo] || m.tipo || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 pr-5 text-slate-400 text-xs max-w-xs truncate">
                      {m.notas || '—'}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-2">
            {movimientos.map(m => {
              const delta = deltaMovimiento(m)
              return (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{m.productos?.nombre || '—'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ubicacionMovimiento(m)} ·{' '}
                      {TIPO_MOVIMIENTO_LABEL[m.tipo] || m.tipo}
                    </p>
                  </div>
                  <span className={`text-lg font-bold tabular-nums shrink-0 ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    {deltaTexto(m)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(m.fecha).toLocaleString('es-MX', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                    timeZone: 'America/Mexico_City',
                  })}
                </p>
                {m.notas && <p className="text-xs text-slate-500 mt-1 italic">{m.notas}</p>}
              </div>
            )})}
          </div>

          {/* Paginación */}
          {totalPags > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">
                Página {page + 1} de {totalPags} · {total} registros
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPags - 1, p + 1))}
                  disabled={page >= totalPags - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Spinner compartido ─────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 border-b-2 border-blue-600 rounded-full animate-spin" />
    </div>
  )
}
