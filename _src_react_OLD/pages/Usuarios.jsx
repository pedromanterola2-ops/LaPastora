import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import {
  UserPlus, Search, RefreshCw, Edit2, ToggleLeft, ToggleRight,
  X, Eye, EyeOff, Check, AlertCircle, Shield,
} from 'lucide-react'
import { ROL_LABELS } from '../lib/permissions'

// ── Supabase sin sesión persistente — para crear cuentas sin reemplazar la sesión admin ──
const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// ── Supabase principal (para leer/escribir en la tabla usuarios) ──
import { supabase } from '../lib/supabase'

const ROLES = ['admin', 'compras', 'punto_a', 'punto_b']

const ROL_BADGE = {
  admin: 'bg-purple-100 text-purple-700',
  compras: 'bg-blue-100 text-blue-700',
  punto_a: 'bg-green-100 text-green-700',
  punto_b: 'bg-orange-100 text-orange-700',
}

/* ─── Utilidades ─────────────────────────────────── */
function Badge({ rol }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROL_BADGE[rol] ?? 'bg-slate-100 text-slate-600'}`}>
      {ROL_LABELS[rol] ?? rol}
    </span>
  )
}

/* ─── Modal de crear / editar usuario ──────────────── */
function UsuarioModal({ usuario, onClose, onSaved }) {
  const esNuevo = !usuario
  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    rol: usuario?.rol ?? 'compras',
    password: '',
    activo: usuario?.activo ?? true,
  })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.nombre.trim()) return setError('El nombre es obligatorio.')
    if (!form.email.trim()) return setError('El correo es obligatorio.')
    if (esNuevo && form.password.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres.')
    }

    setSaving(true)
    try {
      if (esNuevo) {
        // 1. Crear cuenta en Supabase Auth (cliente sin sesión para no desloguear al admin)
        const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        })
        if (authError) {
          if (authError.message.includes('already registered')) {
            throw new Error('Este correo ya tiene una cuenta registrada.')
          }
          throw new Error(authError.message)
        }

        // 2. Insertar perfil en la tabla usuarios
        const { error: dbError } = await supabase.from('usuarios').insert({
          nombre: form.nombre.trim(),
          email: form.email.trim().toLowerCase(),
          rol: form.rol,
          activo: true,
        })
        if (dbError) throw new Error(dbError.message)

      } else {
        // Editar usuario existente
        const updates = {
          nombre: form.nombre.trim(),
          rol: form.rol,
          activo: form.activo,
        }
        const { error: dbError } = await supabase
          .from('usuarios')
          .update(updates)
          .eq('id', usuario.id)
        if (dbError) throw new Error(dbError.message)
      }

      toast.success(esNuevo ? 'Usuario creado correctamente' : 'Usuario actualizado')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {esNuevo ? 'Nuevo usuario' : 'Editar usuario'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Ej. Ana García"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="usuario@ejemplo.com"
              disabled={!esNuevo}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
            {!esNuevo && (
              <p className="text-xs text-slate-400 mt-1">El correo no se puede cambiar.</p>
            )}
          </div>

          {/* Contraseña (solo nuevo usuario) */}
          {esNuevo && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña inicial</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rol</label>
            <select
              value={form.rol}
              onChange={(e) => set('rol', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROL_LABELS[r]}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              {form.rol === 'punto_a' && 'Acceso solo a Ventas e Inventario del Punto A.'}
              {form.rol === 'punto_b' && 'Acceso solo a Ventas e Inventario del Punto B.'}
              {form.rol === 'compras' && 'Acceso a compras, inventario y productos. Sin reportes de rentabilidad.'}
              {form.rol === 'admin' && 'Acceso completo a todos los módulos y configuración.'}
            </p>
          </div>

          {/* Estado activo (solo editar) */}
          {!esNuevo && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-slate-700">Estado de la cuenta</p>
                <p className="text-xs text-slate-400">Una cuenta inactiva no puede iniciar sesión.</p>
              </div>
              <button
                type="button"
                onClick={() => set('activo', !form.activo)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  form.activo
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {form.activo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {form.activo ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check size={15} />
              )}
              {saving ? 'Guardando…' : (esNuevo ? 'Crear usuario' : 'Guardar cambios')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Página principal ─────────────────────────────── */
export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null) // null | 'nuevo' | {usuario}

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nombre')
    if (error) {
      toast.error('Error al cargar usuarios')
    } else {
      setUsuarios(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function toggleActivo(u) {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !u.activo })
      .eq('id', u.id)
    if (error) {
      toast.error('No se pudo actualizar el estado')
    } else {
      toast.success(u.activo ? 'Cuenta desactivada' : 'Cuenta activada')
      cargar()
    }
  }

  const filtered = usuarios.filter((u) => {
    const q = busqueda.toLowerCase()
    return (
      u.nombre?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      ROL_LABELS[u.rol]?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={20} className="text-purple-600" />
            <h1 className="text-xl font-bold text-slate-800">Usuarios</h1>
          </div>
          <p className="text-sm text-slate-500">Administra las cuentas y permisos del sistema.</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            onClick={() => setModal('nuevo')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <UserPlus size={15} />
            Nuevo usuario
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo o rol…"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay usuarios registrados'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Correo</th>
                  <th className="text-left px-4 py-3">Rol</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.nombre}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3"><Badge rol={u.rol} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-green-500' : 'bg-slate-400'}`} />
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => toggleActivo(u)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.activo
                              ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50'
                              : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                        >
                          {u.activo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((u) => (
              <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-slate-800">{u.nombre}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{u.email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    u.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge rol={u.rol} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModal(u)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50"
                    >
                      <Edit2 size={13} /> Editar
                    </button>
                    <button
                      onClick={() => toggleActivo(u)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        u.activo
                          ? 'text-orange-600 border-orange-200 hover:bg-orange-50'
                          : 'text-green-600 border-green-200 hover:bg-green-50'
                      }`}
                    >
                      {u.activo ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Conteo */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-400 mt-3 text-right">
          {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <UsuarioModal
          usuario={modal === 'nuevo' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}
