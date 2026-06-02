import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, AlertTriangle, Package, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { moneda, fechaLarga, totalGastosViaje, ESTADO_VIAJE } from '../lib/format'

/* ─── Página ─────────────────────────────────────────────────── */
export default function ViajeRecepcion() {
  const navigate = useNavigate()
  const { id }   = useParams()

  const [viaje,      setViaje]      = useState(null)
  const [items,      setItems]      = useState([])   // { ...item_viaje, _recibido, _caducidad }
  const [loading,    setLoading]    = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [paso,       setPaso]       = useState('revisar') // 'revisar' | 'exito'
  const [resumen,    setResumen]    = useState(null)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('viajes_compra')
      .select(`
        *,
        proveedores(nombre),
        items_viaje(
          id, cantidad, precio_unitario_compra,
          productos(nombre, categoria, unidad_venta, dias_caducidad_estimado)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      toast.error('No se pudo cargar el viaje')
      navigate(`/viajes/${id}`)
      return
    }

    /* Redirigir si ya está completado */
    if (data.estado === 'completado') {
      toast.error('Este viaje ya fue recibido')
      navigate(`/viajes/${id}`)
      return
    }

    setViaje(data)
    setItems(
      (data.items_viaje || []).map(item => ({
        ...item,
        _recibido: String(item.cantidad),  // empieza con la cantidad planeada
        _caducidad: '',
      }))
    )
    setLoading(false)
  }

  function actualizarItem(itemId, campo, valor) {
    setItems(prev =>
      prev.map(i => i.id === itemId ? { ...i, [campo]: valor } : i)
    )
  }

  /* ─── Diferencias entre planeado y recibido ─────────────────── */
  const diferencias = items.filter(i =>
    Math.abs(Number(i._recibido) - Number(i.cantidad)) > 0.001
  )
  const itemsConCaducidad = items.filter(i => i._caducidad)

  /* ─── Confirmar recepción ─────────────────────────────────────── */
  async function confirmar() {
    /* Validar que todos los recibidos sean ≥ 0 */
    const invalidos = items.filter(i => isNaN(Number(i._recibido)) || Number(i._recibido) < 0)
    if (invalidos.length > 0) {
      toast.error('Revisa las cantidades: deben ser 0 o mayor')
      return
    }

    setConfirmando(true)
    try {
      /* 1 — Actualizar cantidades en items_viaje (solo las que cambiaron) */
      const cambios = items.filter(i =>
        Math.abs(Number(i._recibido) - Number(i.cantidad)) > 0.001
      )
      for (const item of cambios) {
        const { error } = await supabase
          .from('items_viaje')
          .update({ cantidad: Number(item._recibido) })
          .eq('id', item.id)
        if (error) throw error
      }

      /* 2 — Construir nota de caducidades */
      const notasCaducidad = itemsConCaducidad.length > 0
        ? '\n\n--- Fechas de caducidad ---\n' +
          itemsConCaducidad
            .map(i => `${i.productos?.nombre}: ${i._caducidad}`)
            .join('\n')
        : ''

      const notasActualizadas = (viaje.notas || '') + notasCaducidad

      /* 3 — Cambiar estado a "completado" (dispara el trigger de inventario) */
      const { error: eViaje } = await supabase
        .from('viajes_compra')
        .update({
          estado: 'completado',
          notas: notasActualizadas.trim() || null,
        })
        .eq('id', id)

      if (eViaje) throw eViaje

      /* El trigger trg_viaje_completado se encarga de:
         - Calcular costo_traslado_asignado y costo_real_unitario por item
         - Actualizar inventario central con las cantidades recibidas
         - Registrar movimientos en movimientos_inventario
      */

      const totalRecibido = items.reduce(
        (a, i) => a + Number(i._recibido) * Number(i.precio_unitario_compra), 0
      )

      setResumen({
        totalProductos: items.filter(i => Number(i._recibido) > 0).length,
        totalRecibido,
        diferencias: cambios.length,
        caducidades: itemsConCaducidad.length,
      })
      setPaso('exito')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error al registrar la recepción')
    } finally {
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

  /* ════════════════════════════════════════════════════════════ */
  /* PANTALLA DE ÉXITO                                           */
  /* ════════════════════════════════════════════════════════════ */
  if (paso === 'exito' && resumen) {
    return (
      <div className="max-w-lg mx-auto pt-8 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-4">
            <CheckCircle size={40} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">¡Mercancía recibida!</h1>
          <p className="text-slate-500 text-sm">
            El inventario central ha sido actualizado automáticamente.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Resumen de la recepción</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Productos recibidos</span>
              <span className="font-bold text-slate-900">{resumen.totalProductos}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Valor de mercancía</span>
              <span className="font-bold text-slate-900">{moneda(resumen.totalRecibido)}</span>
            </div>
            {resumen.diferencias > 0 && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm">
                <AlertTriangle size={14} className="shrink-0" />
                {resumen.diferencias} producto{resumen.diferencias !== 1 ? 's' : ''} con cantidad ajustada vs. lo planeado
              </div>
            )}
            {resumen.caducidades > 0 && (
              <div className="flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-sm">
                <CheckCircle size={14} className="shrink-0" />
                Fechas de caducidad anotadas en las notas del viaje
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/inventario/distribucion')}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Distribuir mercancía a puntos de venta →
          </button>
          <button
            onClick={() => navigate(`/viajes/${id}`)}
            className="w-full py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
          >
            Ver detalle del viaje
          </button>
          <button
            onClick={() => navigate('/viajes')}
            className="w-full py-3 text-slate-500 text-sm hover:underline transition-colors"
          >
            Ir a todos los viajes
          </button>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════ */
  /* FORMULARIO DE RECEPCIÓN                                     */
  /* ════════════════════════════════════════════════════════════ */
  const gastos     = totalGastosViaje(viaje)
  const estadoConf = ESTADO_VIAJE[viaje.estado] || { label: viaje.estado, cls: '' }

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(`/viajes/${id}`)}
          className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Recibir Mercancía</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {viaje.proveedores?.nombre} · {fechaLarga(viaje.fecha)}
          </p>
        </div>
      </div>

      {/* ── Aviso ── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <Truck size={16} className="shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="font-semibold mb-0.5">Revisa y ajusta las cantidades recibidas</p>
          <p className="text-blue-700 text-xs">
            Si algún producto llegó con cantidad diferente a la planeada, corrígela aquí.
            Al confirmar, el inventario central se actualizará con los valores que captures.
          </p>
        </div>
      </div>

      {/* ── Tabla de recepción ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Package size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">
            Productos del viaje ({items.length})
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <Package size={32} strokeWidth={1.2} />
            <p className="text-sm">Este viaje no tiene productos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const planeado  = Number(item.cantidad)
              const recibido  = Number(item._recibido)
              const diferente = Math.abs(recibido - planeado) > 0.001
              const faltante  = recibido < planeado

              return (
                <div key={item.id} className={`p-5 ${diferente ? faltante ? 'bg-amber-50/40' : 'bg-blue-50/20' : ''}`}>
                  <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-800">{item.productos?.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.productos?.categoria && `${item.productos.categoria} · `}
                        {item.productos?.unidad_venta}
                      </p>
                    </div>
                    {diferente && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        faltante
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {faltante ? '▼ Faltante' : '▲ Excedente'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Cantidad planeada */}
                    <div>
                      <p className="text-xs text-slate-400 mb-1.5">Cantidad planeada</p>
                      <div className="px-3 py-2.5 bg-slate-100 rounded-lg text-sm font-semibold text-slate-600">
                        {item.cantidad} {item.productos?.unidad_venta}
                      </div>
                    </div>

                    {/* Cantidad recibida (editable) */}
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1.5">
                        Cantidad recibida <span className="text-red-500">*</span>
                      </p>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item._recibido}
                          onChange={e => actualizarItem(item.id, '_recibido', e.target.value)}
                          className={`w-full px-3 py-2.5 text-sm font-semibold border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                            diferente
                              ? faltante
                                ? 'border-amber-300 bg-amber-50 focus:ring-amber-500/20 text-amber-800'
                                : 'border-blue-300 bg-blue-50 focus:ring-blue-500/20 text-blue-800'
                              : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
                          }`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          {item.productos?.unidad_venta}
                        </span>
                      </div>
                      {diferente && (
                        <p className={`mt-1 text-xs ${faltante ? 'text-amber-600' : 'text-blue-600'}`}>
                          {faltante
                            ? `↓ ${(planeado - recibido).toFixed(2)} unidades menos de lo planeado`
                            : `↑ ${(recibido - planeado).toFixed(2)} unidades más de lo planeado`
                          }
                        </p>
                      )}
                    </div>

                    {/* Fecha de caducidad */}
                    <div>
                      <p className="text-xs text-slate-400 mb-1.5">
                        Fecha de caducidad
                        {item.productos?.dias_caducidad_estimado && (
                          <span className="ml-1 text-slate-300">
                            (est. {item.productos.dias_caducidad_estimado}d)
                          </span>
                        )}
                      </p>
                      <input
                        type="date"
                        value={item._caducidad}
                        onChange={e => actualizarItem(item.id, '_caducidad', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-500">
                    <span>Subtotal recibido:</span>
                    <span className="font-bold text-slate-800">
                      {moneda(recibido * Number(item.precio_unitario_compra))}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Resumen de diferencias ── */}
      {diferencias.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              {diferencias.length} producto{diferencias.length !== 1 ? 's' : ''} con ajuste de cantidad
            </p>
          </div>
          <ul className="space-y-1">
            {diferencias.map(i => {
              const diff = Number(i._recibido) - Number(i.cantidad)
              return (
                <li key={i.id} className="text-xs text-amber-700 flex justify-between">
                  <span>{i.productos?.nombre}</span>
                  <span>
                    {Number(i.cantidad)} → {Number(i._recibido)} {i.productos?.unidad_venta}
                    <span className={`ml-2 font-semibold ${diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      ({diff > 0 ? '+' : ''}{diff.toFixed(2)})
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── Gastos de traslado (recordatorio) ── */}
      {gastos > 0 && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
          <Truck size={16} className="text-slate-400 shrink-0" />
          <p className="text-slate-600">
            Los gastos de traslado ({moneda(gastos)}) se distribuirán automáticamente entre
            los productos al confirmar.
          </p>
        </div>
      )}

      {/* ── Botón confirmar ── */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(`/viajes/${id}`)}
            className="flex-1 py-3 border border-slate-200 bg-white text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={confirmando}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {confirmando
              ? <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <CheckCircle size={16} />
            }
            {confirmando ? 'Registrando recepción…' : 'Confirmar recepción'}
          </button>
        </div>
      )}
    </div>
  )
}
