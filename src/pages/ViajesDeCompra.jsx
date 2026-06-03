import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingBag, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  moneda, fechaCorta,
  totalGastosViaje, totalMerchViaje,
  ESTADO_VIAJE,
} from '../lib/format'

export default function ViajesDeCompra() {
  const navigate = useNavigate()
  const [viajes, setViajes]           = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading]         = useState(true)
  const [filtroEstado, setFiltroEstado]         = useState('')
  const [filtroProveedor, setFiltroProveedor]   = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: vData }, { data: pData }] = await Promise.all([
      supabase
        .from('viajes_compra')
        .select(`
          id, fecha, estado, proveedor_id,
          gastos_gasolina, gastos_casetas, gastos_comida, gastos_hospedaje, gastos_otros,
          proveedores(nombre),
          items_viaje(cantidad, precio_unitario_compra)
        `)
        .order('fecha', { ascending: false }),
      supabase
        .from('proveedores')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
    ])
    setViajes(vData || [])
    setProveedores(pData || [])
    setLoading(false)
  }

  const filtrados = viajes.filter(v => {
    if (filtroEstado    && v.estado       !== filtroEstado)    return false
    if (filtroProveedor && v.proveedor_id !== filtroProveedor) return false
    return true
  })

  /* ─── Métricas rápidas ──────────────────────────────────────── */
  const totalCompletados = viajes.filter(v => v.estado === 'completado').length
  const totalEnCurso     = viajes.filter(v => v.estado === 'en_curso').length
  const totalPlaneados   = viajes.filter(v => v.estado === 'planeado').length

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 border-b-2 border-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Viajes de Compra</h1>
          <p className="text-sm text-slate-500 mt-0.5">{viajes.length} viajes registrados</p>
        </div>
        <button
          onClick={() => navigate('/viajes/nuevo')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo viaje
        </button>
      </div>

      {/* ── Chips de resumen ── */}
      {viajes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { label: `${totalPlaneados} planeado${totalPlaneados !== 1 ? 's' : ''}`,   cls: 'bg-slate-100 text-slate-600', onClick: () => setFiltroEstado(filtroEstado === 'planeado' ? '' : 'planeado') },
            { label: `${totalEnCurso} en curso`,                                        cls: 'bg-amber-50 text-amber-700',  onClick: () => setFiltroEstado(filtroEstado === 'en_curso' ? '' : 'en_curso') },
            { label: `${totalCompletados} completado${totalCompletados !== 1 ? 's' : ''}`, cls: 'bg-emerald-50 text-emerald-700', onClick: () => setFiltroEstado(filtroEstado === 'completado' ? '' : 'completado') },
          ].map(chip => (
            <button key={chip.label} onClick={chip.onClick}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${chip.cls} hover:opacity-80`}>
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Filtros ── */}
      {viajes.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_VIAJE).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>

          <select
            value={filtroProveedor}
            onChange={e => setFiltroProveedor(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          {(filtroEstado || filtroProveedor) && (
            <button
              onClick={() => { setFiltroEstado(''); setFiltroProveedor('') }}
              className="text-sm text-blue-600 hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtrados.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <ShoppingBag size={40} strokeWidth={1.2} />
          <p className="text-sm font-medium">
            {viajes.length > 0 ? 'Sin resultados con esos filtros' : 'Sin viajes registrados'}
          </p>
          {!viajes.length && (
            <p className="text-xs">Registra tu primer viaje de compra para comenzar</p>
          )}
        </div>
      )}

      {/* ── Cards grid ── */}
      {filtrados.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map(v => {
            const gastos = totalGastosViaje(v)
            const merch  = totalMerchViaje(v.items_viaje)
            const total  = gastos + merch
            const estado = ESTADO_VIAJE[v.estado] || { label: v.estado, cls: 'bg-slate-100 text-slate-600 border-slate-200' }

            return (
              <div
                key={v.id}
                onClick={() => navigate(`/viajes/${v.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate leading-tight">
                      {v.proveedores?.nombre || '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{fechaCorta(v.fecha)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${estado.cls}`}>
                      {estado.label}
                    </span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>

                <div className="space-y-1 pt-3 border-t border-slate-100 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mercancía</span>
                    <span className="font-medium text-slate-700">{moneda(merch)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gastos de traslado</span>
                    <span className="font-medium text-slate-700">{moneda(gastos)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-100 mt-1">
                    <span className="font-semibold text-slate-700">Total</span>
                    <span className="font-bold text-slate-900">{moneda(total)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
