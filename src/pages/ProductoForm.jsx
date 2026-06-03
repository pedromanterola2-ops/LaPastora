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
  sku:               '',
  nombre:            '',
  categoria:         '',
  contenido:         '1',
  unidad_venta:      'pieza',
  costo:             '',
  precio_venta:      '',
  fecha_caducidad:   '',
  cantidad_inicial:  '',
  existencia_minima: '0',
  activo:            true,
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
            sku:               p.sku ?? '',
            nombre:            p.nombre,
            categoria:         p.categoria ?? '',
            contenido:         p.contenido != null ? String(p.contenido) : '1',
            unidad_venta:      p.unidad_venta,
            costo:             p.costo != null ? String(p.costo) : '',
            precio_venta:      String(p.precio_venta),
            fecha_caducidad:   p.fecha_caducidad ?? '',
            cantidad_inicial:  '',
            existencia_minima: String(p.existencia_minima),
            activo:            p.activo,
          })
          setStock(p.stock)
        })
        .catch(() => { toast.error('No se encontró el producto'); navigate('/productos') })
        .finally(() => setLoading(false))
    }
  }, [id]) // eslint-disable-line

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Margen estimado (precio - costo)
  const costoNum   = parseFloat(form.costo)
  const precioNum  = parseFloat(form.precio_venta)
  const margen = (!isNaN(costoNum) && !isNaN(precioNum) && precioNum > 0)
    ? precioNum - costoNum
    : null
  const margenPct = (margen != null && precioNum > 0) ? (margen / precioNum) * 100 : null

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    const precio = parseFloat(form.precio_venta)
    if (isNaN(precio) || precio < 0) { toast.error('Precio inválido'); return }
    const costo = form.costo === '' ? 0 : parseFloat(form.costo)
    if (isNaN(costo) || costo < 0) { toast.error('Costo inválido'); return }

    const payload = {
      sku:               form.sku.trim() || null,
      nombre:            form.nombre.trim(),
      categoria:         form.categoria.trim() || null,
      contenido:         Math.max(0.0001, parseFloat(form.contenido) || 1),
      unidad_venta:      form.unidad_venta,
      costo,
      precio_venta:      precio,
      fecha_caducidad:   form.fecha_caducidad || null,
      existencia_minima: Math.max(0, parseFloat(form.existencia_minima) || 0),
      activo:            form.activo,
    }

    setGuardando(true)
    try {
      if (esEdicion) {
        await updateProducto(id, payload)
        toast.success('Producto actualizado')
      } else {
        const cantidad_inicial = Math.max(0, parseFloat(form.cantidad_inicial) || 0)
        await createProducto({ ...payload, cantidad_inicial })
        toast.success(
          cantidad_inicial > 0
            ? `Producto creado · ${cantidad_inicial} en Central`
            : 'Producto creado'
        )
      }
      navigate('/productos')
    } catch (err) {
      const msg = /idx_productos_sku_unico|duplicate key/i.test(err?.message || '')
        ? 'Ya existe un producto con ese SKU'
        : (err?.message || 'Error al guardar')
      toast.error(msg)
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
          aria-label="Volver a productos"
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

        {/* SKU + Nombre */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo label="Código SKU" hint="Único">
            <Input
              value={form.sku}
              onChange={e => set('sku', e.target.value)}
              placeholder="ej. QOX-01"
              maxLength={40}
            />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Nombre" required>
              <Input
                autoFocus={!esEdicion}
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="ej. Queso Oaxaca"
                maxLength={120}
              />
            </Campo>
          </div>
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

        {/* Contenido + Unidad */}
        <div className="p-5 grid grid-cols-2 gap-4">
          <Campo label="Cantidad" hint="Contenido por presentación">
            <Input
              type="number"
              value={form.contenido}
              onChange={e => set('contenido', e.target.value)}
              placeholder="1"
              min="0"
              step="any"
            />
          </Campo>
          <Campo label="Unidad">
            <select
              value={form.unidad_venta}
              onChange={e => set('unidad_venta', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {form.contenido && (
              <p className="text-xs text-slate-500 mt-1">
                Presentación: <span className="font-medium">{form.contenido} {form.unidad_venta}</span>
              </p>
            )}
          </Campo>
        </div>

        {/* Costo + Precio */}
        <div className="p-5 grid grid-cols-2 gap-4">
          <Campo label="Costo de compra" hint="Lo que te cuesta a ti">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <Input
                type="number"
                value={form.costo}
                onChange={e => set('costo', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="pl-7"
              />
            </div>
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
          </Campo>
        </div>

        {/* Margen estimado */}
        {margen != null && (
          <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">Margen estimado</span>
            <span className={`font-semibold ${margen < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {moneda(margen)}{margenPct != null && ` · ${margenPct.toFixed(0)}%`}
            </span>
          </div>
        )}

        {/* Caducidad + Existencia mínima */}
        <div className="p-5 grid grid-cols-2 gap-4">
          <Campo label="Fecha de caducidad" hint="Opcional">
            <Input
              type="date"
              value={form.fecha_caducidad}
              onChange={e => set('fecha_caducidad', e.target.value)}
            />
          </Campo>

          <Campo label="Existencia mínima" hint="Activa la alerta de stock bajo">
            <Input
              type="number"
              value={form.existencia_minima}
              onChange={e => set('existencia_minima', e.target.value)}
              placeholder="0"
              min="0"
              step="1"
            />
          </Campo>
        </div>

        {/* Cantidad inicial (solo al crear) */}
        {!esEdicion && (
          <div className="p-5">
            <Campo
              label="Cantidad inicial"
              hint="Existencias que ya tienes. Entra como stock en la bodega Central."
            >
              <Input
                type="number"
                value={form.cantidad_inicial}
                onChange={e => set('cantidad_inicial', e.target.value)}
                placeholder="0"
                min="0"
                step="any"
              />
            </Campo>
          </div>
        )}

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
            aria-label={form.activo ? 'Desactivar producto' : 'Activar producto'}
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
