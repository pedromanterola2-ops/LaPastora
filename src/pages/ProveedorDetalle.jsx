import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Star, MapPin, Clock,
  Package, Truck, CreditCard, FileText,
  Plus, Calendar, ToggleLeft, ToggleRight,
  CheckCircle, XCircle, ShoppingCart,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

/* ─── Helpers ────────────────────────────────────────────────── */
const CONDICIONES_LABEL = {
  contado:    'Contado',
  credito_7:  'Crédito 7 días',
  credito_15: 'Crédito 15 días',
  credito_30: 'Crédito 30 días',
  otro:       'Otro',
}

const ESTADO_VIAJE = {
  planeado:   { label: 'Planeado',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  en_curso:   { label: 'En curso',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  completado: { label: 'Completado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

function moneda(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function fecha(str) {
  if (!str) return '—'
  // Las fechas tipo DATE de Postgres vienen como "YYYY-MM-DD"; forzar UTC para evitar desfase
  const d = new Date(`${str}T12:00:00`)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ─── Estrellas ──────────────────────────────────────────────── */
function StarDisplay({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={16}
          className={n <= value
            ? 'fill-amber-400 text-amber-400'
            : 'fill-slate-200 text-slate-200'}
        />
      ))}
    </div>
  )
}

/* ─── Fila de dato con icono ─────────────────────────────────── */
function InfoFila({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={15} className="text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <div className="text-sm text-slate-800">{children}</div>
      </div>
    </div>
  )
}

/* ─── Total de un viaje ──────────────────────────────────────── */
function calcTotalViaje(viaje) {
  const gastos =
    (viaje.gastos_gasolina  || 0) +
    (viaje.gastos_casetas   || 0) +
    (viaje.gastos_comida    || 0) +
    (viaje.gastos_hospedaje || 0) +
    (viaje.gastos_otros     || 0)
  const merch = (viaje.items_viaje || []).reduce(
    (acc, item) => acc + Number(item.cantidad) * Number(item.precio_unitario_compra),
    0
  )
  return gastos + merch
}

/* ─── Página ─────────────────────────────────────────────────── */
export default function ProveedorDetalle() {
  const navigate   = useNavigate()
  const { id }     = useParams()

  const [proveedor, setProveedor] = useState(null)
  const [viajes,    setViajes]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toggling,  setToggling]  = useState(false)

  useEffect(() => { cargarDatos() }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [{ data: prov, error: eProv }, { data: viajesData, error: eViajes }] =
        await Promise.all([
          supabase.from('proveedores').select('*').eq('id', id).single(),
          supabase
            .from('viajes_compra')
            .select(`
              id, fecha, estado,
              gastos_gasolina, gastos_casetas, gastos_comida,
              gastos_hospedaje, gastos_otros, notas,
              items_viaje (
                id, cantidad, precio_unitario_compra,
                productos ( nombre, unidad_venta )
              )
            `)
            .eq('proveedor_id', id)
            .order('fecha', { ascending: false })
            .limit(5),
        ])

      if (eProv)    throw eProv
      if (eViajes)  throw eViajes

      setProveedor(prov)
      setViajes(viajesData || [])
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar el proveedor')
      navigate('/proveedores')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActivo() {
    if (!proveedor || toggling) return
    setToggling(true)

    const nuevoEstado = !proveedor.activo
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: nuevoEstado })
      .eq('id', id)

    if (error) {
      toast.error('Error al actualizar el estado')
    } else {
      setProveedor(p => ({ ...p, activo: nuevoEstado }))
      toast.success(nuevoEstado ? 'Proveedor activado' : 'Proveedor desactivado')
    }
    setToggling(false)
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!proveedor) return null

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/proveedores')}
          className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{proveedor.nombre}</h1>
              {proveedor.ciudad && (
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <MapPin size={13} />
                  {proveedor.ciudad}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${
                proveedor.activo
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {proveedor.activo ? <CheckCircle size={11} /> : <XCircle size={11} />}
                {proveedor.activo ? 'Activo' : 'Inactivo'}
              </span>

              <button
                onClick={() => navigate(`/proveedores/${id}/editar`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={14} />
                Editar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info del proveedor ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Información</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">

          {proveedor.tipo_productos && (
            <InfoFila icon={Package} label="Tipo de productos">
              {proveedor.tipo_productos}
            </InfoFila>
          )}

          {proveedor.calificacion && (
            <InfoFila icon={Star} label="Calificación">
              <StarDisplay value={proveedor.calificacion} />
            </InfoFila>
          )}

          {proveedor.frecuencia_visita_dias && (
            <InfoFila icon={Clock} label="Frecuencia de visita">
              Cada {proveedor.frecuencia_visita_dias} días
            </InfoFila>
          )}

          {proveedor.tiempo_traslado_horas != null && (
            <InfoFila icon={Truck} label="Tiempo de traslado">
              {proveedor.tiempo_traslado_horas} hora{proveedor.tiempo_traslado_horas !== 1 ? 's' : ''}
            </InfoFila>
          )}

          {proveedor.condiciones_pago && (
            <InfoFila icon={CreditCard} label="Condiciones de pago">
              {CONDICIONES_LABEL[proveedor.condiciones_pago] || proveedor.condiciones_pago}
            </InfoFila>
          )}

        </div>

        {proveedor.notas && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <InfoFila icon={FileText} label="Notas">
              <p className="whitespace-pre-wrap text-slate-700">{proveedor.notas}</p>
            </InfoFila>
          </div>
        )}

        {/* Si no hay ningún dato opcional */}
        {!proveedor.tipo_productos && !proveedor.calificacion &&
         !proveedor.frecuencia_visita_dias && !proveedor.condiciones_pago &&
         !proveedor.notas && (
          <p className="text-sm text-slate-400 text-center py-4">Sin información adicional registrada</p>
        )}
      </div>

      {/* ── Historial de compras ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Historial de compras</h2>
            <p className="text-xs text-slate-400 mt-0.5">Últimos 5 viajes con este proveedor</p>
          </div>
          <button
            onClick={() => navigate(`/viajes?proveedor=${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus size={14} />
            Nuevo viaje
          </button>
        </div>

        {viajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
            <Calendar size={34} strokeWidth={1.2} />
            <p className="text-sm">Sin viajes registrados con este proveedor</p>
            <button
              onClick={() => navigate(`/viajes?proveedor=${id}`)}
              className="text-sm text-blue-600 hover:underline"
            >
              Registrar primer viaje
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {viajes.map(viaje => {
              const total    = calcTotalViaje(viaje)
              const estado   = ESTADO_VIAJE[viaje.estado] || { label: viaje.estado, cls: 'bg-slate-100 text-slate-600' }
              const items    = viaje.items_viaje || []
              const gastos   =
                (viaje.gastos_gasolina  || 0) +
                (viaje.gastos_casetas   || 0) +
                (viaje.gastos_comida    || 0) +
                (viaje.gastos_hospedaje || 0) +
                (viaje.gastos_otros     || 0)

              return (
                <div key={viaje.id} className="p-5">

                  {/* Fecha + estado + total */}
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-800">
                          {fecha(viaje.fecha)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${estado.cls}`}>
                          {estado.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {items.length} producto{items.length !== 1 ? 's' : ''} comprado{items.length !== 1 ? 's' : ''}
                        {gastos > 0 && ` · ${moneda(gastos)} en gastos de viaje`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-slate-800">{moneda(total)}</p>
                      <p className="text-xs text-slate-400">total gastado</p>
                    </div>
                  </div>

                  {/* Lista de productos */}
                  {items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(item => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md"
                        >
                          <ShoppingCart size={11} className="text-slate-400" />
                          <span className="font-medium">{item.productos?.nombre}</span>
                          <span className="text-slate-400">
                            × {item.cantidad} {item.productos?.unidad_venta}
                          </span>
                          <span className="text-slate-400">({moneda(item.precio_unitario_compra)}/u)</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notas del viaje */}
                  {viaje.notas && (
                    <p className="mt-2 text-xs text-slate-500 italic">{viaje.notas}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Zona de acciones ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Acciones</h2>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {proveedor.activo ? 'Desactivar proveedor' : 'Activar proveedor'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {proveedor.activo
                ? 'No aparecerá al crear nuevos viajes de compra'
                : 'Volverá a estar disponible en los viajes de compra'}
            </p>
          </div>

          <button
            onClick={toggleActivo}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              proveedor.activo
                ? 'text-red-600 border-red-200 hover:bg-red-50'
                : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            {proveedor.activo ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            {toggling
              ? 'Actualizando…'
              : proveedor.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

    </div>
  )
}
