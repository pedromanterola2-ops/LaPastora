import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChevronLeft, Package } from 'lucide-react'
import { moneda } from '../lib/format'
import { getProducto, createProducto, updateProducto, getCategorias } from '../lib/productos'

// ─── Constantes ───────────────────────────────────────────────
const UNIDADES = [
  'pieza', 'kg', 'gramo', 'litro', 'mililitro',
  'caja', 'paquete', 'bolsa', 'docena', 'rollo',
]

const EMPTY = {
  nombre:                  '',
  categoria:               '',
  unidad_venta:            'pieza',
  precio_venta:            '',
  existencia_minima:       '0',
  dias_caducidad_estimado: '',
  activo:                  true,
}

function Campo({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function Input({ className = '', ...props }) {
  // Teclado numérico en móvil para campos numéricos
  const inputMode = props.inputMode ?? (props.type === 'number' ? 'decimal' : undefined)
  return (
    <input
      inputMode={inputMode}
      className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                  transition-all placeholder-slate-400 ${className}`}
      {...props}
    />
  )
}

// ─── Formulario ───────────────────────────────────────────────
export default function ProductoForm() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(id)

  const [form,       setForm]       = useState(EMPTY)
  const [categorias, setCategorias] = useState([])
  const [loading,    setLoading]    = useState(esEdicion)
  const [guardando,  setGuardando]  = useState(false)
  const [stock,      setStock]      = useState(null)   // solo edición

  useEffect(() => {
    getCategorias().then(setCategorias)
    if (esEdicion) {
      setLoading(true)
      getProducto(id)
        .then(p => {
          setForm({
            nombre:                  p.nombre,
            categoria:               p.categoria ?? '',
            unidad_venta:            p.unidad_venta,
            precio_venta:            String(p.precio_venta),
            existencia_minima:       String(p.existencia_minima),
            dias_caducidad_estimado: p.dias_caducidad_estimado ? String(p.dias_caducidad_estimado) : '',
            activo:                  p.activo,
          })
          setStock(p.stock)
        })
        .catch(() => { toast.error('No se encontró el producto'); navigate('/productos') })
        .finally(() => setLoading(false))
    }
  }, [id]) // eslint-disable-line

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    const precio = parseFloat(form.precio_venta)
    if (isNaN(precio) || precio < 0) { toast.error('Precio inválido'); return }

    const payload = {
      nombre:                  form.nombre.trim(),
      categoria:               form.categoria.trim() || null,
      unidad_venta:            form.unidad_venta,
      precio_venta:            precio,
      existencia_minima:       Math.max(0, parseFloat(form.existencia_minima) || 0),
      dias_caducidad_estimado: form.dias_caducidad_estimado
                                 ? parseInt(form.dias_caducidad_estimado, 10)
                                 : null,
      activo: form.activo,
    }

    setGuardando(true)
    try {
      if (esEdicion) {
        await updateProducto(id, payload)
        toast.success('Producto actualizado')
      } else {
        await createProducto(payload)
        toast.success('Producto creado')
      }
      navigate('/productos')
    } catch (err) {
      toast.error(err?.message || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/productos')}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {esEdicion ? 'Editar producto' : 'Nuevo producto'}
          </h1>
          {esEdicion && (
            <p className="text-sm text-slate-500 mt-0.5">{form.nombre}</p>
          )}
        </div>
      </div>

      {/* ── Stock actual (solo edición) ── */}
      {esEdicion && stock && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Stock actual
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[['Central', 'central'], ['Punto A', 'punto_a'], ['Punto B', 'punto_b']].map(([lbl, key]) => (
              <div key={key} className="text-center">
                <p className="text-xs text-slate-400 mb-1">{lbl}</p>
                <p className="text-lg font-bold text-slate-800">{stock[key] ?? 0}</p>
                <p className="text-xs text-slate-400">{form.unidad_venta}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Formulario ── */}
      <form onSubmit={guardar} className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">

        {/* Nombre */}
        <div className="p-5">
          <Campo label="Nombre" required>
            <Input
              autoFocus={!esEdicion}
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="ej. Queso Oaxaca 500g"
              maxLength={120}
            />
          </Campo>
        </div>

        {/* Categoría */}
        <div className="p-5">
          <Campo label="Categoría" hint="Agrupa los productos en la lista y en reportes">
            <input
              list="categorias-list"
              value={form.categoria}
              onChange={e => set('categoria', e.target.value)}
              placeholder="ej. Lácteos, Botanas, Bebidas…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                         transition-all placeholder-slate-400"
              maxLength={60}
            />
            <datalist id="categorias-list">
              {categorias.map(c => <option key={c} value={c} />)}
            </datalist>
          </Campo>
        </div>

        {/* Unidad + Precio */}
        <div className="p-5 grid grid-cols-2 gap-4">
          <Campo label="Unidad de venta">
            <select
              value={form.unidad_venta}
              onChange={e => set('unidad_venta', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Campo>

          <Campo label="Precio de venta" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <Input
                type="number"
                value={form.precio_venta}
                onChange={e => set('precio_venta', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="pl-7"
              />
            </div>
            {form.precio_venta && !isNaN(parseFloat(form.precio_venta)) && (
              <p className="text-xs text-slate-500 mt-1">{moneda(parseFloat(form.precio_venta))}</p>
            )}
          </Campo>
        </div>

        {/* Existencia mínima + Caducidad */}
        <div className="p-5 grid grid-cols-2 gap-4">
          <Campo
            label="Existencia mínima"
            hint="Activa la alerta de stock bajo"
          >
            <Input
              type="number"
              value={form.existencia_minima}
              onChange={e => set('existencia_minima', e.target.value)}
              placeholder="0"
              min="0"
              step="1"
            />
          </Campo>

          <Campo
            label="Días de caducidad"
            hint="Estimado desde la fecha de compra"
          >
            <Input
              type="number"
              value={form.dias_caducidad_estimado}
              onChange={e => set('dias_caducidad_estimado', e.target.value)}
              placeholder="ej. 30"
              min="1"
              step="1"
            />
          </Campo>
        </div>

        {/* Activo */}
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Producto activo</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Los productos inactivos no aparecen en el punto de venta
            </p>
          </div>
          <button
            type="button"
            onClick={() => set('activo', !form.activo)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.activo ? 'bg-emerald-500' : 'bg-slate-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              form.activo ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Botones */}
        <div className="p-5 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700
                       hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400
                       text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {guardando
              ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando…</>
              : <><Package size={15} /> {esEdicion ? 'Guardar cambios' : 'Crear producto'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
