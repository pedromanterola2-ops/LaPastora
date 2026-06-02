import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Search, X, Plus, Minus, ShoppingCart, ChevronLeft,
  Receipt, Tag, Printer, BarChart3, ClipboardList,
  Menu, RefreshCw, ChevronRight, Banknote, CreditCard,
  Smartphone, CheckCircle, Store, AlertCircle, Filter,
} from 'lucide-react'
import { moneda, fechaCorta } from '../lib/format'
import {
  buscarProductos, registrarVenta, getVentasDia,
  getHistorial, getDetalleVenta, cancelarVenta, hoyISO,
  getCostosProductos,
} from '../lib/ventas'

// ──────────────────────────────────────────────────────────────
//  CONSTANTES
// ──────────────────────────────────────────────────────────────
const PUNTOS = {
  punto_a: { label: 'Punto A', short: 'A', ubicacion: 'punto_a' },
  punto_b: { label: 'Punto B', short: 'B', ubicacion: 'punto_b' },
}
const METODOS = [
  { value: 'efectivo',      label: 'Efectivo',       Icon: Banknote   },
  { value: 'tarjeta',       label: 'Tarjeta',        Icon: CreditCard },
  { value: 'transferencia', label: 'Transferencia',  Icon: Smartphone },
]
const LS_PUNTO = 'lp_pv_punto'

// ──────────────────────────────────────────────────────────────
//  SPINNER
// ──────────────────────────────────────────────────────────────
function Spinner({ small }) {
  const sz = small ? 'h-5 w-5' : 'h-8 w-8'
  return (
    <div className={`${sz} border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin`} />
  )
}

