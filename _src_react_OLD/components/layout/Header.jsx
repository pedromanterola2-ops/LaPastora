import { useState, useRef, useEffect } from 'react'
import { Menu, Store, ChevronDown, User, LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { ROL_LABELS, puntoDeVentaDelRol } from '../../lib/permissions'

const PUNTOS_VENTA = [
  { id: 'punto_a', nombre: 'Punto A' },
  { id: 'punto_b', nombre: 'Punto B' },
]

export default function Header({ onMobileMenuOpen }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  // Para roles de punto fijo el selector queda bloqueado en su punto
  const puntoFijo = puntoDeVentaDelRol(profile?.rol)
  const [puntoActivo, setPuntoActivo] = useState(
    PUNTOS_VENTA.find((p) => p.id === puntoFijo) ?? PUNTOS_VENTA[0]
  )
  const [storeOpen, setStoreOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const userMenuRef = useRef(null)

  // Cerrar menú de usuario al clic fuera
  useEffect(() => {
    function handler(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSignOut() {
    setUserOpen(false)
    await signOut()
    navigate('/login', { replace: true })
    toast.success('Sesión cerrada')
  }

  const rolLabel = profile ? (ROL_LABELS[profile.rol] ?? profile.rol) : '—'
  const nombre = profile?.nombre ?? 'Usuario'
  const iniciales = nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0">

      {/* Botón menú móvil */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Selector de punto de venta */}
      <div className="relative">
        <button
          onClick={() => !puntoFijo && setStoreOpen(!storeOpen)}
          className={[
            'flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm',
            puntoFijo
              ? 'cursor-default opacity-80'
              : 'hover:bg-slate-50 transition-colors',
          ].join(' ')}
        >
          <Store size={16} className="text-blue-600 flex-shrink-0" />
          <span className="font-medium text-slate-700 hidden sm:block">
            {puntoActivo.nombre}
          </span>
          {!puntoFijo && (
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform ${storeOpen ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        {storeOpen && !puntoFijo && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setStoreOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-36">
              {PUNTOS_VENTA.map((pv) => (
                <button
                  key={pv.id}
                  onClick={() => {
                    setPuntoActivo(pv)
                    setStoreOpen(false)
                  }}
                  className={[
                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                    pv.id === puntoActivo.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {pv.nombre}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Menú de usuario */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setUserOpen(!userOpen)}
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-50 transition-colors"
          aria-label="Menú de usuario"
          aria-expanded={userOpen}
        >
          {/* Info (oculta en móvil pequeño) */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-slate-700 leading-tight">{nombre}</span>
            <span className="text-xs text-slate-400 leading-tight">{rolLabel}</span>
          </div>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-700 text-xs font-semibold">{iniciales}</span>
          </div>
        </button>

        {/* Dropdown */}
        {userOpen && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-48 py-1">
            {/* Info usuario en móvil */}
            <div className="sm:hidden px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-800">{nombre}</p>
              <p className="text-xs text-slate-400">{rolLabel}</p>
            </div>

            {profile?.rol === 'admin' && (
              <button
                onClick={() => {
                  setUserOpen(false)
                  navigate('/usuarios')
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings size={15} className="text-slate-400" />
                Administrar usuarios
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
