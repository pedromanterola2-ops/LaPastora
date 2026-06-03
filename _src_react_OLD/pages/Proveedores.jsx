import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Users, Star, MapPin,
  Clock, AlertCircle, CheckCircle, XCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ─── Estrellas de solo lectura ─────────────────────────────── */
function StarDisplay({ value, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          className={n <= value
            ? 'fill-amber-400 text-amber-400'
            : 'fill-slate-200 text-slate-200'}
        />
      ))}
    </div>
  )
}

/* ─── Indicador de visita ────────────────────────────────────── */
function VisitaBadge({ frecuencia, ultimaFecha }) {
  if (!frecuencia) return null

  if (!ultimaFecha) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Clock size={12} />
        Sin visitas
      </span>
    )
  }

  const diasTranscurridos = Math.floor(
    (Date.now() - new Date(ultimaFecha).getTime()) / 86_400_000
  )
  const vencida = diasTranscurridos > frecuencia

  if (vencida) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <AlertCircle size={11} />
        {diasTranscurridos}d sin visita (cada {frecuencia}d)
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <CheckCircle size={11} />
      Visitado hace {diasTranscurridos}d
    </span>
  )
}

/* ─── Badge de estado ────────────────────────────────────────── */
function EstadoBadge({ activo }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
      activo
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-500 border-slate-200'
    }`}>
      {activo ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

/* ─── Página principal ───────────────────────────────────────── */
export default function Proveedores() {
  const navigate = useNavigate()
  const [proveedores, setProveedores] = useState([])
  const [ultimasVisitas, setUltimasVisitas] = useState({})
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [{ data: provData, error: provErr }, { data: viajes, error: viajesErr }] =
        await Promise.all([
          supabase.from('proveedores').select('*').order('nombre'),
          supabase
            .from('viajes_compra')
            .select('proveedor_id, fecha')
            .order('fecha', { ascending: false }),
        ])

      if (provErr) throw provErr
      if (viajesErr) throw viajesErr

      // Construir mapa proveedor_id → fecha más reciente
      const mapa = {}
      viajes?.forEach(v => {
        if (!mapa[v.proveedor_id]) mapa[v.proveedor_id] = v.fecha
      })

      setProveedores(provData || [])
      setUltimasVisitas(mapa)
    } catch (err) {
      console.error('Error cargando proveedores:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtrados = proveedores.filter(p => {
    const q = busqueda.toLowerCase()
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.ciudad || '').toLowerCase().includes(q)
    )
  })

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Proveedores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} registrado{proveedores.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/proveedores/nuevo')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo proveedor
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre o ciudad…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder-slate-400"
        />
      </div>

      {/* Estado vacío */}
      {filtrados.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Users size={40} strokeWidth={1.2} />
            <p className="text-sm font-medium">
              {busqueda ? 'Sin resultados para esa búsqueda' : 'Sin proveedores registrados'}
            </p>
            {!busqueda && (
              <p className="text-xs">Agrega tu primer proveedor para comenzar</p>
            )}
          </div>
        </div>
      )}

      {filtrados.length > 0 && (
        <>
          {/* ── Tabla (≥ sm) ── */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ciudad</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Productos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Calificación</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Última visita</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/proveedores/${p.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.ciudad
                        ? <span className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400 shrink-0" />{p.ciudad}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                      {p.tipo_productos || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {p.calificacion
                        ? <StarDisplay value={p.calificacion} />
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <VisitaBadge frecuencia={p.frecuencia_visita_dias} ultimaFecha={ultimasVisitas[p.id]} />
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge activo={p.activo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Cards (< sm) ── */}
          <div className="sm:hidden space-y-3">
            {filtrados.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/proveedores/${p.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer active:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">{p.nombre}</h3>
                    {p.ciudad && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} />
                        {p.ciudad}
                      </p>
                    )}
                  </div>
                  <EstadoBadge activo={p.activo} />
                </div>

                {p.tipo_productos && (
                  <p className="text-sm text-slate-600 mb-2 truncate">{p.tipo_productos}</p>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {p.calificacion
                    ? <StarDisplay value={p.calificacion} />
                    : <span />
                  }
                  <VisitaBadge frecuencia={p.frecuencia_visita_dias} ultimaFecha={ultimasVisitas[p.id]} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
