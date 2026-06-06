import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, RefreshCw, ChevronRight } from 'lucide-react'
import { fechaCorta } from '../lib/format'
import {
  getSolicitudes,
  ESTADO_SOLICITUD_LABEL,
  ESTADO_SOLICITUD_COLOR,
} from '../lib/solicitudes'
import { useAuth } from '../context/AuthContext'
import { puntoDeVentaDelRol } from '../lib/permissions'

/* ─── helpers ───────────────────────────────────────────────── */
const UBI_LABEL  = { punto_a: 'Punto A', punto_b: 'Punto B' }
const UBI_COLOR  = {
  punto_a: 'bg-blue-100   text-blue-700',
  punto_b: 'bg-violet-100 text-violet-700',
}
const ESTADOS_FILTRO = ['todos', 'pendiente', 'revisada', 'aprobada', 'rechazada']
const ESTADO_FILTRO_LABEL = {
  todos:     'Todos',
  pendiente: 'Pendientes',
  revisada:  'Revisadas',
  aprobada:  'Aprobadas',
  rechazada: 'Rechazadas',
}

function Spinner() {
  return (
    <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
  )
}

function EstadoBadge({ estado }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_SOLICITUD_COLOR[estado] ?? 'bg-slate-100 text-slate-600'}`}>
      {ESTADO_SOLICITUD_LABEL[estado] ?? estado}
    </span>
  )
}

function PuntoBadge({ punto }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${UBI_COLOR[punto] ?? 'bg-slate-100 text-slate-600'}`}>
      {UBI_LABEL[punto] ?? punto}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function Solicitudes() {
  const navigate      = useNavigate()
  const { profile }   = useAuth()
  const esAdmin       = profile?.rol === 'admin'
  const punto         = puntoDeVentaDelRol(profile?.rol)

  const [solicitudes, setSolicitudes] = useState([])
  const [cargando,    setCargando]    = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const data = await getSolicitudes(esAdmin ? {} : { punto })
      setSolicitudes(data)
    } catch {
      // silencioso — el usuario ve lista vacía
    } finally {
      setCargando(false)
    }
  }, [esAdmin, punto])

  useEffect(() => { cargar() }, [cargar])

  /* ─── Filtrar ───────────────────────────────────────────────── */
  const lista = filtroEstado === 'todos'
    ? solicitudes
    : solicitudes.filter((s) => s.estado === filtroEstado)

  const pendienteCount = solicitudes.filter((s) => s.estado === 'pendiente').length

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" />
            Solicitudes de reabastecimiento
          </h1>
          {esAdmin && pendienteCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendienteCount} pendiente{pendienteCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cargar}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Recargar"
          >
            <RefreshCw size={16} />
          </button>
          {/* Solo los puntos de venta pueden crear solicitudes */}
          {!esAdmin && (
            <button
              onClick={() => navigate('/solicitudes/nueva')}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} />
              Nueva solicitud
            </button>
          )}
        </div>
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-1.5 flex-wrap">
        {ESTADOS_FILTRO.map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              filtroEstado === e
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {ESTADO_FILTRO_LABEL[e]}
            {e === 'pendiente' && pendienteCount > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                filtroEstado === 'pendiente' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'
              }`}>
                {pendienteCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : lista.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <ClipboardList size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">
            {solicitudes.length === 0
              ? 'No hay solicitudes todavía'
              : 'Ninguna solicitud coincide con el filtro'}
          </p>
          {!esAdmin && solicitudes.length === 0 && (
            <button
              onClick={() => navigate('/solicitudes/nueva')}
              className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} />
              Crear primera solicitud
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tabla — desktop */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Fecha</th>
                  {esAdmin && <th className="text-left px-4 py-3">Punto</th>}
                  {esAdmin && <th className="text-left px-4 py-3">Solicitante</th>}
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Notas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/solicitudes/${s.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-700">{fechaCorta(s.fecha)}</td>
                    {esAdmin && (
                      <td className="px-4 py-3">
                        <PuntoBadge punto={s.punto_venta} />
                      </td>
                    )}
                    {esAdmin && (
                      <td className="px-4 py-3 text-slate-600">{s.solicitante?.nombre ?? '—'}</td>
                    )}
                    <td className="px-4 py-3">
                      <EstadoBadge estado={s.estado} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                      {s.notas || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="sm:hidden space-y-3">
            {lista.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/solicitudes/${s.id}`)}
                className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EstadoBadge estado={s.estado} />
                    {esAdmin && <PuntoBadge punto={s.punto_venta} />}
                  </div>
                  <ChevronRight size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                </div>
                <p className="text-sm text-slate-700">{fechaCorta(s.fecha)}</p>
                {esAdmin && (
                  <p className="text-xs text-slate-400 mt-0.5">{s.solicitante?.nombre ?? '—'}</p>
                )}
                {s.notas && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{s.notas}</p>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
