import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canAccess } from '../../lib/permissions'

/**
 * Protege rutas verificando:
 *  1. Si hay sesión activa (si no → redirige a /login)
 *  2. Si el rol del usuario tiene permiso para la ruta actual (si no → redirige a /)
 */
export default function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  // Mientras se resuelve la sesión inicial, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  // No autenticado → ir a login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Autenticado pero sin permiso para esta ruta → ir al inicio
  if (profile && !canAccess(profile.rol, location.pathname)) {
    return <Navigate to="/" replace />
  }

  return children
}
