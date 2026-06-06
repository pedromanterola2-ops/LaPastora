import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ClipboardList, Plus, Trash2, AlertTriangle,
  ChevronLeft, Send, Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { puntoDeVentaDelRol } from '../lib/permissions'
import {
  getProductosBajoStockPunto,
  crearSolicitud,
} from '../lib/solicitudes'
import { supabase } from '../lib/supabase'

/* ─── helpers ───────────────────────────────────────────────── */
const UBI_LABEL = { punto_a: 'Punto A', punto_b: 'Punto B' }

function Spinner({ sm }) {
  return (
    <div className={`rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin ${
      sm ? 'h-5 w-5' : 'h-8 w-8'
    }`} />
  )
}

/* ─── Fila de item en la lista de solicitud ──────────────────── */
function ItemRow({ item, onCantidad, onNotas, onEliminar }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-slate-100 last:border-0">
      {/* Nombre + info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.nombre}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.categoria} · {item.unidad_venta}
          {' · '}
          <span className={item.stock_actual === 0 ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold'}>
            Stock actual: {item.stock_actual}
          </span>
          {item.existencia_minima != null && (
            <span className="text-slate-400"> (mín. {item.existencia_minima})</span>
          )}
        </p>
      </div>

      {/* Cantidad solicitada */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 whitespace-nowrap">Cant.</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={item.cantidad}
          onChange={(e) => onCantidad(item.producto_id, e.target.value)}
          className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-xs text-slate-400">{item.unidad_venta}</span>
      </div>

      {/* Notas */}
      <div className="flex items-center gap-2 sm:w-44">
        <input
          type="text"
          placeholder="Notas (opcional)"
          value={item.notas}
          onChange={(e) => onNotas(item.producto_id, e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Eliminar */}
      <button
        onClick={() => onEliminar(item.producto_id)}
        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
        aria-label="Quitar producto"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function SolicitudNueva() {
  const navigate   = useNavigate()
  const { profile } = useAuth()
  const punto      = puntoDeVentaDelRol(profile?.rol)

  // Items de la solicitud: { producto_id, nombre, categoria, unidad_venta, existencia_minima, stock_actual, cantidad, notas }
  const [items,        setItems]        = useState([])
  const [notas,        setNotas]        = useState('')
  const [enviando,     setEnviando]     = useState(false)

  // Panel "agregar producto"
  const [busqueda,     setBusqueda]     = useState('')
  const [catalogo,     setCatalogo]     = useState([])  // todos los productos activos
  const [cargandoCat,  setCargandoCat]  = useState(false)
  const [mostrarPanel, setMostrarPanel] = useState(false)

  // Carga inicial: pre-llenar con productos de stock bajo
  const [cargandoBajo, setCargandoBajo] = useState(true)

  useEffect(() => {
    if (!punto) return
    setCargandoBajo(true)
    getProductosBajoStockPunto(punto)
      .then((bajos) => {
        setItems(
          bajos.map((p) => ({
            ...p,
            cantidad: Math.max(1, (p.existencia_minima ?? 0) - p.stock_actual),
            notas: '',
          }))
        )
      })
      .catch(() => toast.error('Error al cargar stock'))
      .finally(() => setCargandoBajo(false))
  }, [punto])

  // Cargar catálogo completo al abrir el panel de agregar
  useEffect(() => {
    if (!mostrarPanel || catalogo.length > 0) return
    setCargandoCat(true)
    supabase
      .from('productos')
      .select('id, nombre, categoria, unidad_venta')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) toast.error('Error al cargar catálogo')
        else setCatalogo(data ?? [])
      })
      .finally(() => setCargandoCat(false))
  }, [mostrarPanel, catalogo.length])

  /* ─── Helpers de items ─────────────────────────────────────── */
  function setCantidad(productoId, val) {
    setItems((prev) =>
      prev.map((it) =>
        it.producto_id === productoId ? { ...it, cantidad: val } : it
      )
    )
  }

  function setNotasItem(productoId, val) {
    setItems((prev) =>
      prev.map((it) =>
        it.producto_id === productoId ? { ...it, notas: val } : it
      )
    )
  }

  function eliminarItem(productoId) {
    setItems((prev) => prev.filter((it) => it.producto_id !== productoId))
  }

  function agregarProducto(prod) {
    if (items.some((it) => it.producto_id === prod.id)) {
      toast('Ese producto ya está en la lista', { icon: 'ℹ️' })
      return
    }
    setItems((prev) => [
      ...prev,
      {
        producto_id: prod.id,
        nombre:      prod.nombre,
        categoria:   prod.categoria,
        unidad_venta: prod.unidad_venta,
        existencia_minima: null,
        stock_actual: null,
        cantidad: 1,
        notas: '',
      },
    ])
    setMostrarPanel(false)
    setBusqueda('')
  }

  /* ─── Enviar ────────────────────────────────────────────────── */
  async function handleEnviar() {
    if (items.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }
    const invalidos = items.filter((it) => !it.cantidad || Number(it.cantidad) < 1)
    if (invalidos.length > 0) {
      toast.error('Revisa las cantidades — deben ser mayor a 0')
      return
    }

    setEnviando(true)
    try {
      await crearSolicitud({
        solicitanteId: profile.id,
        puntoVenta:    punto,
        notas,
        items: items.map((it) => ({
          producto_id: it.producto_id,
          cantidad:    Number(it.cantidad),
          notas:       it.notas,
        })),
      })
      toast.success('Solicitud enviada — el administrador fue notificado')
      navigate('/solicitudes')
    } catch (err) {
      console.error(err)
      toast.error('Error al enviar la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  /* ─── Catálogo filtrado ─────────────────────────────────────── */
  const catalogoFiltrado = catalogo.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.categoria ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/solicitudes')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" />
            Nueva solicitud de reabastecimiento
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{UBI_LABEL[punto]}</p>
        </div>
      </div>

      {/* Card de productos */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Productos a solicitar</h2>
          <button
            onClick={() => setMostrarPanel(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Agregar producto
          </button>
        </div>

        <div className="px-4">
          {cargandoBajo ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center gap-2">
              <AlertTriangle size={28} className="text-amber-400" />
              <p className="text-sm text-slate-500">No se detectaron productos con stock bajo.</p>
              <p className="text-xs text-slate-400">Puedes agregar productos manualmente.</p>
            </div>
          ) : (
            <div>
              {items.map((item) => (
                <ItemRow
                  key={item.producto_id}
                  item={item}
                  onCantidad={setCantidad}
                  onNotas={setNotasItem}
                  onEliminar={eliminarItem}
                />
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-4 pb-3 pt-1">
            <p className="text-xs text-slate-400">{items.length} producto{items.length !== 1 ? 's' : ''} en la lista</p>
          </div>
        )}
      </div>

      {/* Notas generales */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Notas adicionales <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <textarea
          rows={3}
          placeholder="Urgencias, contexto, prioridad…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Botón enviar */}
      <button
        onClick={handleEnviar}
        disabled={enviando || items.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
      >
        {enviando ? (
          <Spinner sm />
        ) : (
          <>
            <Send size={16} />
            Enviar solicitud al administrador
          </>
        )}
      </button>

      {/* Panel lateral: agregar producto ──────────────────────── */}
      {mostrarPanel && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => { setMostrarPanel(false); setBusqueda('') }}
          />
          <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Agregar producto</h3>
              <button
                onClick={() => { setMostrarPanel(false); setBusqueda('') }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Buscador */}
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar producto…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {cargandoCat ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : catalogoFiltrado.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Sin resultados</p>
              ) : (
                catalogoFiltrado.map((prod) => {
                  const yaAgregado = items.some((it) => it.producto_id === prod.id)
                  return (
                    <button
                      key={prod.id}
                      onClick={() => !yaAgregado && agregarProducto(prod)}
                      disabled={yaAgregado}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${
                        yaAgregado
                          ? 'opacity-40 cursor-default'
                          : 'hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-800">{prod.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{prod.categoria} · {prod.unidad_venta}</p>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
