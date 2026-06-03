import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowLeftRight, Package, CheckCircle,
  AlertTriangle, TrendingUp, Search, X, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getProductosConStockCentral, getVentasPorPunto30Dias, distribuirInventario } from '../lib/inventario'

const UBICACION_LABEL = { central: 'Central', punto_a: 'Punto A', punto_b: 'Punto B' }

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════ */

export default function InventarioDistribucion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [productos,   setProductos]   = useState([])   // todos con stock central
  const [ventas30,    setVentas30]    = useState({})    // { producto_id: {punto_a, punto_b} }
  const [cantidades,  setCantidades]  = useState({})    // { producto_id: { a: '', b: '' } }
  const [busqueda,    setBusqueda]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [distribuyendo, setDistribuyendo] = useState(false)
  const [confirmando,   setConfirmando]   = useState(false)

  useEffect(() => { cargar() }, []) // eslint-disable-line

  async function cargar() {
    setLoading(true)
    try {
      const prods = await getProductosConStockCentral()
      setProductos(prods)

      const ids = prods.map(p => p.producto_id)
      const v   = await getVentasPorPunto30Dias(ids)
      setVentas30(v)

      // Inicializar cantidades en cero para todos los productos
      const cant = {}
      prods.forEach(p => { cant[p.producto_id] = { a: '', b: '' } })
      setCantidades(cant)
    } catch (err) {
      toast.error('Error al cargar productos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function setCantidad(productoId, punto, valor) {
    setCantidades(prev => ({
      ...prev,
      [productoId]: { ...prev[productoId], [punto]: valor },
    }))
  }

  /* Derivados */
  const productosFiltrados = productos.filter(p =>
    !busqueda || p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Solo los que tienen alguna cantidad capturada
  const itemsConCantidad = productos.filter(p => {
    const c = cantidades[p.producto_id] || {}
    return (Number(c.a) || 0) + (Number(c.b) || 0) > 0
  })

  // Validaciones por producto
  const errores = {}
  for (const p of itemsConCantidad) {
    const c     = cantidades[p.producto_id] || {}
    const total = (Number(c.a) || 0) + (Number(c.b) || 0)
    if (total > Number(p.stock_central)) {
      errores[p.producto_id] = `Excede stock central (${p.stock_central})`
    }
  }

  const hayErrores = Object.keys(errores).length > 0

  function pedirConfirmacion() {
    if (!itemsConCantidad.length) {
      toast.error('Ingresa al menos una cantidad para distribuir')
      return
    }
    if (hayErrores) {
      toast.error('Corrige las cantidades que exceden el stock disponible')
      return
    }
    setConfirmando(true)
  }

  async function confirmarDistribucion() {
    setDistribuyendo(true)
    try {
      const items = itemsConCantidad.map(p => {
        const c = cantidades[p.producto_id] || {}
        return {
          producto_id: p.producto_id,
          cantidad_a:  Number(c.a) || 0,
          cantidad_b:  Number(c.b) || 0,
          notas:       'Distribución de mercancía',
        }
      })

      await distribuirInventario(items)

      toast.success(`Mercancía distribuida: ${items.length} producto${items.length !== 1 ? 's' : ''}`)
      await cargar()
    } catch (err) {
      toast.error(err.message || 'Error al distribuir')
      console.error(err)
    } finally {
      setDistribuyendo(false)
      setConfirmando(false)
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 border-b-2 border-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* ── Encabezado ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/inventario')}
          className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Distribución de Mercancía</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Mueve productos del inventario central a los puntos de venta
          </p>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <ArrowLeftRight size={15} className="shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-semibold mb-0.5">¿Cómo funciona?</p>
          <p className="text-blue-700 text-xs">
            Captura cuántas unidades de cada producto quieres enviar al Punto A y al Punto B.
            Los productos con cantidad 0 se ignoran. Al confirmar, el stock central baja y los puntos suben automáticamente.
          </p>
        </div>
      </div>

      {/* ── Sin stock ── */}
      {productos.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Package size={40} strokeWidth={1.2} />
          <p className="text-sm font-medium">Sin mercancía en inventario central</p>
          <p className="text-xs">Completa un viaje de compra para cargar mercancía al central</p>
          <button
            onClick={() => navigate('/viajes')}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Ir a Viajes de Compra →
          </button>
        </div>
      )}

      {productos.length > 0 && (
        <>
          {/* Filtro búsqueda + resumen */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar producto…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
            <button onClick={cargar} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw size={14} />
            </button>
            {itemsConCantidad.length > 0 && (
              <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {itemsConCantidad.length} producto{itemsConCantidad.length !== 1 ? 's' : ''} por distribuir
              </span>
            )}
          </div>

          {/* ══ Tabla desktop ══ */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center text-xs font-semibold text-slate-500">
              <span>Producto</span>
              <span className="w-24 text-right">Central</span>
              <span className="w-20 text-right">Stock A</span>
              <span className="w-20 text-right">Stock B</span>
              <span className="w-28 text-center text-blue-600">→ Punto A</span>
              <span className="w-28 text-center text-blue-600">→ Punto B</span>
            </div>

            <div className="divide-y divide-slate-100">
              {productosFiltrados.map(p => {
                const c      = cantidades[p.producto_id] || {}
                const v      = ventas30[p.producto_id]   || { punto_a: 0, punto_b: 0 }
                const error  = errores[p.producto_id]
                const totalA = Number(c.a) || 0
                const totalB = Number(c.b) || 0
                const resto  = Number(p.stock_central) - totalA - totalB

                return (
                  <div
                    key={p.producto_id}
                    className={`px-5 py-3 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center transition-colors ${
                      error ? 'bg-red-50/60' : totalA + totalB > 0 ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    {/* Nombre + info */}
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{p.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.categoria && <span className="text-xs text-slate-400">{p.categoria}</span>}
                        {(v.punto_a > 0 || v.punto_b > 0) && (
                          <span className="text-xs text-blue-500 flex items-center gap-1">
                            <TrendingUp size={10} />
                            30d: A={v.punto_a} B={v.punto_b}
                          </span>
                        )}
                        {error && (
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle size={10} /> {error}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock central (con indicador de lo que queda) */}
                    <div className="w-24 text-right">
                      <p className={`font-bold text-sm tabular-nums ${resto < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {Number(p.stock_central)}
                      </p>
                      {(totalA + totalB) > 0 && (
                        <p className={`text-xs tabular-nums ${resto < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                          queda: {resto}
                        </p>
                      )}
                    </div>

                    {/* Stock actual en puntos */}
                    <div className="w-20 text-right">
                      <p className="text-sm text-slate-600 tabular-nums">{Number(p.stock_punto_a)}</p>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-sm text-slate-600 tabular-nums">{Number(p.stock_punto_b)}</p>
                    </div>

                    {/* Inputs distribución */}
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        max={p.stock_central}
                        value={c.a || ''}
                        onChange={e => setCantidad(p.producto_id, 'a', e.target.value)}
                        placeholder="0"
                        className={`w-full text-center px-2 py-1.5 text-sm font-semibold border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                          error
                            ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                            : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
                        }`}
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        max={p.stock_central}
                        value={c.b || ''}
                        onChange={e => setCantidad(p.producto_id, 'b', e.target.value)}
                        placeholder="0"
                        className={`w-full text-center px-2 py-1.5 text-sm font-semibold border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                          error
                            ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                            : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
                        }`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ══ Cards mobile ══ */}
          <div className="md:hidden space-y-3">
            {productosFiltrados.map(p => {
              const c     = cantidades[p.producto_id] || {}
              const v     = ventas30[p.producto_id]   || { punto_a: 0, punto_b: 0 }
              const error = errores[p.producto_id]
              const resto = Number(p.stock_central) - (Number(c.a) || 0) - (Number(c.b) || 0)

              return (
                <div
                  key={p.producto_id}
                  className={`bg-white rounded-xl border p-4 space-y-3 ${
                    error ? 'border-red-300 bg-red-50/40' : 'border-slate-200'
                  }`}
                >
                  {/* Encabezado card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{p.nombre}</p>
                      {p.categoria && <p className="text-xs text-slate-400">{p.categoria}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">Central</p>
                      <p className={`font-bold text-base tabular-nums ${resto < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {Number(p.stock_central)}
                      </p>
                      {(Number(c.a) + Number(c.b) > 0) && (
                        <p className={`text-xs tabular-nums ${resto < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                          queda: {resto}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stock actual */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg py-1.5">
                      <p className="text-xs text-slate-400">Stock Punto A</p>
                      <p className="font-semibold text-slate-700">{Number(p.stock_punto_a)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-1.5">
                      <p className="text-xs text-slate-400">Stock Punto B</p>
                      <p className="font-semibold text-slate-700">{Number(p.stock_punto_b)}</p>
                    </div>
                  </div>

                  {/* Ventas 30 días */}
                  {(v.punto_a > 0 || v.punto_b > 0) && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">
                      <TrendingUp size={12} />
                      Ventas 30 días: Punto A = {v.punto_a} · Punto B = {v.punto_b}
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">
                      <AlertTriangle size={12} /> {error}
                    </div>
                  )}

                  {/* Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">→ Punto A</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={c.a || ''}
                        onChange={e => setCantidad(p.producto_id, 'a', e.target.value)}
                        placeholder="0"
                        className={`w-full text-center px-3 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 ${
                          error
                            ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                            : 'border-slate-200 focus:ring-blue-500/20'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">→ Punto B</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={c.b || ''}
                        onChange={e => setCantidad(p.producto_id, 'b', e.target.value)}
                        placeholder="0"
                        className={`w-full text-center px-3 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 ${
                          error
                            ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                            : 'border-slate-200 focus:ring-blue-500/20'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Barra de acción fija ── */}
          <div className="sticky bottom-4 z-20">
            <div className={`bg-white rounded-2xl border shadow-lg px-5 py-4 flex items-center gap-4 flex-wrap transition-all ${
              itemsConCantidad.length > 0 ? 'border-blue-200 shadow-blue-100' : 'border-slate-200'
            }`}>
              <div className="flex-1 min-w-0">
                {itemsConCantidad.length === 0 ? (
                  <p className="text-sm text-slate-400">Captura cantidades en la tabla para distribuir</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-800">
                      {itemsConCantidad.length} producto{itemsConCantidad.length !== 1 ? 's' : ''} listos para distribuir
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total: {itemsConCantidad.reduce((a, p) => {
                        const c = cantidades[p.producto_id] || {}
                        return a + (Number(c.a) || 0) + (Number(c.b) || 0)
                      }, 0)} unidades
                    </p>
                  </>
                )}
              </div>

              {hayErrores && (
                <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle size={12} /> Corrige los errores
                </span>
              )}

              <button
                onClick={pedirConfirmacion}
                disabled={!itemsConCantidad.length || hayErrores}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeftRight size={16} />
                Distribuir mercancía
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal de confirmación ── */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-slate-800">Confirmar distribución</h2>
              <button onClick={() => setConfirmando(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-2 mb-2 text-xs font-semibold text-slate-400">
                <span>Producto</span>
                <span>Punto A</span>
                <span>Punto B</span>
              </div>
              {itemsConCantidad.map(p => {
                const c = cantidades[p.producto_id] || {}
                return (
                  <div key={p.producto_id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-2 py-2 rounded-lg bg-slate-50 text-sm items-center">
                    <span className="font-medium text-slate-700 truncate">{p.nombre}</span>
                    <span className="font-bold text-blue-700 tabular-nums w-10 text-center">
                      {Number(c.a) || 0 > 0 ? `+${Number(c.a)}` : '—'}
                    </span>
                    <span className="font-bold text-blue-700 tabular-nums w-10 text-center">
                      {Number(c.b) || 0 > 0 ? `+${Number(c.b)}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
              El stock central bajará y los puntos de venta subirán automáticamente.
              Esta acción no se puede deshacer directamente.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDistribucion}
                disabled={distribuyendo}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {distribuyendo
                  ? <><div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Distribuyendo…</>
                  : <><CheckCircle size={15} /> Confirmar</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
