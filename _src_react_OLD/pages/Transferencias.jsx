import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowLeftRight, Plus, Search, X, ChevronLeft, ChevronRight,
  ArrowRight, Package, SlidersHorizontal,
} from 'lucide-react'
import { fechaCorta } from '../lib/format'
import {
  getTransferencias, crearTransferencia,
  getStockProducto, getProductosConStock,
  PAGE_SIZE,
} from '../lib/transferencias'

// ─── Constantes ───────────────────────────────────────────────
const UBICACIONES = [
  { value: 'central', label: 'Central' },
  { value: 'punto_a', label: 'Punto A' },
  { value: 'punto_b', label: 'Punto B' },
]
const UBI_LABEL = { central: 'Central', punto_a: 'Punto A', punto_b: 'Punto B' }

const UBI_COLOR = {
  central: 'bg-slate-100  text-slate-700',
  punto_a: 'bg-blue-100   text-blue-700',
  punto_b: 'bg-violet-100 text-violet-700',
}

function Spinner({ sm }) {
  return (
    <div className={`rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin ${
      sm ? 'h-5 w-5' : 'h-8 w-8'
    }`} />
  )
}

function UbiBadge({ valor }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${UBI_COLOR[valor] ?? 'bg-slate-100 text-slate-600'}`}>
      {UBI_LABEL[valor] ?? valor}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MODAL — Nueva transferencia
═══════════════════════════════════════════════════════════════ */
function ModalTransferencia({ onClose, onSuccess }) {
  const [todosProductos, setTodosProductos] = useState([])
  const [busqueda,       setBusqueda]       = useState('')
  const [productoSel,    setProductoSel]    = useState(null)
  const [stock,          setStock]          = useState(null)
  const [stockCargando,  setStockCargando]  = useState(false)
  const [origen,         setOrigen]         = useState('')
  const [destino,        setDestino]        = useState('')
  const [cantidad,       setCantidad]       = useState('')
  const [motivo,         setMotivo]         = useState('')
  const [guardando,      setGuardando]      = useState(false)
  const [paso,           setPaso]           = useState(1)   // 1=buscar, 2=configurar

  // Cargar catálogo con stock
  useEffect(() => {
    getProductosConStock().then(setTodosProductos).catch(console.error)
  }, [])

  // Cargar stock cuando se selecciona producto
  useEffect(() => {
    if (!productoSel) return
    setStockCargando(true)
    getStockProducto(productoSel.producto_id)
      .then(setStock)
      .catch(console.error)
      .finally(() => setStockCargando(false))
  }, [productoSel])

  const productosFiltrados = busqueda.trim()
    ? todosProductos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : todosProductos

  function seleccionarProducto(p) {
    setProductoSel(p)
    setStock(null)
    setOrigen('')
    setDestino('')
    setCantidad('')
    setPaso(2)
  }

  const stockEnOrigen = origen && stock
    ? Number(stock[`stock_${origen}`] ?? 0)
    : 0

  const cantNum = parseFloat(cantidad)
  const cantValida = !isNaN(cantNum) && cantNum > 0 && cantNum <= stockEnOrigen

  async function confirmar() {
    if (!productoSel || !origen || !destino || !cantValida) {
      toast.error('Completa todos los campos correctamente')
      return
    }
    setGuardando(true)
    try {
      await crearTransferencia({
        producto_id: productoSel.producto_id,
        cantidad:    cantNum,
        origen,
        destino,
        motivo:      motivo.trim() || null,
      })
      toast.success('Transferencia registrada')
      onSuccess()
    } catch (err) {
      toast.error(err?.message || 'Error al registrar la transferencia')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            {paso === 2 && (
              <button
                onClick={() => setPaso(1)}
                className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div>
              <h2 className="font-semibold text-slate-800">Nueva transferencia</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {paso === 1 ? 'Selecciona el producto' : productoSel?.nombre}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Contenido ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Paso 1: Buscar producto ── */}
          {paso === 1 && (
            <div className="p-5 space-y-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Buscar por nombre…"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50
                             focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                             transition-all placeholder-slate-400"
                />
              </div>

              {todosProductos.length === 0 && (
                <div className="flex justify-center py-12"><Spinner /></div>
              )}

              {todosProductos.length > 0 && productosFiltrados.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Sin resultados</p>
              )}

              <div className="space-y-1.5">
                {productosFiltrados.map(p => (
                  <button
                    key={p.producto_id}
                    onClick={() => seleccionarProducto(p)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100
                               hover:border-blue-200 hover:bg-blue-50/50 transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.categoria || '—'} · {p.unidad_venta}</p>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-500 shrink-0 ml-3">
                      <span>C: <strong className="text-slate-700">{Number(p.stock_central)}</strong></span>
                      <span>A: <strong className="text-slate-700">{Number(p.stock_punto_a)}</strong></span>
                      <span>B: <strong className="text-slate-700">{Number(p.stock_punto_b)}</strong></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Paso 2: Configurar ── */}
          {paso === 2 && (
            <div className="p-5 space-y-5">

              {/* Stock actual */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Stock actual
                </p>
                {stockCargando
                  ? <div className="flex justify-center py-4"><Spinner sm /></div>
                  : (
                    <div className="grid grid-cols-3 gap-2">
                      {UBICACIONES.map(u => {
                        const val = stock ? Number(stock[`stock_${u.value}`] ?? 0) : 0
                        return (
                          <div key={u.value} className={`rounded-xl border p-3 text-center ${
                            val > 0 ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                          }`}>
                            <p className="text-xs text-slate-400 mb-1">{u.label}</p>
                            <p className={`text-2xl font-bold leading-none ${val > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{val}</p>
                            <p className="text-xs text-slate-400 mt-1">{productoSel?.unidad_venta}</p>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              </div>

              {/* Origen */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Origen <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {UBICACIONES.map(u => {
                    const val = stock ? Number(stock[`stock_${u.value}`] ?? 0) : 0
                    const disabled = val <= 0
                    return (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => {
                          setOrigen(u.value)
                          if (destino === u.value) setDestino('')
                          setCantidad('')
                        }}
                        disabled={disabled}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          origen === u.value
                            ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                            : disabled
                            ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {u.label}
                      </button>
                    )
                  })}
                </div>
                {origen && (
                  <p className="text-xs text-slate-400">
                    Disponible: <strong className="text-slate-700">{stockEnOrigen} {productoSel?.unidad_venta}</strong>
                  </p>
                )}
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Destino <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {UBICACIONES.map(u => {
                    const disabled = !origen || u.value === origen
                    return (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => !disabled && setDestino(u.value)}
                        disabled={disabled}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          destino === u.value
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : disabled
                            ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {u.label}
                      </button>
                    )
                  })}
                </div>
                {!origen && (
                  <p className="text-xs text-slate-400">Selecciona el origen primero</p>
                )}
              </div>

              {/* Resumen origen → destino */}
              {origen && destino && (
                <div className="flex items-center justify-center gap-3 py-1">
                  <UbiBadge valor={origen} />
                  <ArrowRight size={16} className="text-slate-400 shrink-0" />
                  <UbiBadge valor={destino} />
                </div>
              )}

              {/* Cantidad */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Cantidad <span className="text-red-500">*</span>
                  {origen && (
                    <span className="ml-2 text-xs text-slate-400 font-normal">
                      máx. {stockEnOrigen}
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={cantidad}
                    onChange={e => setCantidad(e.target.value)}
                    min="0.01"
                    step="0.01"
                    max={stockEnOrigen || undefined}
                    placeholder="0"
                    disabled={!origen}
                    className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                               focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                               disabled:bg-slate-50 disabled:text-slate-300 transition-all"
                  />
                  {origen && stockEnOrigen > 0 && (
                    <button
                      type="button"
                      onClick={() => setCantidad(String(stockEnOrigen))}
                      className="shrink-0 px-4 py-2.5 text-xs font-semibold bg-slate-100
                                 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Todo
                    </button>
                  )}
                </div>
                {cantidad && !isNaN(cantNum) && cantNum > stockEnOrigen && origen && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    Supera el stock disponible en {UBI_LABEL[origen]}
                  </p>
                )}
              </div>

              {/* Motivo */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Motivo / notas{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="ej. Reabastecimiento Punto A por baja existencia"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white resize-none
                             focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                             transition-all placeholder-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {paso === 2 && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium
                         text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={guardando || !origen || !destino || !cantValida}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                         text-sm font-bold transition-colors flex items-center justify-center gap-2
                         disabled:bg-slate-100 disabled:text-slate-400"
            >
              {guardando
                ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando…</>
                : <><ArrowLeftRight size={15} />Confirmar</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CARD DE TRANSFERENCIA
═══════════════════════════════════════════════════════════════ */
function CardTransferencia({ t }) {
  const hora = new Date(t.fecha).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Mexico_City',
  })
  const fecha = fechaCorta(t.fecha.split('T')[0])

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        {/* Producto + detalles */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 truncate">
            {t.productos?.nombre ?? '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t.productos?.categoria ?? ''}</p>

          {/* Cantidad */}
          <p className="mt-2 text-sm font-bold text-slate-700">
            {Number(t.cantidad)} {t.productos?.unidad_venta ?? ''}
          </p>
        </div>

        {/* Fecha */}
        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-slate-600">{fecha}</p>
          <p className="text-xs text-slate-400 mt-0.5">{hora}</p>
        </div>
      </div>

      {/* Origen → Destino */}
      <div className="flex items-center gap-2 mt-3">
        <UbiBadge valor={t.origen} />
        <ArrowRight size={14} className="text-slate-400 shrink-0" />
        <UbiBadge valor={t.destino} />
      </div>

      {/* Motivo */}
      {t.motivo && (
        <p className="mt-2 text-xs text-slate-500 italic truncate">{t.motivo}</p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function Transferencias() {
  const [transferencias, setTransferencias] = useState([])
  const [count,          setCount]          = useState(0)
  const [loading,        setLoading]        = useState(true)
  const [page,           setPage]           = useState(0)
  const [mostrarModal,   setMostrarModal]   = useState(false)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Filtros
  const [fProducto,  setFProducto]  = useState('')
  const [fOrigen,    setFOrigen]    = useState('')
  const [fDestino,   setFDestino]   = useState('')
  const [fDesde,     setFDesde]     = useState('')
  const [fHasta,     setFHasta]     = useState('')

  // Catálogo para el filtro de producto
  const [catalogoProductos, setCatalogoProductos] = useState([])

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const hayFiltros = fProducto || fOrigen || fDestino || fDesde || fHasta

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, count: total } = await getTransferencias({
        producto_id:  fProducto  || undefined,
        origen:       fOrigen    || undefined,
        destino:      fDestino   || undefined,
        fecha_desde:  fDesde     || undefined,
        fecha_hasta:  fHasta     || undefined,
        page,
      })
      setTransferencias(data)
      setCount(total)
    } catch (err) {
      toast.error('Error al cargar transferencias')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [fProducto, fOrigen, fDestino, fDesde, fHasta, page])

  useEffect(() => { cargar() }, [cargar])

  // Cargar catálogo para filtro
  useEffect(() => {
    getProductosConStock().then(setCatalogoProductos).catch(() => {})
  }, [])

  function limpiarFiltros() {
    setFProducto(''); setFOrigen(''); setFDestino('')
    setFDesde(''); setFHasta(''); setPage(0)
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Transferencias</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? '…' : `${count} registro${count !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarFiltros(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              hayFiltros
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {hayFiltros && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 -mr-0.5" />}
          </button>
          <button
            onClick={() => setMostrarModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                       text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nueva transferencia
          </button>
        </div>
      </div>

      {/* ── Panel de filtros ── */}
      {mostrarFiltros && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          {/* Producto */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Producto</label>
            <select
              value={fProducto}
              onChange={e => { setFProducto(e.target.value); setPage(0) }}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="">Todos los productos</option>
              {catalogoProductos.map(p => (
                <option key={p.producto_id} value={p.producto_id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Origen + Destino */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Origen</label>
              <select
                value={fOrigen}
                onChange={e => { setFOrigen(e.target.value); setPage(0) }}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="">Todos</option>
                {UBICACIONES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Destino</label>
              <select
                value={fDestino}
                onChange={e => { setFDestino(e.target.value); setPage(0) }}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="">Todos</option>
                {UBICACIONES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Desde</label>
              <input
                type="date"
                value={fDesde}
                onChange={e => { setFDesde(e.target.value); setPage(0) }}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Hasta</label>
              <input
                type="date"
                value={fHasta}
                onChange={e => { setFHasta(e.target.value); setPage(0) }}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Limpiar filtros */}
          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              <X size={13} /> Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Estado de carga ── */}
      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {/* ── Lista vacía ── */}
      {!loading && transferencias.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <ArrowLeftRight size={44} strokeWidth={1.2} />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500">Sin transferencias</p>
            <p className="text-xs mt-0.5">
              {hayFiltros ? 'Prueba con otros filtros' : 'Registra el primer movimiento de mercancía'}
            </p>
          </div>
          {!hayFiltros && (
            <button
              onClick={() => setMostrarModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              <Plus size={14} /> Nueva transferencia
            </button>
          )}
        </div>
      )}

      {/* ── Cards ── */}
      {!loading && transferencias.length > 0 && (
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Fecha</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Producto</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 text-right">Cantidad</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 text-center">Movimiento</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transferencias.map(t => {
                  const fecha = new Date(t.fecha)
                  const fechaStr = fecha.toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    timeZone: 'America/Mexico_City',
                  })
                  const horaStr = fecha.toLocaleTimeString('es-MX', {
                    hour: '2-digit', minute: '2-digit', hour12: false,
                    timeZone: 'America/Mexico_City',
                  })
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-slate-700 font-medium">{fechaStr}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{horaStr}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{t.productos?.nombre ?? '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{t.productos?.categoria ?? ''}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-bold text-slate-800">{Number(t.cantidad)}</span>
                        <span className="text-slate-400 ml-1 text-xs">{t.productos?.unidad_venta ?? ''}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <UbiBadge valor={t.origen} />
                          <ArrowRight size={13} className="text-slate-400 shrink-0" />
                          <UbiBadge valor={t.destino} />
                        </div>
                      </td>
                      <td className="px-5 py-3 max-w-[220px]">
                        <p className="text-sm text-slate-500 italic truncate">{t.motivo || <span className="text-slate-300">—</span>}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {transferencias.map(t => (
              <CardTransferencia key={t.id} t={t} />
            ))}
          </div>

          {/* ── Paginación ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-500">
                Página {page + 1} de {totalPages} · {count} registro{count !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200
                             text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200
                             text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal ── */}
      {mostrarModal && (
        <ModalTransferencia
          onClose={() => setMostrarModal(false)}
          onSuccess={() => {
            setMostrarModal(false)
            setPage(0)
            cargar()
          }}
        />
      )}
    </div>
  )
}
