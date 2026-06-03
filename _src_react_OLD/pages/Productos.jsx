import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Search, X, Package, ChevronRight,
  AlertTriangle, ToggleLeft, ToggleRight, Pencil,
  Upload, CheckCircle, AlertCircle, FileText,
} from 'lucide-react'
import { moneda, fechaCorta } from '../lib/format'
import { getProductos, getCategorias, toggleActivo, importarProductosCSV } from '../lib/productos'

// ─── Constantes ───────────────────────────────────────────────
const STOCK_LABELS = { central: 'Central', punto_a: 'Pto. A', punto_b: 'Pto. B' }

function StockBadge({ val, minimo }) {
  const bajo = typeof minimo === 'number' && val < minimo
  const sinStock = val <= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      sinStock ? 'bg-red-100 text-red-700' :
      bajo     ? 'bg-amber-100 text-amber-700' :
                 'bg-emerald-100 text-emerald-700'
    }`}>
      {bajo && !sinStock && <AlertTriangle size={10} />}
      {val}
    </span>
  )
}

function Spinner() {
  return (
    <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
  )
}

// ─── Parser de CSV ─────────────────────────────────────────────
const CSV_COLUMNS = ['sku', 'nombre', 'categoria', 'contenido', 'unidad_venta', 'costo', 'precio_venta', 'fecha_caducidad', 'existencia_minima', 'cantidad_inicial']
const UNIDADES_VALIDAS = ['pieza', 'kg', 'gramo', 'litro', 'mililitro', 'caja', 'paquete', 'bolsa', 'docena', 'rollo']
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

function parsearCSV(texto) {
  // Parsear campos respetando comillas
  function parseFila(linea) {
    const campos = []
    let campo = ''
    let enComillas = false
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i]
      if (c === '"') {
        if (enComillas && linea[i + 1] === '"') { campo += '"'; i++ }
        else enComillas = !enComillas
      } else if (c === ',' && !enComillas) {
        campos.push(campo.trim())
        campo = ''
      } else {
        campo += c
      }
    }
    campos.push(campo.trim())
    return campos
  }

  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lineas.length) return []

  // Detectar si la primera fila es encabezado
  const primera = parseFila(lineas[0])
  const esEncabezado = primera.some(c => /sku|nombre|precio/i.test(c || ''))
  const inicio = esEncabezado ? 1 : 0

  // Detectar SKUs duplicados dentro del mismo archivo
  const skusVistos = new Set()

  return lineas.slice(inicio).map((linea, idx) => {
    const campos = parseFila(linea)
    const fila = Object.fromEntries(CSV_COLUMNS.map((col, i) => [col, campos[i] ?? '']))
    const errores = []

    if (!fila.nombre?.trim()) errores.push('Nombre requerido')
    if (!fila.precio_venta || isNaN(parseFloat(fila.precio_venta)) || parseFloat(fila.precio_venta) < 0)
      errores.push('Precio inválido')
    if (fila.costo && (isNaN(parseFloat(fila.costo)) || parseFloat(fila.costo) < 0))
      errores.push('Costo inválido')
    if (fila.contenido && (isNaN(parseFloat(fila.contenido)) || parseFloat(fila.contenido) <= 0))
      errores.push('Cantidad inválida')
    if (fila.cantidad_inicial && (isNaN(parseFloat(fila.cantidad_inicial)) || parseFloat(fila.cantidad_inicial) < 0))
      errores.push('Cantidad inicial inválida')
    if (fila.existencia_minima && isNaN(parseFloat(fila.existencia_minima)))
      errores.push('Existencia mínima inválida')
    if (fila.fecha_caducidad?.trim() && !FECHA_RE.test(fila.fecha_caducidad.trim()))
      errores.push('Fecha debe ser AAAA-MM-DD')
    if (fila.unidad_venta && !UNIDADES_VALIDAS.includes(fila.unidad_venta.trim()))
      fila.unidad_venta = 'pieza' // normalizar a pieza si no reconocida

    const skuNorm = fila.sku?.trim().toLowerCase()
    if (skuNorm) {
      if (skusVistos.has(skuNorm)) errores.push('SKU repetido en el archivo')
      else skusVistos.add(skuNorm)
    }

    return { ...fila, _fila: idx + inicio + 1, _errores: errores, _valida: errores.length === 0 }
  })
}

// ─── Modal Importar CSV ────────────────────────────────────────
function ModalImportarCSV({ onClose, onSuccess }) {
  const [archivoNombre, setArchivoNombre] = useState('')
  const [filas,         setFilas]         = useState(null)   // null=sin archivo, []= parseadas
  const [importando,    setImportando]    = useState(false)
  const [dragOver,      setDragOver]      = useState(false)

  const filasValidas   = (filas || []).filter(f => f._valida)
  const filasInvalidas = (filas || []).filter(f => !f._valida)

  function procesarArchivo(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) { toast.error('Solo se aceptan archivos .csv'); return }
    setArchivoNombre(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const parsed = parsearCSV(e.target.result)
      if (!parsed.length) { toast.error('El archivo CSV está vacío'); return }
      setFilas(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function onFileChange(e) { procesarArchivo(e.target.files?.[0]) }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    procesarArchivo(e.dataTransfer.files?.[0])
  }

  async function confirmar() {
    if (!filasValidas.length) { toast.error('No hay filas válidas para importar'); return }
    setImportando(true)
    try {
      const total = await importarProductosCSV(filasValidas)
      toast.success(`${total} producto${total !== 1 ? 's' : ''} importado${total !== 1 ? 's' : ''}`)
      onSuccess()
    } catch (err) {
      toast.error(err?.message || 'Error en la importación')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">Importar productos desde CSV</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Columnas: sku, nombre, categoria, contenido, unidad_venta, costo, precio_venta, fecha_caducidad, existencia_minima, cantidad_inicial
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Zona de carga */}
          {!filas && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
              }`}
            >
              <Upload size={36} strokeWidth={1.2} className="mx-auto text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700 mb-1">Arrastra tu archivo .csv aquí</p>
              <p className="text-xs text-slate-400 mb-4">o haz clic para seleccionarlo</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                <FileText size={15} /> Seleccionar archivo
                <input type="file" accept=".csv" onChange={onFileChange} className="sr-only" />
              </label>
            </div>
          )}

          {/* Archivo cargado — preview */}
          {filas && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-slate-100 rounded-full text-slate-600">
                  <FileText size={12} /> {archivoNombre}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                  <CheckCircle size={12} /> {filasValidas.length} válida{filasValidas.length !== 1 ? 's' : ''}
                </span>
                {filasInvalidas.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                    <AlertCircle size={12} /> {filasInvalidas.length} con error
                  </span>
                )}
                <button
                  onClick={() => { setFilas(null); setArchivoNombre('') }}
                  className="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Tabla preview */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-500 w-8">#</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-500">SKU</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Nombre</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Categoría</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Present.</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Costo</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Precio</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Inicial</th>
                        <th className="px-3 py-2.5 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filas.map((fila, i) => (
                        <tr key={i} className={fila._valida ? 'hover:bg-slate-50/50' : 'bg-red-50/50'}>
                          <td className="px-3 py-2 text-slate-400">{fila._fila}</td>
                          <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{fila.sku || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-[140px] truncate">
                            {fila.nombre || <span className="text-red-400 italic">vacío</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{fila.categoria || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-slate-500">{`${fila.contenido || '1'} ${fila.unidad_venta || 'pieza'}`}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{fila.costo || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-right text-slate-700 font-medium">
                            {fila.precio_venta || <span className="text-red-400">?</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">{fila.cantidad_inicial || '0'}</td>
                          <td className="px-3 py-2 text-center">
                            {fila._valida
                              ? <CheckCircle size={13} className="text-emerald-500 mx-auto" />
                              : (
                                <span title={fila._errores.join(', ')}>
                                  <AlertCircle size={13} className="text-red-500 mx-auto cursor-help" />
                                </span>
                              )
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Errores */}
              {filasInvalidas.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700">Filas con errores (serán omitidas):</p>
                  {filasInvalidas.slice(0, 5).map((f, i) => (
                    <p key={i} className="text-xs text-red-600">
                      Fila {f._fila}: {f._errores.join(' · ')}
                    </p>
                  ))}
                  {filasInvalidas.length > 5 && (
                    <p className="text-xs text-red-500">…y {filasInvalidas.length - 5} más</p>
                  )}
                </div>
              )}

              {/* Formato esperado */}
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer hover:text-slate-600 transition-colors">Ver formato esperado del CSV</summary>
                <pre className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-600 overflow-x-auto leading-relaxed">
{`sku,nombre,categoria,contenido,unidad_venta,costo,precio_venta,fecha_caducidad,existencia_minima,cantidad_inicial
QOX-01,Queso Oaxaca,Lácteos,1,kg,98,180,2026-07-15,10,20
CRM-01,Crema,Lácteos,500,mililitro,28,45,,5,12
BOT-01,Botana BBQ,Botanas,1,paquete,11,18,,20,0`}
                </pre>
                <p className="mt-2 text-slate-400">
                  La <b>fecha</b> va en formato AAAA-MM-DD (puede ir vacía). La <b>cantidad_inicial</b> entra como stock en la bodega Central.
                </p>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          {filas && (
            <button
              onClick={confirmar}
              disabled={importando || filasValidas.length === 0}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400
                         text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              {importando
                ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando…</>
                : <><Upload size={15} />Importar {filasValidas.length} producto{filasValidas.length !== 1 ? 's' : ''}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function Productos() {
  const navigate = useNavigate()

  const [productos,   setProductos]   = useState([])
  const [categorias,  setCategorias]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [q,           setQ]           = useState('')
  const [categoria,   setCategoria]   = useState('')
  const [estado,      setEstado]      = useState('activo')
  const [toggling,    setToggling]    = useState(null)  // id del producto cambiando estado
  const [mostrarImport, setMostrarImport] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProductos({ q, categoria, estado })
      setProductos(data)
    } catch (err) {
      toast.error('Error al cargar productos')
      console.error(err)
    } finally { setLoading(false) }
  }, [q, categoria, estado])

  useEffect(() => { cargar() },           [cargar])
  useEffect(() => { getCategorias().then(setCategorias) }, [])

  async function handleToggle(prod) {
    setToggling(prod.id)
    try {
      await toggleActivo(prod.id, !prod.activo)
      toast.success(prod.activo ? 'Producto desactivado' : 'Producto activado')
      cargar()
    } catch { toast.error('No se pudo cambiar el estado') }
    finally { setToggling(null) }
  }

  const total = productos.length

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? '…' : `${total} producto${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarImport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50
                       text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Upload size={15} /> Importar CSV
          </button>
          <Link
            to="/productos/nuevo"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} /> Nuevo producto
          </Link>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Buscador */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nombre…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50
                       focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                       placeholder-slate-400 transition-all"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Categoría + Estado */}
        <div className="flex gap-3 flex-wrap">
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
            {[['todos','Todos'],['activo','Activos'],['inactivo','Inactivos']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setEstado(v)}
                className={`px-3 py-2 transition-colors ${
                  estado === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      {loading && (
        <div className="flex justify-center py-16"><Spinner /></div>
      )}

      {!loading && productos.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <Package size={44} strokeWidth={1.2} />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500">Sin productos</p>
            <p className="text-xs mt-0.5">
              {q || categoria ? 'Prueba con otros filtros' : 'Agrega el primer producto para comenzar'}
            </p>
          </div>
          {!q && !categoria && (
            <Link to="/productos/nuevo"
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800">
              <Plus size={14} /> Crear producto
            </Link>
          )}
        </div>
      )}

      {/* ── Tabla desktop ── */}
      {!loading && productos.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Nombre</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Unidad</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Precio</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Central</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Pto. A</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Pto. B</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Mínimo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productos.map(p => {
                  const stockCentral = p.stock?.central ?? 0
                  const stockA      = p.stock?.punto_a ?? 0
                  const stockB      = p.stock?.punto_b ?? 0
                  const totalStock  = stockCentral + stockA + stockB
                  const stockBajo   = totalStock < p.existencia_minima && totalStock > 0
                  const sinStock    = totalStock <= 0

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{p.nombre}</span>
                          {(sinStock || stockBajo) && (
                            <AlertTriangle size={13} className={sinStock ? 'text-red-500' : 'text-amber-500'} />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex gap-2">
                          {p.sku && <span className="font-mono">{p.sku}</span>}
                          {p.fecha_caducidad
                            ? <span>Cad. {fechaCorta(p.fecha_caducidad)}</span>
                            : p.dias_caducidad_estimado
                              ? <span>Cad. ~{p.dias_caducidad_estimado}d</span>
                              : null}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.categoria || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-slate-500">{p.contenido && Number(p.contenido) !== 1 ? `${p.contenido} ` : ''}{p.unidad_venta}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{moneda(p.precio_venta)}</td>
                      <td className="px-4 py-3 text-center">
                        <StockBadge val={stockCentral} minimo={null} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StockBadge val={stockA} minimo={null} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StockBadge val={stockB} minimo={null} />
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">{p.existencia_minima}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(p)}
                          disabled={toggling === p.id}
                          title={p.activo ? 'Desactivar' : 'Activar'}
                          className={`transition-colors ${toggling === p.id ? 'opacity-40' : 'hover:opacity-70'}`}
                        >
                          {p.activo
                            ? <ToggleRight size={22} className="text-emerald-500" />
                            : <ToggleLeft size={22} className="text-slate-300" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3 pr-5">
                        <button
                          onClick={() => navigate(`/productos/${p.id}/editar`)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Cards mobile ── */}
          <div className="md:hidden space-y-2">
            {productos.map(p => {
              const stockA = p.stock?.punto_a ?? 0
              const stockB = p.stock?.punto_b ?? 0
              const total  = (p.stock?.central ?? 0) + stockA + stockB
              const alerta = total <= 0 ? 'sin-stock' : total < p.existencia_minima ? 'bajo' : 'ok'

              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 leading-tight">{p.nombre}</p>
                        {!p.activo && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Inactivo</span>
                        )}
                        {alerta === 'sin-stock' && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertTriangle size={10} /> Sin stock
                          </span>
                        )}
                        {alerta === 'bajo' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertTriangle size={10} /> Stock bajo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[p.sku, p.categoria, `${p.contenido && Number(p.contenido) !== 1 ? p.contenido + ' ' : ''}${p.unidad_venta}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="font-bold text-slate-900 shrink-0">{moneda(p.precio_venta)}</p>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    {/* Stock por punto */}
                    <div className="flex gap-3">
                      {[['Cen.', p.stock?.central ?? 0], ['A', stockA], ['B', stockB]].map(([lbl, val]) => (
                        <div key={lbl} className="text-center">
                          <p className="text-xs text-slate-400 mb-0.5">{lbl}</p>
                          <StockBadge val={val} minimo={null} />
                        </div>
                      ))}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(p)}
                        disabled={toggling === p.id}
                        className={`p-2 rounded-lg transition-colors ${toggling === p.id ? 'opacity-40' : 'hover:bg-slate-100'}`}
                      >
                        {p.activo
                          ? <ToggleRight size={20} className="text-emerald-500" />
                          : <ToggleLeft size={20} className="text-slate-300" />
                        }
                      </button>
                      <button
                        onClick={() => navigate(`/productos/${p.id}/editar`)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Modal importar CSV ── */}
      {mostrarImport && (
        <ModalImportarCSV
          onClose={() => setMostrarImport(false)}
          onSuccess={() => { setMostrarImport(false); cargar() }}
        />
      )}
    </div>
  )
}
