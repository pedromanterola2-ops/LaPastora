import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Plus,
  Trash2, Search, Truck, Package,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { moneda, GASTOS_KEYS, GASTOS_LABELS } from '../lib/format'

/* ─── Constantes ─────────────────────────────────────────────── */
const HOY   = new Date().toISOString().split('T')[0]
const PASOS = ['Información', 'Gastos', 'Productos', 'Resumen']

const FORM_VACIO = {
  proveedor_id: '',
  fecha: HOY,
  notas: '',
  gastos_gasolina:  '',
  gastos_casetas:   '',
  gastos_comida:    '',
  gastos_hospedaje: '',
  gastos_otros:     '',
  items: [],
}

/* ─── Indicador de pasos ─────────────────────────────────────── */
function Pasos({ actual }) {
  return (
    <div className="flex items-center justify-center">
      {PASOS.map((label, idx) => {
        const n      = idx + 1
        const activo = n === actual
        const listo  = n < actual
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                listo  ? 'bg-emerald-500 text-white' :
                activo ? 'bg-blue-600 text-white'    :
                         'bg-slate-200 text-slate-500'
              }`}>
                {listo ? <Check size={14} /> : n}
              </div>
              <span className={`text-xs hidden sm:block whitespace-nowrap ${
                activo ? 'text-blue-600 font-semibold' : 'text-slate-400'
              }`}>{label}</span>
            </div>
            {idx < PASOS.length - 1 && (
              <div className={`h-0.5 w-10 sm:w-16 mx-1 sm:mb-4 transition-colors ${
                listo ? 'bg-emerald-300' : 'bg-slate-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Input numérico con prefijo $ ───────────────────────────── */
function InputPeso({ value, onChange, placeholder = '0.00' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      />
    </div>
  )
}

/* ─── Cálculos derivados ─────────────────────────────────────── */
function calcTotales(datos) {
  const totalGastos = GASTOS_KEYS.reduce((a, k) => a + (Number(datos[k]) || 0), 0)
  const totalMerch  = datos.items.reduce(
    (a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0
  )
  return { totalGastos, totalMerch, totalViaje: totalGastos + totalMerch }
}

function calcItem(item, totalMerch, totalGastos) {
  const qty = Number(item.cantidad)    || 0
  const ppu = Number(item.precio_unitario) || 0
  const sub = qty * ppu
  const traslado = totalMerch > 0 ? (sub / totalMerch) * totalGastos : 0
  const costoReal = ppu + (qty > 0 ? traslado / qty : 0)
  return { qty, ppu, sub, traslado, costoReal }
}

/* ─── Página principal ───────────────────────────────────────── */
export default function ViajeNuevo() {
  const navigate = useNavigate()
  const [paso, setPaso]           = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [catalogo, setCatalogo]   = useState([])
  const [errores, setErrores]     = useState({})
  const [datos, setDatos]         = useState(FORM_VACIO)

  /* Buscador de productos */
  const [pQuery, setPQuery] = useState('')
  const [pOpen, setPOpen]   = useState(false)
  const pRef = useRef(null)

  /* ── Carga inicial ── */
  useEffect(() => {
    Promise.all([
      supabase.from('proveedores').select('id, nombre, ciudad').eq('activo', true).order('nombre'),
      supabase.from('productos').select('id, nombre, categoria, unidad_venta').eq('activo', true).order('nombre'),
    ]).then(([{ data: p }, { data: pr }]) => {
      setProveedores(p || [])
      setCatalogo(pr || [])
    })
  }, [])

  /* Click fuera del buscador → cerrar */
  useEffect(() => {
    function handler(e) {
      if (pRef.current && !pRef.current.contains(e.target)) setPOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ─── Helpers ────────────────────────────────────────────────── */
  function set(k, v) {
    setDatos(d => ({ ...d, [k]: v }))
    if (errores[k]) setErrores(e => ({ ...e, [k]: null }))
  }

  function setItem(key, campo, valor) {
    setDatos(d => ({
      ...d,
      items: d.items.map(i => i._k === key ? { ...i, [campo]: valor } : i),
    }))
  }

  function agregarProducto(prod) {
    if (datos.items.find(i => i.producto_id === prod.id)) {
      toast.error('Este producto ya está en la lista')
      return
    }
    setDatos(d => ({
      ...d,
      items: [...d.items, {
        _k:           Date.now() + Math.random(),
        producto_id:  prod.id,
        nombre:       prod.nombre,
        categoria:    prod.categoria,
        unidad_venta: prod.unidad_venta,
        cantidad:     '',
        precio_unitario: '',
      }],
    }))
    setPQuery('')
    setPOpen(false)
    if (errores.items) setErrores(e => ({ ...e, items: null }))
  }

  function quitarProducto(key) {
    setDatos(d => ({ ...d, items: d.items.filter(i => i._k !== key) }))
  }

  /* ─── Validación ─────────────────────────────────────────────── */
  function validar() {
    const e = {}
    if (paso === 1) {
      if (!datos.proveedor_id) e.proveedor_id = 'Selecciona un proveedor'
      if (!datos.fecha)        e.fecha        = 'La fecha es requerida'
    }
    if (paso === 3) {
      if (datos.items.length === 0) {
        e.items = 'Agrega al menos un producto'
      } else if (datos.items.some(i => !Number(i.cantidad) || Number(i.cantidad) <= 0)) {
        e.items = 'Todos los productos deben tener cantidad mayor a 0'
      } else if (datos.items.some(i => Number(i.precio_unitario) < 0 || i.precio_unitario === '')) {
        e.items = 'Todos los productos deben tener precio de compra (puede ser 0)'
      }
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function siguiente() { if (validar()) setPaso(p => p + 1) }
  function anterior()  { setPaso(p => p - 1) }

  /* ─── Guardar ─────────────────────────────────────────────────── */
  async function guardar(estadoFinal) {
    setGuardando(true)
    try {
      /* 1 — Crear el viaje */
      const { data: viaje, error: eViaje } = await supabase
        .from('viajes_compra')
        .insert({
          proveedor_id:     datos.proveedor_id,
          fecha:            datos.fecha,
          estado:           estadoFinal,
          notas:            datos.notas.trim() || null,
          gastos_gasolina:  Number(datos.gastos_gasolina)  || 0,
          gastos_casetas:   Number(datos.gastos_casetas)   || 0,
          gastos_comida:    Number(datos.gastos_comida)    || 0,
          gastos_hospedaje: Number(datos.gastos_hospedaje) || 0,
          gastos_otros:     Number(datos.gastos_otros)     || 0,
        })
        .select()
        .single()

      if (eViaje) throw eViaje

      /* 2 — Insertar productos */
      if (datos.items.length > 0) {
        const { error: eItems } = await supabase.from('items_viaje').insert(
          datos.items.map(i => ({
            viaje_id:             viaje.id,
            producto_id:          i.producto_id,
            cantidad:             Number(i.cantidad),
            precio_unitario_compra: Number(i.precio_unitario) || 0,
          }))
        )
        if (eItems) throw eItems
      }

      /*
        Si estadoFinal = 'completado', el trigger trg_viaje_completado
        ya habrá calculado costos y actualizado el inventario central.
      */
      if (estadoFinal === 'completado') {
        toast.success('¡Viaje completado! Mercancía registrada en inventario central')
        navigate(`/viajes/${viaje.id}`)
      } else {
        toast.success('Viaje guardado. Revisa la planificación de compra.')
        navigate(`/viajes/${viaje.id}/planificacion`)
      }
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error al guardar el viaje')
    } finally {
      setGuardando(false)
    }
  }

  /* ─── Derivados para el render ───────────────────────────────── */
  const { totalGastos, totalMerch, totalViaje } = calcTotales(datos)

  const prodFiltrados = catalogo
    .filter(p =>
      p.nombre.toLowerCase().includes(pQuery.toLowerCase()) &&
      !datos.items.find(i => i.producto_id === p.id)
    )
    .slice(0, 8)

  const proveedorNombre = proveedores.find(p => p.id === datos.proveedor_id)?.nombre || '—'

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/viajes')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Nuevo Viaje de Compra</h1>
          <p className="text-sm text-slate-500 mt-0.5">Paso {paso} de {PASOS.length} — {PASOS[paso - 1]}</p>
        </div>
      </div>

      {/* ── Indicador ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-4">
        <Pasos actual={paso} />
      </div>

      {/* ══ Contenido del paso ══════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">

        {/* ── PASO 1: Información básica ── */}
        {paso === 1 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-slate-700">Información del viaje</h2>

            {/* Proveedor */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Proveedor <span className="text-red-500">*</span>
              </label>
              <select
                value={datos.proveedor_id}
                onChange={e => set('proveedor_id', e.target.value)}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 ${
                  errores.proveedor_id
                    ? 'border-red-300 focus:ring-red-500/20'
                    : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
                }`}
              >
                <option value="">Selecciona un proveedor…</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{p.ciudad ? ` — ${p.ciudad}` : ''}
                  </option>
                ))}
              </select>
              {errores.proveedor_id && (
                <p className="mt-1 text-xs text-red-500">{errores.proveedor_id}</p>
              )}
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Fecha del viaje <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={datos.fecha}
                onChange={e => set('fecha', e.target.value)}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                  errores.fecha
                    ? 'border-red-300 focus:ring-red-500/20'
                    : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
                }`}
              />
              {errores.fecha && <p className="mt-1 text-xs text-red-500">{errores.fecha}</p>}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas (opcional)</label>
              <textarea
                value={datos.notas}
                onChange={e => set('notas', e.target.value)}
                rows={3}
                placeholder="Observaciones del viaje, contexto adicional…"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
              />
            </div>
          </div>
        )}

        {/* ── PASO 2: Gastos de traslado ── */}
        {paso === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-700">Gastos de traslado</h2>
              {totalGastos > 0 && (
                <span className="text-sm font-bold text-blue-700">{moneda(totalGastos)}</span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Todos los campos son opcionales. Los gastos se prorratearán entre los productos.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GASTOS_KEYS.map(k => (
                <div key={k}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {GASTOS_LABELS[k]}
                  </label>
                  <InputPeso
                    value={datos[k]}
                    onChange={e => set(k, e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Resumen visual de gastos */}
            <div className={`rounded-xl p-4 border transition-colors ${
              totalGastos > 0
                ? 'bg-blue-50 border-blue-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck size={18} className={totalGastos > 0 ? 'text-blue-600' : 'text-slate-400'} />
                  <div>
                    <p className={`text-sm font-semibold ${totalGastos > 0 ? 'text-blue-900' : 'text-slate-600'}`}>
                      Total gastos de traslado
                    </p>
                    <p className={`text-xs mt-0.5 ${totalGastos > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                      {totalGastos > 0
                        ? 'Se distribuirá entre los productos según su valor'
                        : 'Sin gastos de traslado registrados'}
                    </p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${totalGastos > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                  {moneda(totalGastos)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 3: Productos ── */}
        {paso === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-slate-700">Productos comprados</h2>
              {totalMerch > 0 && (
                <span className="text-sm">
                  <span className="text-slate-500">Total mercancía: </span>
                  <span className="font-bold text-slate-900">{moneda(totalMerch)}</span>
                </span>
              )}
            </div>

            {errores.items && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">
                {errores.items}
              </div>
            )}

            {/* ── Tabla de items ── */}
            {datos.items.length > 0 && (
              <div className="overflow-x-auto -mx-5 sm:mx-0">
                <div className="min-w-[620px] px-5 sm:px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-left">
                        <th className="pb-2 pr-3 text-xs font-semibold text-slate-500">Producto</th>
                        <th className="pb-2 pr-3 w-24 text-xs font-semibold text-slate-500">Cantidad</th>
                        <th className="pb-2 pr-3 w-28 text-xs font-semibold text-slate-500">Precio/u</th>
                        <th className="pb-2 pr-3 w-24 text-xs font-semibold text-slate-500 text-right">Subtotal</th>
                        <th className="pb-2 pr-3 w-28 text-xs font-semibold text-slate-500 text-right">
                          <span className="text-amber-600">Traslado/u</span>
                        </th>
                        <th className="pb-2 pr-3 w-24 text-xs font-semibold text-slate-500 text-right">
                          <span className="text-blue-600">Costo real/u</span>
                        </th>
                        <th className="pb-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {datos.items.map(item => {
                        const c = calcItem(item, totalMerch, totalGastos)
                        return (
                          <tr key={item._k} className="group/row">
                            <td className="py-3 pr-3">
                              <p className="font-medium text-slate-800 leading-tight">{item.nombre}</p>
                              <p className="text-xs text-slate-400">{item.unidad_venta}</p>
                            </td>
                            <td className="py-3 pr-3">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.001"
                                value={item.cantidad}
                                onChange={e => setItem(item._k, 'cantidad', e.target.value)}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                              />
                            </td>
                            <td className="py-3 pr-3">
                              <InputPeso
                                value={item.precio_unitario}
                                onChange={e => setItem(item._k, 'precio_unitario', e.target.value)}
                              />
                            </td>
                            <td className="py-3 pr-3 text-right font-medium text-slate-700">
                              {c.qty > 0 && c.ppu >= 0 ? moneda(c.sub) : '—'}
                            </td>
                            <td className="py-3 pr-3 text-right text-amber-700 font-medium">
                              {c.qty > 0 && totalGastos > 0
                                ? moneda(c.traslado / c.qty)
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                            <td className="py-3 pr-3 text-right font-bold text-blue-700">
                              {c.qty > 0 && c.ppu >= 0
                                ? moneda(c.costoReal)
                                : <span className="text-slate-300 font-normal">—</span>
                              }
                            </td>
                            <td className="py-3">
                              <button
                                onClick={() => quitarProducto(item._k)}
                                className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover/row:opacity-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {datos.items.length > 1 && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-300">
                          <td colSpan={3} className="pt-2 text-xs text-slate-400">
                            {datos.items.length} productos
                          </td>
                          <td className="pt-2 pr-3 text-right font-bold text-slate-900">{moneda(totalMerch)}</td>
                          <td className="pt-2 pr-3 text-right font-bold text-amber-700">{moneda(totalGastos)}</td>
                          <td className="pt-2 pr-3 text-right font-bold text-blue-700">{moneda(totalViaje)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ── Buscador de productos ── */}
            <div ref={pRef} className="relative">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-colors cursor-text ${
                pOpen ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
              }`}
                onClick={() => { setPOpen(true); pRef.current?.querySelector('input')?.focus() }}
              >
                <Search size={16} className={pOpen ? 'text-blue-500' : 'text-slate-400'} />
                <input
                  type="text"
                  value={pQuery}
                  onChange={e => { setPQuery(e.target.value); setPOpen(true) }}
                  onFocus={() => setPOpen(true)}
                  placeholder={datos.items.length === 0 ? 'Buscar producto para agregar al viaje…' : 'Agregar otro producto…'}
                  className="flex-1 text-sm bg-transparent focus:outline-none placeholder-slate-400"
                />
                <Plus size={15} className="text-slate-400 shrink-0" />
              </div>

              {/* Dropdown de resultados */}
              {pOpen && (pQuery || prodFiltrados.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                  {prodFiltrados.length > 0
                    ? prodFiltrados.map(p => (
                        <button
                          key={p.id}
                          onMouseDown={() => agregarProducto(p)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                        >
                          <span>
                            <span className="font-medium text-slate-800">{p.nombre}</span>
                            {p.categoria && (
                              <span className="text-slate-400 text-xs ml-2">({p.categoria})</span>
                            )}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">{p.unidad_venta}</span>
                        </button>
                      ))
                    : (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        {pQuery ? `Sin resultados para "${pQuery}"` : 'Escribe para buscar productos…'}
                      </div>
                    )
                  }
                </div>
              )}
            </div>

            {/* Nota sobre la fórmula */}
            {totalGastos > 0 && totalMerch > 0 && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <Package size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Prorrateo de traslado:</strong>{' '}
                  El costo de traslado de cada producto se calcula como{' '}
                  (subtotal producto ÷ total mercancía) × total gastos.{' '}
                  El <strong>costo real/u</strong> = precio de compra + traslado asignado por unidad.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── PASO 4: Resumen ── */}
        {paso === 4 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-slate-700">Resumen del viaje</h2>

            {/* Info básica */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Proveedor</p>
                <p className="font-semibold text-slate-800">{proveedorNombre}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Fecha</p>
                <p className="font-semibold text-slate-800">{datos.fecha}</p>
              </div>
              {datos.notas && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Notas</p>
                  <p className="text-slate-700">{datos.notas}</p>
                </div>
              )}
            </div>

            {/* Gastos */}
            {totalGastos > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Gastos de traslado</p>
                <div className="space-y-1.5 bg-slate-50 rounded-xl p-4">
                  {GASTOS_KEYS.filter(k => Number(datos[k]) > 0).map(k => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-500">{GASTOS_LABELS[k]}</span>
                      <span className="font-medium text-slate-800">{moneda(Number(datos[k]))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-1">
                    <span className="font-semibold text-slate-700">Subtotal gastos</span>
                    <span className="font-bold text-slate-900">{moneda(totalGastos)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de productos */}
            {datos.items.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Productos comprados</p>
                <div className="overflow-x-auto -mx-5 sm:mx-0">
                  <div className="min-w-[480px] px-5 sm:px-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-left">
                          <th className="pb-2 text-xs font-semibold text-slate-500">Producto</th>
                          <th className="pb-2 px-3 w-16 text-xs font-semibold text-slate-500 text-right">Cant.</th>
                          <th className="pb-2 px-3 text-xs font-semibold text-slate-500 text-right">Precio/u</th>
                          <th className="pb-2 px-3 text-xs font-semibold text-slate-500 text-right">Subtotal</th>
                          <th className="pb-2 pl-3 text-xs font-semibold text-blue-600 text-right">Costo real/u</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {datos.items.map(item => {
                          const c = calcItem(item, totalMerch, totalGastos)
                          return (
                            <tr key={item._k}>
                              <td className="py-2.5">
                                <p className="font-medium text-slate-800 leading-tight">{item.nombre}</p>
                                <p className="text-xs text-slate-400">{item.unidad_venta}</p>
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-700">{c.qty}</td>
                              <td className="py-2.5 px-3 text-right text-slate-700">{moneda(c.ppu)}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-800">{moneda(c.sub)}</td>
                              <td className="py-2.5 pl-3 text-right font-bold text-blue-700">
                                {c.ppu >= 0 ? moneda(c.costoReal) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300">
                          <td colSpan={3} className="pt-2 text-xs text-slate-400">{datos.items.length} productos</td>
                          <td className="pt-2 px-3 text-right font-bold text-slate-900">{moneda(totalMerch)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Totales finales */}
            <div className="bg-slate-900 text-white rounded-xl p-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Mercancía</span>
                <span className="font-medium">{moneda(totalMerch)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Gastos de traslado</span>
                <span className="font-medium">{moneda(totalGastos)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-slate-700 pt-3 mt-2">
                <span>Costo total del viaje</span>
                <span className="text-blue-300">{moneda(totalViaje)}</span>
              </div>
            </div>

            {/* Botones de confirmación */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => guardar('completado')}
                disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {guardando
                  ? <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Check size={16} />
                }
                Guardar como completado
              </button>
              <button
                onClick={() => guardar('planeado')}
                disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Guardar como planeado
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center">
              <strong>Completado:</strong> actualiza inventario central inmediatamente. ·{' '}
              <strong>Planeado:</strong> guarda el viaje para planificar compras antes de salir.
            </p>
          </div>
        )}
      </div>

      {/* ── Navegación entre pasos (pasos 1-3) ── */}
      {paso < 4 && (
        <div className="flex items-center justify-between">
          <button
            onClick={anterior}
            disabled={paso === 1}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
          >
            <ArrowLeft size={16} />
            Anterior
          </button>
          <button
            onClick={siguiente}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {paso === 3 ? 'Ver resumen' : 'Siguiente'}
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Volver (paso 4) */}
      {paso === 4 && (
        <div className="flex justify-start">
          <button
            onClick={anterior}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white bg-white transition-colors"
          >
            <ArrowLeft size={16} />
            Editar productos
          </button>
        </div>
      )}
    </div>
  )
}
