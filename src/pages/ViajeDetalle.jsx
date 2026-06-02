import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Calendar, Truck, Package,
  ClipboardCheck, ChevronRight, RefreshCw, Boxes,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  moneda, fechaLarga, GASTOS_KEYS, GASTOS_LABELS,
  totalGastosViaje, totalMerchViaje, ESTADO_VIAJE,
} from '../lib/format'

/* ─── Badge de estado ────────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const e = ESTADO_VIAJE[estado] || { label: estado, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${e.cls}`}>
      {e.label}
    </span>
  )
}

/* ─── Página ─────────────────────────────────────────────────── */
export default function ViajeDetalle() {
  const navigate        = useNavigate()
  const { id }          = useParams()
  const [viaje,  setViaje]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('viajes_compra')
      .select(`
        *,
        proveedores(nombre, ciudad),
        items_viaje(
          id, cantidad, precio_unitario_compra,
          costo_traslado_asignado, costo_real_unitario,
          productos(nombre, categoria, unidad_venta)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      toast.error('No se pudo cargar el viaje')
      navigate('/viajes')
      return
    }
    setViaje(data)
    setLoading(false)
  }

  /* Marcar como "en curso" */
  async function marcarEnCurso() {
    setCambiandoEstado(true)
    const { error } = await supabase
      .from('viajes_compra')
      .update({ estado: 'en_curso' })
      .eq('id', id)

    if (error) {
      toast.error('Error al actualizar estado')
    } else {
      setViaje(v => ({ ...v, estado: 'en_curso' }))
      toast.success('Viaje marcado como en curso')
    }
    setCambiandoEstado(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 border-b-2 border-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!viaje) return null

  const items    = viaje.items_viaje || []
  const gastos   = totalGastosViaje(viaje)
  const merch    = totalMerchViaje(items)
  const total    = gastos + merch
  const completo = viaje.estado === 'completado'

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/viajes')}
          className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                {viaje.proveedores?.nombre || '—'}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Calendar size={12} />
                  {fechaLarga(viaje.fecha)}
                </span>
                {viaje.proveedores?.ciudad && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} />
                    {viaje.proveedores.ciudad}
                  </span>
                )}
              </div>
            </div>
            <EstadoBadge estado={viaje.estado} />
          </div>
        </div>
      </div>

      {/* ── Acciones contextuales ── */}
      {!completo && (
        <div className="flex flex-col sm:flex-row gap-3">
          {viaje.estado === 'planeado' && (
            <>
              <button
                onClick={() => navigate(`/viajes/${id}/planificacion`)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 bg-white transition-colors"
              >
                <Boxes size={16} />
                Ver planificación de stock
              </button>
              <button
                onClick={marcarEnCurso}
                disabled={cambiandoEstado}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-200 rounded-xl text-sm font-medium text-amber-700 hover:bg-amber-50 bg-amber-50/50 transition-colors disabled:opacity-50"
              >
                <Truck size={16} />
                {cambiandoEstado ? 'Actualizando…' : 'Marcar como en curso'}
              </button>
            </>
          )}

          <button
            onClick={() => navigate(`/viajes/${id}/recepcion`)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <ClipboardCheck size={16} />
            Recibir mercancía
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Info del viaje ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Detalles del viaje</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Gastos */}
          {GASTOS_KEYS.filter(k => Number(viaje[k]) > 0).length > 0 && (
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Truck size={14} className="text-slate-400" />
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Gastos de traslado</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                {GASTOS_KEYS.filter(k => Number(viaje[k]) > 0).map(k => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-slate-500">{GASTOS_LABELS[k]}</span>
                    <span className="font-medium text-slate-800">{moneda(viaje[k])}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm border-t border-slate-200 pt-1.5 mt-1">
                  <span className="font-semibold text-slate-700">Subtotal gastos</span>
                  <span className="font-bold text-slate-900">{moneda(gastos)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          {viaje.notas && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-1">Notas</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{viaje.notas}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabla de productos ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Productos comprados</h2>
            <span className="text-xs text-slate-400">({items.length})</span>
          </div>
          {completo && (
            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
              Costos calculados
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <Package size={32} strokeWidth={1.2} />
            <p className="text-sm">Sin productos registrados en este viaje</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">Producto</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 text-right w-20">Cant.</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 text-right w-28">Precio/u</th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 text-right w-28">Subtotal</th>
                    {completo && (
                      <th className="px-5 py-3 text-xs font-semibold text-blue-600 text-right w-28">Costo real/u</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => {
                    const sub = Number(item.cantidad) * Number(item.precio_unitario_compra)
                    return (
                      <tr key={item.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800 leading-tight">
                            {item.productos?.nombre || '—'}
                          </p>
                          {item.productos?.categoria && (
                            <p className="text-xs text-slate-400 mt-0.5">{item.productos.categoria}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {item.cantidad} <span className="text-xs text-slate-400">{item.productos?.unidad_venta}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">{moneda(item.precio_unitario_compra)}</td>
                        <td className="px-3 py-3 text-right font-medium text-slate-800">{moneda(sub)}</td>
                        {completo && (
                          <td className="px-5 py-3 text-right font-bold text-blue-700">
                            {moneda(item.costo_real_unitario)}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Totales ── */}
            <div className="bg-slate-900 text-white px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Mercancía ({items.length} productos)</span>
                <span className="font-medium">{moneda(merch)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Gastos de traslado</span>
                <span className="font-medium">{moneda(gastos)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-700 pt-2.5 mt-1">
                <span>Total del viaje</span>
                <span className="text-blue-300 text-base">{moneda(total)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Nota si ya está completado ── */}
      {completo && (
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          <ClipboardCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
          <p>
            <strong>Mercancía recibida.</strong>{' '}
            El inventario central fue actualizado automáticamente al completar este viaje.
            Los costos reales incluyen la distribución proporcional de los gastos de traslado.
          </p>
        </div>
      )}
    </div>
  )
}
