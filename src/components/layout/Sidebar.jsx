import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Tag,
  Receipt,
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  X,
  UserCog,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { NAV_PATHS_POR_ROL } from '../../lib/permissions'

const ALL_NAV_ITEMS = [
  { path: '/',               label: 'Dashboard',        icon: LayoutDashboard,  exact: true },
  { path: '/proveedores',    label: 'Proveedores',       icon: Users },
  { path: '/viajes',         label: 'Viajes de Compra',  icon: ShoppingCart },
  { path: '/inventario',     label: 'Inventario',        icon: Package },
  { path: '/productos',      label: 'Productos',         icon: Tag },
  { path: '/ventas',         label: 'Ventas',            icon: Receipt },
  { path: '/transferencias', label: 'Transferencias',    icon: ArrowLeftRight },
  { path: '/reportes',       label: 'Reportes',          icon: BarChart3 },
  { path: '/usuarios',       label: 'Usuarios',          icon: UserCog },
]

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { profile } = useAuth()

  // Filtrar items según el rol del usuario
  const allowedPaths = profile
    ? (NAV_PATHS_POR_ROL[profile.rol] ?? [])
    : ['/', '/ventas']

  const navItems = ALL_NAV_ITEMS.filter((item) => allowedPaths.includes(item.path))

  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
      isActive
        ? 'bg-blue-50 text-blue-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    ].join(' ')

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo / marca */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-100 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">LP</span>
            </div>
            <span className="font-semibold text-slate-800 text-sm leading-tight">
              La Pastora
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center mx-auto">
            <span className="text-white text-xs font-bold">LP</span>
          </div>
        )}

        {/* Botón colapsar — solo desktop */}
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Colapsar menú"
        >
          <ChevronLeft
            size={16}
            className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Botón cerrar — solo móvil */}
        <button
          onClick={onMobileClose}
          className="lg:hidden flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-600"
          aria-label="Cerrar menú"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            className={navLinkClass}
            onClick={onMobileClose}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0">
          <p className="text-xs text-slate-400">v1.0.0</p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Sidebar desktop */}
      <aside
        className={[
          'hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-slate-200',
          'transition-all duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-56',
        ].join(' ')}
      >
        {content}
      </aside>

      {/* Overlay móvil */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar móvil (drawer) */}
      <aside
        className={[
          'lg:hidden fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-white border-r border-slate-200',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {content}
      </aside>
    </>
  )
}
