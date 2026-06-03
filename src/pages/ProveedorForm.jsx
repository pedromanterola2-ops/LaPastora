import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

/* ─── Constantes ─────────────────────────────────────────────── */
const CONDICIONES_PAGO = [
  { value: 'contado',     label: 'Contado' },
  { value: 'credito_7',   label: 'Crédito 7 días' },
  { value: 'credito_15',  label: 'Crédito 15 días' },
  { value: 'credito_30',  label: 'Crédito 30 días' },
  { value: 'otro',        label: 'Otro' },
]

const FORM_VACIO = {
  nombre: '',
  ciudad: '',
  tipo_productos: '',
  frecuencia_visita_dias: '',
  condiciones_pago: '',
  tiempo_traslado_horas: '',
  calificacion: null,
  notas: '',
  activo: true,
}

/* ─── Selector de estrellas clickable ────────────────────────── */
function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`${n} estrella${n !== 1 ? 's' : ''}`}
        >
          <Star
            size={26}
            className={n <= (hover || value || 0)
              ? 'fill-amber-400 text-amber-400 transition-colors'
              : 'fill-slate-200 text-slate-200 transition-colors'}
          />
        </button>
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline"
        >
          limpiar
        </button>
      )}
    </div>
  )
}

/* ─── Campo de texto con label y error ───────────────────────── */
function Campo({ label, requerido, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {requerido && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

/* ─── Clases del input según si hay error ────────────────────── */
function inputCls(error) {
  return `w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
    error
      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
  }`
}

/* ─── Formulario principal ───────────────────────────────────── */
export default function ProveedorForm() {
  const navigate  = useNavigate()
  const { id }    = useParams()
  const esEdicion = Boolean(id)

  const [form,    setForm]    = useState(FORM_VACIO)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(esEdicion)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (esEdicion) cargarProveedor()
  }, [id])

  async function cargarProveedor() {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      toast.error('No se pudo cargar el proveedor')
      navigate('/proveedores')
      return
    }

    setForm({
      nombre:                data.nombre || '',
      ciudad:                data.ciudad || '',
      tipo_productos:        data.tipo_productos || '',
      frecuencia_visita_dias: data.frecuencia_visita_dias ?? '',
      condiciones_pago:      data.condiciones_pago || '',
      tiempo_traslado_horas: data.tiempo_traslado_horas ?? '',
      calificacion:          data.calificacion ?? null,
      notas:                 data.notas || '',
      activo:                data.activo ?? true,
    })
    setLoading(false)
  }

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (errores[campo]) setErrores(e => ({ ...e, [campo]: null }))
  }

  function validar() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido'

    const freq = Number(form.frecuencia_visita_dias)
    if (form.frecuencia_visita_dias !== '' && (isNaN(freq) || freq <= 0)) {
      e.frecuencia_visita_dias = 'Debe ser un número mayor a 0'
    }

    const traslado = Number(form.tiempo_traslado_horas)
    if (form.tiempo_traslado_horas !== '' && (isNaN(traslado) || traslado < 0)) {
      e.tiempo_traslado_horas = 'Debe ser 0 o mayor'
    }

    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errs = validar()
    if (Object.keys(errs).length > 0) {
      setErrores(errs)
      // Scroll al primer error
      document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSaving(true)

    const payload = {
      nombre:                form.nombre.trim(),
      ciudad:                form.ciudad.trim()        || null,
      tipo_productos:        form.tipo_productos.trim() || null,
      frecuencia_visita_dias: form.frecuencia_visita_dias !== ''
        ? Number(form.frecuencia_visita_dias) : null,
      condiciones_pago:      form.condiciones_pago     || null,
      tiempo_traslado_horas: form.tiempo_traslado_horas !== ''
        ? Number(form.tiempo_traslado_horas) : null,
      calificacion:          form.calificacion,
      notas:                 form.notas.trim()         || null,
      activo:                form.activo,
    }

    try {
      if (esEdicion) {
        const { error } = await supabase
          .from('proveedores')
          .update(payload)
          .eq('id', id)
        if (error) throw error
        toast.success('Proveedor actualizado correctamente')
        navigate(`/proveedores/${id}`)
      } else {
        const { data, error } = await supabase
          .from('proveedores')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        toast.success('Proveedor creado correctamente')
        navigate(`/proveedores/${data.id}`)
      }
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error al guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  function handleCancelar() {
    navigate(esEdicion ? `/proveedores/${id}` : '/proveedores')
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancelar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {esEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {esEdicion ? 'Modifica la información del proveedor' : 'Registra un nuevo proveedor'}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">

        {/* Nombre */}
        <Campo label="Nombre" requerido error={errores.nombre}>
          <div data-error={errores.nombre || undefined}>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej. Quesería El Rancho"
              className={inputCls(errores.nombre)}
            />
          </div>
        </Campo>

        {/* Ciudad */}
        <Campo label="Ciudad">
          <input
            type="text"
            value={form.ciudad}
            onChange={e => set('ciudad', e.target.value)}
            placeholder="Ej. Guadalajara, Jalisco"
            className={inputCls()}
          />
        </Campo>

        {/* Tipo de productos */}
        <Campo label="Tipo de productos">
          <input
            type="text"
            value={form.tipo_productos}
            onChange={e => set('tipo_productos', e.target.value)}
            placeholder="Ej. Quesos, lácteos, embutidos"
            className={inputCls()}
          />
        </Campo>

        {/* Frecuencia + Traslado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Frecuencia de visita (días)" error={errores.frecuencia_visita_dias}>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={form.frecuencia_visita_dias}
              onChange={e => set('frecuencia_visita_dias', e.target.value)}
              placeholder="Ej. 30"
              className={inputCls(errores.frecuencia_visita_dias)}
            />
          </Campo>

          <Campo label="Tiempo de traslado (horas)" error={errores.tiempo_traslado_horas}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={form.tiempo_traslado_horas}
              onChange={e => set('tiempo_traslado_horas', e.target.value)}
              placeholder="Ej. 2.5"
              className={inputCls(errores.tiempo_traslado_horas)}
            />
          </Campo>
        </div>

        {/* Condiciones de pago */}
        <Campo label="Condiciones de pago">
          <select
            value={form.condiciones_pago}
            onChange={e => set('condiciones_pago', e.target.value)}
            className={`${inputCls()} bg-white`}
          >
            <option value="">Sin especificar</option>
            {CONDICIONES_PAGO.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Campo>

        {/* Calificación */}
        <Campo label="Calificación">
          <StarPicker value={form.calificacion} onChange={v => set('calificacion', v)} />
          <p className="mt-1 text-xs text-slate-400">
            {form.calificacion ? `${form.calificacion} de 5 estrellas` : 'Sin calificación'}
          </p>
        </Campo>

        {/* Notas */}
        <Campo label="Notas">
          <textarea
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            rows={3}
            placeholder="Información adicional, contacto, horarios de atención…"
            className={`${inputCls()} resize-none`}
          />
        </Campo>

        {/* Toggle activo */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">Proveedor activo</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Los inactivos no aparecen en nuevos viajes de compra
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.activo}
            onClick={() => set('activo', !form.activo)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              form.activo ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                form.activo ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Botones */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Save size={15} />
            }
            {saving ? 'Guardando…' : 'Guardar'}
          </button>

          <button
            type="button"
            onClick={handleCancelar}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>

      </form>
    </div>
  )
}
