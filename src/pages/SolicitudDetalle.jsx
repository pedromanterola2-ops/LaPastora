import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ClipboardList, ChevronLeft, CheckCircle2, XCircle,
  Eye, Save,
} from 'lucide-react'
import { fechaCorta } from '../lib/format'
import {
  getSolicitud,
  revisarSolicitud,
  ESTADO_SOLICITUD_LABEL,
  ESTADO_SOLICITUD_COLOR,
} from '../lib/solicitudes'
import { useAuth } from '../context/AuthContext'

/* ─── helpers ───────────────────────────────────────────────── */
const UBI_LABEL = { punto_a: 'Punto A', punto_b: 'Punto B' }
const UBI_COLOR = {
  punto_a: 'bg-blue-100 text-blue-700',
  punto_b: 'bg-violet-100 text-violet-700',
}

function Spinner({ sm }) {
  return (
    <div className={`rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin ${
      sm ? 'h-5 w-5' : 'h-8 w-8'
    }`} />
  )
}

function EstadoBadge({ estado }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADO_SOLICITUD_COLOR[estado] ?? 'bg-slate-100 text-slate-600'}`}>
      {ESTADO_SOLICITUD_LABEL[estado] ?? estado}
    </span>
  )
}

/* ─── Fila de item (admin) ──────────────────────────────────── */
function ItemRowAdmin({ item, onAprobada, onNotasItem, editable }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-slate-100 last:border-0">
      {/* Producto */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.producto?.nombre}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.producto?.categoria} · {item.producto?.unidad_venta}
        </p>
        {item.notas && (
          <p className="text-xs text-slate-500 mt-0.5 italic">"{item.notas}"</p>
        )}
      </div>

      {/* Solicitado */}
      <div className="flex items-center gap-1.5 sm:w-28">
        <span className="text-xs text-slate-500 whitespace-nowrap">Solicitado:</span>
        <span className="text-sm font-semibold text-slate-700 tabular-nums">
          {item.cantidad_solicitada} <span className="font-normal text-slate-400">{item.producto?.unidad_venta}</span>
        </span>
      </div>

      {/* Cantidad aprobada (editable para admin) */}
      {editable ? (
        <div className="flex items-center gap-1.5 sm:w-40">
          <label className="text-xs text-slate-500 whitespace-nowrap">Aprobado:</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="—"
            value={item._aprobada ?? ''}
            onChange={(e) => onAprobada(item.id, e.target.value)}
            className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 sm:w-40">
          <span className="text-xs text-slate-500">Aprobado:</span>
          <span className={`text-sm font-semibold tabular-nums ${
            item.cantidad_aprobada != null ? 'text-green-700' : 'text-slate-400'
          }`}>
            {item.cantidad_aprobada != null
              ? `${item.cantidad_aprobada} ${item.producto?.unidad_venta}`
              : '—'}
          </span>
        </div>
      )}

      {/* Notas admin por item */}
      {editable && (
        <div className="sm:w-44">
          <input
            type="text"
            placeholder="Nota del admin (opcional)"
            value={item._notasAdmin ?? ''}
            onChange={(e) => onNotasItem(item.id, e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}
    </div>
  )
}

/* ─── Fila de item (solo lectura) ───────────────────────────── */
function ItemRowLectura({ item }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.producto?.nombre}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.producto?.categoria} · {item.producto?.unidad_venta}
        </p>
        {item.notas && (
          <p className="text-xs text-slate-500 mt-0.5 italic">"{item.notas}"</p>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-xs text-slate-400">Solicitado: </span>
          <span className="font-semibold text-slate-700">{item.cantidad_solicitada} {item.producto?.unidad_venta}</span>
        </div>
        {item.cantidad_aprobada != null && (
          <div>
            <span className="text-xs text-slate-400">Aprobado: </span>
            <span className="font-semibold text-green-700">{item.cantidad_aprobada} {item.producto?.unidad_venta}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function SolicitudDetalle() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const { profile }   = useAuth()
  const esAdmin       = profile?.rol === 'admin'

  const [solicitud, setSolicitud] = useState(null)
  const [cargando,  setCargando]  = useState(true)

  // Estado editable (admin)
  const [itemsEdit,    setItemsEdit]    = useState([])
  const [notasAdmin,   setNotasAdmin]   = useState('')
  const [guardando,    setGuardando]    = useState(false)

  useEffect(() => {
    setCargando(true)
    getSolicitud(id)
      .then((data) => {
        setSolicitud(data)
        if (esAdmin) {
          setNotasAdmin(data.notas_admin ?? '')
          setItemsEdit(
            (data.items ?? []).map((it) => ({
              ...it,
              _aprobada:    it.cantidad_aprobada != null ? String(it.cantidad_aprobada) : '',
              _notasAdmin:  it.notas ?? '',
            }))
          )
        }
      })
      .catch(() => toast.error('Error al cargar la solicitud'))
      .finally(() => setCargando(false))
  }, [id, esAdmin])

  /* ─── helpers edición ───────────────────────────────────────── */
  function setAprobada(itemId, val) {
    setItemsEdit((prev) =>
      prev.map((it) => it.id === itemId ? { ...it, _aprobada: val } : it)
    )
  }

  function setNotasItem(itemId, val) {
    setItemsEdit((prev) =>
      prev.map((it) => it.id === itemId ? { ...it, _notasAdmin: val } : it)
    )
  }

  async function guardar(estadoNuevo) {
    setGuardando(true)
    try {
      await revisarSolicitud({
        solicitudId: id,
        estado:      estadoNuevo,
        notasAdmin,
        items: itemsEdit.map((it) => ({
          id:                it.id,
          cantidad_aprobada: it._aprobada !== '' ? Number(it._aprobada) : null,
          notas:             it._notasAdmin || null,
        })),
      })

      const labelEstado = {
        revisada:  'Solicitud marcada como revisada',
        aprobada:  'Solicitud aprobada ✓',
        rechazada: 'Solicitud rechazada',
      }
      toast.success(labelEstado[estadoNuevo] ?? 'Actualizado')
      navigate('/solicitudes')
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  /* ─── Loading ────────────────────────────────────────────────── */
  if (cargando) {
    return (
      <div className="flex justify-center py-20"><Spinner /></div>
    )
  }

  if (!solicitud) {
    return (
      <div className="text-center py-20 text-slate-400">Solicitud no encontrada</div>
    )
  }

  const puedeEditar = esAdmin && ['pendiente', 'revisada'].includes(solicitud.estado)

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/solicitudes')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600" />
              Solicitud de reabastecimiento
            </h1>
            <EstadoBadge estado={solicitud.estado} />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {fechaCorta(solicitud.fecha)}
            {esAdmin && (
              <>
                {' · '}
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${UBI_COLOR[solicitud.punto_venta]}`}>
                  {UBI_LABEL[solicitud.punto_venta]}
                </span>
                {solicitud.solicitante?.nombre && (
                  <> · {solicitud.solicitante.nombre}</>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Notas del solicitante */}
      {solicitud.notas && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Notas del punto de venta</p>
          <p className="text-sm text-amber-800">{solicitud.notas}</p>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Productos solicitados
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({(solicitud.items ?? []).length})
            </span>
          </h2>
        </div>

        <div className="px-4">
          {(solicitud.items ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Sin items</p>
          ) : puedeEditar ? (
            itemsEdit.map((item) => (
              <ItemRowAdmin
                key={item.id}
                item={item}
                onAprobada={setAprobada}
                onNotasItem={setNotasItem}
                editable
              />
            ))
          ) : (
            (solicitud.items ?? []).map((item) => (
              <ItemRowLectura key={item.id} item={item} />
            ))
          )}
        </div>
      </div>

      {/* Notas del admin — solo lectura si ya está cerrada */}
      {esAdmin ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Respuesta / notas del administrador
          </label>
          {puedeEditar ? (
            <textarea
              rows={3}
              placeholder="Agrega una nota de respuesta para el punto de venta…"
              value={notasAdmin}
              onChange={(e) => setNotasAdmin(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 min-h-[4rem]">
              {solicitud.notas_admin || <span className="text-slate-400 italic">Sin notas</span>}
            </p>
          )}
        </div>
      ) : solicitud.notas_admin ? (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">Respuesta del administrador</p>
          <p className="text-sm text-blue-800">{solicitud.notas_admin}</p>
        </div>
      ) : null}

      {/* Acciones admin ─────────────────────────────────────────── */}
      {puedeEditar && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => guardar('revisada')}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {guardando ? <Spinner sm /> : <><Eye size={16} /> Marcar como revisada</>}
          </button>
          <button
            onClick={() => guardar('rechazada')}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {guardando ? <Spinner sm /> : <><XCircle size={16} /> Rechazar</>}
          </button>
          <button
            onClick={() => guardar('aprobada')}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {guardando ? <Spinner sm /> : <><CheckCircle2 size={16} /> Aprobar</>}
          </button>
        </div>
      )}

      {/* Información de estado para puntos de venta */}
      {!esAdmin && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          solicitud.estado === 'aprobada'  ? 'bg-green-50 border-green-100 text-green-800' :
          solicitud.estado === 'rechazada' ? 'bg-red-50  border-red-100   text-red-800'   :
          solicitud.estado === 'revisada'  ? 'bg-blue-50 border-blue-100  text-blue-800'  :
          'bg-amber-50 border-amber-100 text-amber-800'
        }`}>
          {solicitud.estado === 'pendiente'  && 'Tu solicitud está pendiente de revisión por el administrador.'}
          {solicitud.estado === 'revisada'   && 'El administrador ha revisado tu solicitud. Espera la aprobación final.'}
          {solicitud.estado === 'aprobada'   && '¡Solicitud aprobada! Los productos serán transferidos al punto de venta.'}
          {solicitud.estado === 'rechazada'  && 'Esta solicitud fue rechazada. Consulta con el administrador para más detalles.'}
        </div>
      )}
    </div>
  )
}