// ──────────────────────────────────────────────────────────────
//  ROOT
// ──────────────────────────────────────────────────────────────
export default function Ventas() {
  const [punto,          setPunto]          = useState(() => localStorage.getItem(LS_PUNTO))
  const [screen,         setScreen]         = useState('venta')
  const [carrito,        setCarrito]        = useState([])
  const [descuento,      setDescuento]      = useState(0)
  const [ventaInfo,      setVentaInfo]      = useState(null)
  const [ventaCompletada,setVentaCompletada]= useState(null)
  const [detalleId,      setDetalleId]      = useState(null)

  function elegirPunto(p) {
    localStorage.setItem(LS_PUNTO, p)
    setPunto(p)
  }

  function irACobrar(info) { setVentaInfo(info); setScreen('cobro') }

  function confirmarVenta(completada) {
    setVentaCompletada(completada)
    setCarrito([])
    setDescuento(0)
    setScreen('exito')
  }

  function nuevaVenta() {
    setVentaInfo(null)
    setVentaCompletada(null)
    setScreen('venta')
  }

  const POS_ACTIVO = ['venta', 'cobro', 'exito'].includes(screen)

  return (
    <>
      {/* ── Selector de punto (no hay punto guardado) ── */}
      {!punto && (
        <SelectorPunto onSelect={elegirPunto} />
      )}

      {/* ── Overlay full-screen para pantallas POS ── */}
      {punto && POS_ACTIVO && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {screen === 'venta' && (
            <PantallaVenta
              punto={punto}
              carrito={carrito}
              setCarrito={setCarrito}
              descuento={descuento}
              setDescuento={setDescuento}
              onCobrar={irACobrar}
              onCorte={() => setScreen('corte')}
              onHistorial={() => setScreen('historial')}
              onCambiarPunto={() => { localStorage.removeItem(LS_PUNTO); setPunto(null) }}
            />
          )}
          {screen === 'cobro' && ventaInfo && (
            <PantallaCobro
              ventaInfo={ventaInfo}
              punto={punto}
              onConfirmar={confirmarVenta}
              onBack={() => setScreen('venta')}
            />
          )}
          {screen === 'exito' && ventaCompletada && (
            <PantallaExito
              venta={ventaCompletada}
              punto={punto}
              onNuevaVenta={nuevaVenta}
            />
          )}
        </div>
      )}

      {/* ── Pantallas admin (dentro del Layout) ── */}
      {punto && !POS_ACTIVO && (
        <div className="space-y-5">
          {/* Header admin */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                {screen === 'corte'    && 'Corte de Caja'}
                {screen === 'historial' && 'Historial de Ventas'}
                {screen === 'detalle'  && 'Detalle de Venta'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {PUNTOS[punto]?.label ?? punto}
              </p>
            </div>
            <button
              onClick={() => setScreen('venta')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ShoppingCart size={15} /> Abrir POS
            </button>
          </div>

          {screen === 'corte' && (
            <CorteDeCaja punto={punto} />
          )}
          {screen === 'historial' && (
            <HistorialVentas
              punto={punto}
              onDetalle={id => { setDetalleId(id); setScreen('detalle') }}
            />
          )}
          {screen === 'detalle' && detalleId && (
            <DetalleVentaPanel
              ventaId={detalleId}
              onBack={() => setScreen('historial')}
            />
          )}
        </div>
      )}
    </>
  )
}

// ──────────────────────────────────────────────────────────────
//  PANTALLA 1: SELECTOR DE PUNTO
// ──────────────────────────────────────────────────────────────
function SelectorPunto({ onSelect }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Store size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">La Pastora</h1>
        <p className="text-slate-500 mt-1 text-sm">¿Desde cuál punto estás vendiendo hoy?</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        {Object.entries(PUNTOS).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="w-full py-5 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 text-lg font-semibold
                       hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100 transition-all shadow-sm
                       flex items-center justify-center gap-3"
          >
            <Store size={22} className="text-blue-600" />
            {label}
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-400">La selección se guarda en este dispositivo.</p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
//  PANTALLA 2: VENTA (POS principal)
// ──────────────────────────────────────────────────────────────
function PantallaVenta({
  punto, carrito, setCarrito, descuento, setDescuento,
  onCobrar, onCorte, onHistorial, onCambiarPunto,
}) {
  const [query,     setQuery]     = useState('')
  const [resultados,setResultados]= useState([])
  const [buscando,  setBuscando]  = useState(false)
  const [descModal, setDescModal] = useState(false)
  const [descTipo,  setDescTipo]  = useState('pct')
  const [descValor, setDescValor] = useState('')
  const [menuOpen,  setMenuOpen]  = useState(false)
  const searchRef = useRef(null)
  const timerRef  = useRef(null)

  const subtotal = useMemo(
    () => carrito.reduce((s, i) => s + i.precio * i.cantidad, 0),
    [carrito]
  )
  const total = Math.max(0, subtotal - descuento)

  // Búsqueda con debounce 300ms
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) { setResultados([]); setBuscando(false); return }
    setBuscando(true)
    timerRef.current = setTimeout(async () => {
      try {
        const r = await buscarProductos(query, PUNTOS[punto]?.ubicacion ?? punto)
        setResultados(r)
      } catch { setResultados([]) }
      finally { setBuscando(false) }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query, punto])

  const agregar = useCallback(prod => {
    const stock = Number(prod.stock) || 0
    if (stock <= 0) {
      toast.error(`${prod.nombre} sin stock en este punto`)
      return
    }
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto_id === prod.id)
      if (idx >= 0) {
        const c = [...prev]
        if (c[idx].cantidad + 1 > stock) {
          toast.error(`Solo hay ${stock} ${prod.unidad_venta} en stock`)
          return prev
        }
        c[idx] = { ...c[idx], cantidad: c[idx].cantidad + 1 }
        return c
      }
      return [...prev, {
        producto_id: prod.id,
        nombre:  prod.nombre,
        precio:  prod.precio,
        stock,
        unidad:  prod.unidad_venta,
        cantidad: 1,
      }]
    })
    setQuery('')
    setResultados([])
    searchRef.current?.focus()
  }, [setCarrito])

  function cambiarQty(idx, delta) {
    setCarrito(prev => {
      const item = prev[idx]
      const n = item.cantidad + delta
      if (n <= 0) return prev.filter((_, i) => i !== idx)
      if (delta > 0 && n > item.stock) {
        toast.error(`Solo hay ${item.stock} ${item.unidad} en stock`)
        return prev
      }
      const c = [...prev]; c[idx] = { ...c[idx], cantidad: n }; return c
    })
  }

  function setQty(idx, val) {
    const n = parseFloat(val)
    if (!n || n <= 0) return
    setCarrito(prev => {
      const item = prev[idx]
      if (n > item.stock) {
        toast.error(`Solo hay ${item.stock} ${item.unidad} en stock`)
        const c = [...prev]; c[idx] = { ...c[idx], cantidad: item.stock }; return c
      }
      const c = [...prev]; c[idx] = { ...c[idx], cantidad: n }; return c
    })
  }

  function quitar(idx) { setCarrito(prev => prev.filter((_, i) => i !== idx)) }

  function aplicarDescuento() {
    const val = parseFloat(descValor)
    if (isNaN(val) || val < 0) { toast.error('Descuento inválido'); return }
    if (descTipo === 'pct') {
      if (val > 100) { toast.error('El porcentaje no puede superar 100'); return }
      setDescuento(Math.round(subtotal * val / 100 * 100) / 100)
    } else {
      if (val > subtotal) { toast.error('El descuento supera el subtotal'); return }
      setDescuento(val)
    }
    setDescModal(false)
    setDescValor('')
  }

  const descPreview = useMemo(() => {
    const v = parseFloat(descValor)
    if (isNaN(v) || v < 0) return null
    const d = descTipo === 'pct' ? subtotal * v / 100 : v
    return { d, t: subtotal - d }
  }, [descValor, descTipo, subtotal])

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">

      {/* ── Topbar ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 bg-white">
        <button onClick={() => setMenuOpen(true)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-xl">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">La Pastora</span>
          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {PUNTOS[punto]?.label ?? punto}
          </span>
        </div>
        <button
          onClick={() => {
            if (carrito.length === 0) return
            if (!window.confirm('¿Limpiar la venta actual?')) return
            setCarrito([]); setDescuento(0)
          }}
          className="p-2 -mr-2 text-slate-400 hover:text-red-500 rounded-xl"
          title="Limpiar venta"
        >
          <X size={20} />
        </button>
      </header>

      {/* ── Buscador ── */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            autoComplete="off"
            placeholder="Buscar producto…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3.5 text-base rounded-2xl border border-slate-200 bg-slate-50
                       focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                       transition-all placeholder-slate-400"
          />
          {(query || buscando) && (
            <button
              onClick={() => { setQuery(''); setResultados([]) }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {buscando ? <Spinner small /> : <X size={16} />}
            </button>
          )}
        </div>

        {/* Resultados */}
        {resultados.length > 0 && (
          <div className="mt-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
            {resultados.map(p => (
              <button key={p.id} onClick={() => agregar(p)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{p.nombre}</p>
                  <p className={`text-xs mt-0.5 ${
                    p.stock <= 0 ? 'text-red-500' :
                    p.stock <= 5 ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    Stock: {p.stock} {p.unidad_venta}
                    {p.stock <= 0 && ' · Sin stock'}
                    {p.stock > 0 && p.stock <= 5 && ' · Bajo'}
                  </p>
                </div>
                <div className="text-blue-600 font-bold shrink-0 ml-3">{moneda(p.precio)}</div>
              </button>
            ))}
          </div>
        )}
        {query && resultados.length === 0 && !buscando && (
          <p className="mt-2 text-center text-slate-400 text-sm">
            Sin resultados para "<span className="text-slate-600">{query}</span>"
          </p>
        )}
      </div>

      {/* ── Carrito ── */}
      <div className="flex-1 overflow-y-auto px-4 overscroll-contain">
        {carrito.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 select-none gap-3">
            <ShoppingCart size={56} strokeWidth={1} />
            <p className="text-sm font-medium text-slate-400">Busca un producto para comenzar</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-2">
            {carrito.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 leading-tight truncate">{item.nombre}</p>
                  <p className="text-blue-600 text-sm font-medium mt-0.5">{moneda(item.precio)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => cambiarQty(idx, -1)}
                    className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold
                               flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all">
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.cantidad}
                    onChange={e => setQty(idx, e.target.value)}
                    aria-label={`Cantidad de ${item.nombre}`}
                    className="w-12 text-center bg-slate-50 text-slate-800 rounded-xl py-1.5 text-sm
                               border border-slate-200 focus:outline-none focus:border-blue-400"
                    min="0.01" step="1"
                  />
                  <button onClick={() => cambiarQty(idx, 1)}
                    disabled={item.cantidad >= item.stock}
                    aria-label={`Aumentar cantidad de ${item.nombre}`}
                    className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold
                               flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all
                               disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
                    <Plus size={16} />
                  </button>
                </div>

                <div className="text-right shrink-0 min-w-[68px]">
                  <p className="font-bold text-slate-800">{moneda(item.precio * item.cantidad)}</p>
                  <button onClick={() => quitar(idx)} className="text-red-400 hover:text-red-600 text-xs mt-0.5">
                    quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-5">
        {descuento > 0 && (
          <>
            <div className="flex justify-between text-sm text-slate-500 mb-1">
              <span>Subtotal</span><span>{moneda(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-600 mb-1">
              <span>Descuento</span><span>−{moneda(descuento)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-3xl font-bold text-slate-900">{moneda(total)}</span>
          </div>
          <button
            onClick={() => setDescModal(true)}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              descuento > 0
                ? 'text-emerald-600 hover:text-emerald-700'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Tag size={13} />
            {descuento > 0 ? 'Editar desc.' : 'Descuento'}
          </button>
        </div>
        <button
          onClick={() => {
            if (carrito.length === 0) { toast.error('Agrega productos primero'); return }
            onCobrar({ carrito, subtotal, descuento, total })
          }}
          disabled={carrito.length === 0}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                     disabled:bg-slate-100 disabled:text-slate-400
                     text-white text-lg font-bold transition-colors shadow-sm"
        >
          Cobrar {carrito.length > 0 ? moneda(total) : ''}
        </button>
      </div>

      {/* ── Modal: Descuento ── */}
      {descModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-800">Aplicar descuento</h3>
            <div className="flex gap-2">
              {[['pct', '% Porcentaje'], ['monto', '$ Monto fijo']].map(([v, l]) => (
                <button key={v} onClick={() => { setDescTipo(v); setDescValor('') }}
                  className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-colors ${
                    descTipo === v
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-lg w-6 text-center">{descTipo === 'pct' ? '%' : '$'}</span>
              <input type="number" inputMode="decimal" autoFocus
                value={descValor}
                onChange={e => setDescValor(e.target.value)}
                placeholder={descTipo === 'pct' ? 'ej. 10' : 'ej. 50.00'}
                className="flex-1 px-4 py-3 text-2xl font-bold text-right border border-slate-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                min="0"
              />
            </div>
            {descPreview && (
              <p className="text-center text-sm text-slate-500">
                Descuento: <span className="text-emerald-600 font-semibold">{moneda(descPreview.d)}</span>
                {' → '} Total: <span className="font-bold text-slate-800">{moneda(descPreview.t)}</span>
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setDescModal(false); setDescValor('') }}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              {descuento > 0 && (
                <button onClick={() => { setDescuento(0); setDescModal(false); setDescValor('') }}
                  className="flex-1 py-2.5 border border-red-200 bg-red-50 rounded-xl text-sm font-medium text-red-600 hover:bg-red-100">
                  Quitar
                </button>
              )}
              <button onClick={aplicarDescuento}
                className="flex-1 py-2.5 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Menú lateral ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="w-64 bg-white border-l border-slate-200 flex flex-col py-5 px-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-6 px-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">LP</span>
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">La Pastora</p>
                <p className="text-xs text-blue-600">{PUNTOS[punto]?.label}</p>
              </div>
            </div>

            <nav className="flex flex-col gap-0.5 flex-1">
              {[
                { icon: ShoppingCart, label: 'Nueva venta',   action: () => setMenuOpen(false) },
                { icon: BarChart3,    label: 'Corte de caja', action: () => { setMenuOpen(false); onCorte() } },
                { icon: ClipboardList,label: 'Historial',     action: () => { setMenuOpen(false); onHistorial() } },
              ].map(({ icon: Icon, label, action }) => (
                <button key={label} onClick={action}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-600
                             hover:bg-slate-100 hover:text-slate-900 text-left transition-colors font-medium text-sm">
                  <Icon size={18} className="shrink-0" /> {label}
                </button>
              ))}
            </nav>

            <button onClick={onCambiarPunto}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400
                         hover:bg-slate-100 hover:text-slate-600 transition-colors text-sm mt-2">
              <RefreshCw size={16} /> Cambiar punto de venta
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
//  PANTALLA 3: COBRO
// ──────────────────────────────────────────────────────────────
function PantallaCobro({ ventaInfo, punto, onConfirmar, onBack }) {
  const [metodo,      setMetodo]      = useState(null)
  const [montoPagado, setMontoPagado] = useState('')
  const [guardando,   setGuardando]   = useState(false)

  const pago   = parseFloat(montoPagado) || 0
  const cambio = Math.max(0, pago - ventaInfo.total)
  const faltan = Math.max(0, ventaInfo.total - pago)

  const listo =
    metodo === 'tarjeta'       ? true :
    metodo === 'transferencia' ? true :
    metodo === 'efectivo'      ? pago >= ventaInfo.total : false

  async function confirmar() {
    if (!listo) { toast.error('Completa la información de pago'); return }
    setGuardando(true)
    try {
      const venta = await registrarVenta(
        {
          fecha:          new Date().toISOString(),
          punto_venta:    punto,
          subtotal:       ventaInfo.subtotal,
          descuento_total: ventaInfo.descuento,
          total:          ventaInfo.total,
          metodo_pago:    metodo,
          usuario_id:     null,
          notas:          null,
        },
        ventaInfo.carrito
      )
      onConfirmar({ ...ventaInfo, metodo, montoPagado: pago, cambio, ventaId: venta.id })
    } catch (err) {
      toast.error(err?.message || 'Error al guardar la venta')
    } finally {
      setGuardando(false)
    }
  }

  const billetes = [20, 50, 100, 200, 500, 1000].filter(b => b >= ventaInfo.total)

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-xl">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-lg font-semibold text-slate-800">Cobrar</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Total */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
          <p className="text-slate-500 text-sm mb-1">Total a cobrar</p>
          <p className="text-5xl font-bold text-slate-900">{moneda(ventaInfo.total)}</p>
          {ventaInfo.descuento > 0 && (
            <p className="text-emerald-600 text-sm mt-1.5">Descuento aplicado: {moneda(ventaInfo.descuento)}</p>
          )}
          <p className="text-slate-400 text-xs mt-1">
            {ventaInfo.carrito.length} producto{ventaInfo.carrito.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Método de pago */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Método de pago</p>
          <div className="grid grid-cols-3 gap-3">
            {METODOS.map(({ value, label, Icon }) => (
              <button key={value} onClick={() => setMetodo(value)}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 font-medium transition-all active:scale-95
                  ${metodo === value
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'
                  }`}>
                <Icon size={22} />
                <span className="text-xs leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Panel efectivo */}
        {metodo === 'efectivo' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <label className="text-sm font-medium text-slate-700 block">¿Con cuánto paga?</label>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={montoPagado}
              onChange={e => setMontoPagado(e.target.value)}
              placeholder={`ej. ${Math.ceil(ventaInfo.total / 10) * 10}`}
              className="w-full text-right px-4 py-4 text-3xl font-bold border border-slate-200 rounded-2xl
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              min={ventaInfo.total} step="1"
            />
            {billetes.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {billetes.map(b => (
                  <button key={b} onClick={() => setMontoPagado(String(b))}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors">
                    ${b}
                  </button>
                ))}
                <button
                  onClick={() => setMontoPagado(String(Math.ceil(ventaInfo.total / 10) * 10))}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">
                  Redondear ↑
                </button>
              </div>
            )}
            {pago >= ventaInfo.total && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                <p className="text-emerald-700 text-sm">Cambio a entregar</p>
                <p className="text-3xl font-bold text-emerald-700">{moneda(cambio)}</p>
              </div>
            )}
            {pago > 0 && pago < ventaInfo.total && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-red-600 text-sm font-medium">Faltan {moneda(faltan)}</p>
              </div>
            )}
          </div>
        )}

        {(metodo === 'tarjeta' || metodo === 'transferencia') && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center text-blue-700 text-sm">
            {metodo === 'tarjeta'
              ? 'Procesa el pago en la terminal y confirma aquí.'
              : 'Verifica que la transferencia haya llegado antes de confirmar.'}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 px-4 py-4">
        <button onClick={confirmar} disabled={!listo || guardando}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                     disabled:bg-slate-100 disabled:text-slate-400
                     text-white text-lg font-bold transition-colors
                     flex items-center justify-center gap-2">
          {guardando
            ? <><Spinner small /><span>Guardando…</span></>
            : <><CheckCircle size={20} /> Confirmar venta</>
          }
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
//  PANTALLA 4: ÉXITO + TICKET
// ──────────────────────────────────────────────────────────────
function PantallaExito({ venta: v, punto, onNuevaVenta }) {
  const metaLabel = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }

  function imprimirTicket() {
    const SEP  = '─'.repeat(38)
    const lineas = v.carrito.map(i =>
      `  ${i.nombre.slice(0,22).padEnd(22)} x${String(i.cantidad).padStart(3)}\n` +
      `  ${i.unidad ?? ''}  ${moneda(i.precio).padStart(10)} c/u   ${moneda(i.precio * i.cantidad).padStart(10)}`
    ).join('\n')

    const texto = [
      `      LA PASTORA — ${PUNTOS[punto]?.label ?? punto}`.toUpperCase(),
      `  ${new Date().toLocaleString('es-MX')}`,
      SEP, lineas, SEP,
      v.descuento > 0 ? `  SUBTOTAL:          ${moneda(v.subtotal).padStart(14)}` : '',
      v.descuento > 0 ? `  DESCUENTO:        -${moneda(v.descuento).padStart(14)}` : '',
      `  TOTAL:             ${moneda(v.total).padStart(14)}`,
      SEP,
      `  PAGO: ${(v.metodo ?? '').toUpperCase().padEnd(14)} ${moneda(v.montoPagado).padStart(12)}`,
      v.metodo === 'efectivo' ? `  CAMBIO:            ${moneda(v.cambio).padStart(14)}` : '',
      '', `        ¡GRACIAS POR SU COMPRA!`,
    ].filter(Boolean).join('\n')

    const win = window.open('', '_blank', 'width=420,height=640')
    if (win) {
      win.document.write(
        `<html><head><title>Ticket</title><style>
         body{font-family:'Courier New',monospace;font-size:13px;padding:16px;
              white-space:pre;line-height:1.6;background:#fff;color:#000;}
         </style></head><body>${texto.replace(/</g,'&lt;')}</body></html>`
      )
      win.document.close()
      setTimeout(() => win.print(), 400)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white items-center justify-center px-6">
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={44} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">¡Venta registrada!</h2>
        <p className="text-5xl font-bold text-slate-900 mt-2">{moneda(v.total)}</p>
        <p className="text-slate-500 mt-2">{metaLabel[v.metodo] ?? v.metodo}</p>

        {v.metodo === 'efectivo' && v.cambio > 0 && (
          <div className="inline-block bg-emerald-50 border border-emerald-200 rounded-2xl px-8 py-4 mt-5">
            <p className="text-emerald-700 text-sm">Cambio a entregar</p>
            <p className="text-4xl font-bold text-emerald-700">{moneda(v.cambio)}</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm space-y-3">
        <button onClick={imprimirTicket}
          className="w-full py-4 rounded-2xl bg-white border-2 border-slate-200 hover:bg-slate-50
                     text-slate-700 font-semibold text-base flex items-center justify-center gap-2 transition-colors">
          <Printer size={18} /> Imprimir ticket
        </button>
        <button onClick={onNuevaVenta}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition-colors shadow-sm">
          Nueva venta
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
//  PANTALLA 5: CORTE DE CAJA
// ──────────────────────────────────────────────────────────────
function CorteDeCaja({ punto }) {
  const [fecha,     setFecha]     = useState(hoyISO())
  const [ventas,    setVentas]    = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [costosMap, setCostosMap] = useState({})

  useEffect(() => { cargar() }, [fecha, punto]) // eslint-disable-line

  async function cargar() {
    setLoading(true)
    setCostosMap({})
    try {
      const data = await getVentasDia(fecha, punto)
      setVentas(data)

      // Obtener costos de adquisición para calcular utilidad
      const ids = [...new Set(
        data.flatMap(v => (v.items_venta || []).map(i => i.producto_id))
            .filter(Boolean)
      )]
      if (ids.length > 0) {
        const costos = await getCostosProductos(ids)
        setCostosMap(costos)
      }
    } catch (err) {
      toast.error('Error al cargar el corte')
      console.error(err)
    } finally { setLoading(false) }
  }

  const stats = useMemo(() => {
    if (!ventas || ventas.length === 0) return null
    const totales = { efectivo: 0, tarjeta: 0, transferencia: 0 }
    let totalVentas = 0
    let cogs = 0
    let cogsConocido = false
    const prodMap = {}

    ventas.forEach(v => {
      totalVentas += v.total
      totales[v.metodo_pago] = (totales[v.metodo_pago] || 0) + v.total
      ;(v.items_venta || []).forEach(i => {
        const nombre = i.productos?.nombre ?? `#${i.id}`
        if (!prodMap[nombre]) prodMap[nombre] = { cant: 0, sub: 0 }
        prodMap[nombre].cant += Number(i.cantidad)
        prodMap[nombre].sub  += Number(i.subtotal)
        // Acumular costo si está disponible
        const costo = costosMap[i.producto_id]
        if (costo !== undefined) {
          cogs += costo * Number(i.cantidad)
          cogsConocido = true
        }
      })
    })

    const prods = Object.entries(prodMap)
      .map(([nombre, { cant, sub }]) => ({ nombre, cant, sub }))
      .sort((a, b) => b.sub - a.sub)

    const utilidad = cogsConocido ? Math.round((totalVentas - cogs) * 100) / 100 : null

    return { totalVentas, totales, prods, count: ventas.length, utilidad }
  }, [ventas, costosMap])

  function imprimirCorte() {
    if (!stats) return
    const SEP  = '═'.repeat(40)
    const SEP2 = '─'.repeat(40)
    const lineas = stats.prods.map(p =>
      `  ${p.nombre.slice(0,22).padEnd(22)} ${String(p.cant).padStart(5)}  ${moneda(p.sub).padStart(10)}`
    ).join('\n')
    const texto = [
      `  CORTE DE CAJA — ${(PUNTOS[punto]?.label ?? punto).toUpperCase()}`,
      `  Fecha: ${fecha}`, SEP,
      `  TOTAL VENTAS:    ${moneda(stats.totalVentas).padStart(18)}`,
      `  TRANSACCIONES:   ${String(stats.count).padStart(18)}`, SEP2,
      `  EFECTIVO:        ${moneda(stats.totales.efectivo).padStart(18)}`,
      `  TARJETA:         ${moneda(stats.totales.tarjeta).padStart(18)}`,
      `  TRANSFERENCIA:   ${moneda(stats.totales.transferencia).padStart(18)}`,
      ...(stats.utilidad !== null ? [
        SEP2,
        `  UTILIDAD EST.:   ${moneda(stats.utilidad).padStart(18)}`,
      ] : []),
      SEP,
      `  PRODUCTOS VENDIDOS:`,
      `  ${'Producto'.padEnd(22)} ${'Cant'.padStart(5)}  ${'Total'.padStart(10)}`, SEP2,
      lineas,
    ].join('\n')
    const win = window.open('', '_blank', 'width=520,height=740')
    if (win) {
      win.document.write(
        `<html><head><title>Corte</title><style>
         body{font-family:'Courier New',monospace;font-size:12px;padding:16px;white-space:pre;line-height:1.6;}
         </style></head><body>${texto.replace(/</g,'&lt;')}</body></html>`
      )
      win.document.close()
      setTimeout(() => win.print(), 400)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={fecha} max={hoyISO()}
          onChange={e => setFecha(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        <button onClick={cargar}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Actualizar">
          <RefreshCw size={15} />
        </button>
        {stats && (
          <button onClick={imprimirCorte}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors ml-auto">
            <Printer size={14} /> Imprimir
          </button>
        )}
      </div>

      {loading && <div className="flex justify-center py-12"><Spinner /></div>}

      {!loading && !stats && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Receipt size={36} strokeWidth={1.2} />
          <p className="text-sm font-medium">Sin ventas para esta fecha</p>
        </div>
      )}

      {!loading && stats && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium mb-1">TOTAL VENDIDO</p>
              <p className="text-2xl font-bold text-slate-900">{moneda(stats.totalVentas)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium mb-1">TRANSACCIONES</p>
              <p className="text-2xl font-bold text-slate-900">{stats.count}</p>
            </div>
          </div>

          {/* Utilidad estimada */}
          {stats.utilidad !== null && (
            <div className={`rounded-2xl border p-4 ${
              stats.utilidad >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-xs font-medium mb-1 text-slate-500">UTILIDAD ESTIMADA</p>
              <p className={`text-2xl font-bold ${
                stats.utilidad >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}>
                {moneda(stats.utilidad)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Ventas − costo real de adquisición</p>
            </div>
          )}

          {/* Por método */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Por método de pago</p>
            {METODOS.map(({ value, label, Icon }) => (
              <div key={value} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Icon size={15} /> {label}
                </div>
                <span className={`font-bold text-sm ${stats.totales[value] > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                  {moneda(stats.totales[value] || 0)}
                </span>
              </div>
            ))}
          </div>

          {/* Productos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Productos vendidos</p>
            {stats.prods.map(p => (
              <div key={p.nombre} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.nombre}</p>
                  <p className="text-xs text-slate-400">Cantidad: {p.cant}</p>
                </div>
                <span className="font-bold text-sm text-slate-700">{moneda(p.sub)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
//  PANTALLA 6: HISTORIAL DE VENTAS
// ──────────────────────────────────────────────────────────────
function HistorialVentas({ punto: puntoProp, onDetalle }) {
  const [ventas,   setVentas]  = useState([])
  const [loading,  setLoading] = useState(false)
  const [filtros,  setFiltros] = useState({
    desde: hoyISO().slice(0, 7) + '-01',
    hasta: hoyISO(),
    punto: puntoProp || '',
  })

  useEffect(() => { cargar() }, [filtros]) // eslint-disable-line

  async function cargar() {
    setLoading(true)
    try {
      const data = await getHistorial(filtros)
      setVentas(data)
    } catch (err) {
      toast.error('Error al cargar historial')
      console.error(err)
    } finally { setLoading(false) }
  }

  const setF = (k, v) => setFiltros(f => ({ ...f, [k]: v }))

  const totalPeriodo = useMemo(
    () => ventas.filter(v => v.estado !== 'cancelada').reduce((s, v) => s + v.total, 0),
    [ventas]
  )

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Filter size={14} /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['Desde','desde', null, filtros.hasta], ['Hasta','hasta', filtros.desde, hoyISO()]].map(([lbl, key, mn, mx]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs text-slate-500 shrink-0">{lbl}</label>
              <input type="date" value={filtros[key]}
                min={mn || undefined} max={mx || undefined}
                onChange={e => setF(key, e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 shrink-0">Punto</label>
            <select value={filtros.punto} onChange={e => setF('punto', e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              <option value="punto_a">Punto A</option>
              <option value="punto_b">Punto B</option>
            </select>
          </div>
        </div>
      </div>

      {ventas.length > 0 && (
        <p className="text-xs text-slate-500">
          {ventas.length} venta{ventas.length !== 1 ? 's' : ''} ·{' '}
          Total: <span className="font-bold text-slate-700">{moneda(totalPeriodo)}</span>
        </p>
      )}

      {loading && <div className="flex justify-center py-12"><Spinner /></div>}

      {!loading && ventas.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <ClipboardList size={36} strokeWidth={1.2} />
          <p className="text-sm font-medium">Sin ventas en este período</p>
        </div>
      )}

      {!loading && ventas.length > 0 && (
        <>
          {/* Tabla desktop */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  {['Fecha','Punto','Método','Estado','Total',''].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 ${h === 'Total' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 text-xs whitespace-nowrap">
                      {new Date(v.fecha).toLocaleString('es-MX', {
                        day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit',
                        timeZone: 'America/Mexico_City',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{PUNTOS[v.punto_venta]?.label ?? v.punto_venta}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{v.metodo_pago}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        v.estado === 'cancelada'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {v.estado === 'cancelada' ? 'Cancelada' : 'Completada'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${v.estado === 'cancelada' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {moneda(v.total)}
                    </td>
                    <td className="px-4 py-3 pr-5">
                      <button onClick={() => onDetalle(v.id)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-0.5">
                        Ver <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-2">
            {ventas.map(v => (
              <button key={v.id} onClick={() => onDetalle(v.id)}
                className="w-full bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">
                      {new Date(v.fecha).toLocaleString('es-MX', {
                        day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit',
                        timeZone: 'America/Mexico_City',
                      })}
                    </span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      v.estado === 'cancelada' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {v.estado === 'cancelada' ? 'Cancelada' : 'Completada'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {PUNTOS[v.punto_venta]?.label ?? v.punto_venta} · {v.metodo_pago}
                  </p>
                </div>
                <div className={`font-bold text-base shrink-0 ${v.estado === 'cancelada' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {moneda(v.total)}
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
//  PANTALLA 7: DETALLE DE VENTA
// ──────────────────────────────────────────────────────────────
function DetalleVentaPanel({ ventaId, onBack }) {
  const [venta,      setVenta]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [cancelModal,setCancelModal]= useState(false)
  const [motivo,     setMotivo]     = useState('')
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    getDetalleVenta(ventaId)
      .then(setVenta)
      .catch(err => { toast.error('Error al cargar la venta'); console.error(err) })
      .finally(() => setLoading(false))
  }, [ventaId])

  async function cancelar() {
    if (!motivo.trim()) { toast.error('Ingresa el motivo de cancelación'); return }
    setCancelando(true)
    try {
      await cancelarVenta(ventaId, motivo)
      toast.success('Venta cancelada — el inventario se restauró')
      setVenta(v => ({ ...v, estado: 'cancelada', motivo_cancelacion: motivo }))
      setCancelModal(false)
    } catch (err) {
      toast.error(err?.message || 'Error al cancelar')
    } finally { setCancelando(false) }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
        <ChevronLeft size={16} /> Volver al historial
      </button>

      {loading && <div className="flex justify-center py-12"><Spinner /></div>}
      {!loading && !venta && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <AlertCircle size={36} strokeWidth={1.2} />
          <p className="text-sm">Venta no encontrada</p>
        </div>
      )}

      {!loading && venta && (
        <div className="space-y-4">
          {/* Encabezado */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-2xl font-bold text-slate-900">{moneda(venta.total)}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {new Date(venta.fecha).toLocaleString('es-MX', {
                    day:'numeric', month:'long', year:'numeric',
                    hour:'2-digit', minute:'2-digit',
                    timeZone: 'America/Mexico_City',
                  })}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                venta.estado === 'cancelada'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {venta.estado === 'cancelada' ? 'Cancelada' : 'Completada'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-sm">
              {[
                ['Punto',  PUNTOS[venta.punto_venta]?.label ?? venta.punto_venta],
                ['Método', venta.metodo_pago],
                ...(venta.descuento_total > 0 ? [
                  ['Subtotal',  moneda(venta.subtotal)],
                  ['Descuento', `−${moneda(venta.descuento_total)}`],
                ] : []),
                ...(venta.estado === 'cancelada' && venta.motivo_cancelacion
                  ? [['Motivo cancel.', venta.motivo_cancelacion]]
                  : []),
              ].map(([k, v]) => (
                <><span key={k + '_k'} className="text-slate-500">{k}</span>
                <span key={k + '_v'} className="text-right font-medium text-slate-800 capitalize">{v}</span></>
              ))}
            </div>
          </div>

          {/* Ítems */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Productos</p>
            {(venta.items_venta || []).length === 0
              ? <p className="text-sm text-slate-400 text-center py-4">Sin detalle de productos</p>
              : (venta.items_venta || []).map((i, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{i.productos?.nombre ?? `Producto #${idx + 1}`}</p>
                    <p className="text-xs text-slate-400">{i.cantidad} × {moneda(i.precio_unitario)}</p>
                  </div>
                  <p className="font-bold text-sm text-slate-700">{moneda(i.subtotal)}</p>
                </div>
              ))
            }
          </div>

          {/* Cancelar */}
          {venta.estado !== 'cancelada' && (
            <button onClick={() => setCancelModal(true)}
              className="w-full py-3.5 rounded-2xl border-2 border-red-200 bg-red-50 text-red-600
                         hover:bg-red-100 font-medium transition-colors text-sm flex items-center justify-center gap-2">
              <X size={16} /> Cancelar esta venta
            </button>
          )}
        </div>
      )}

      {/* Modal cancelación */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-800">Cancelar venta</h3>
              <button onClick={() => setCancelModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              El inventario se restaurará automáticamente. Proporciona el motivo:
            </p>
            <textarea autoFocus value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="ej. Error en precio, producto devuelto…"
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none
                         focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
            />
            <div className="flex gap-3">
              <button onClick={() => { setCancelModal(false); setMotivo('') }}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cerrar
              </button>
              <button onClick={cancelar} disabled={cancelando}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {cancelando ? <><Spinner small /> Cancelando…</> : <><CheckCircle size={15} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
