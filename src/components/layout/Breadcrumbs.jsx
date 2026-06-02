import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

/**
 * Mapa de segmentos de ruta → etiqueta legible.
 * Los segmentos dinámicos (UUIDs, IDs numéricos) usan la función dynamicLabel.
 */
const SEGMENT_LABELS = {
  proveedores: 'Proveedores',
  viajes: 'Viajes de Compra',
  inventario: 'Inventario',
  distribucion: 'Distribución',
  productos: 'Productos',
  ventas: 'Ventas',
  transferencias: 'Transferencias',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
  nuevo: 'Nuevo',
  editar: 'Editar',
  planificacion: 'Planificación',
  recepcion: 'Recepción',
}

function isId(segment) {
  // UUID o número puro
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(segment) || /^\d+$/.test(segment)
}

function buildCrumbs(pathname) {
  if (pathname === '/') return []

  const parts = pathname.split('/').filter(Boolean)
  const crumbs = []
  let accumulated = ''

  parts.forEach((part, i) => {
    accumulated += '/' + part
    const prevPart = parts[i - 1] || ''

    let label
    if (isId(part)) {
      // Etiqueta dinámica según el segmento padre
      const parentLabels = {
        proveedores: 'Proveedor',
        viajes: 'Viaje',
        productos: 'Producto',
      }
      label = parentLabels[prevPart] || 'Detalle'
    } else {
      label = SEGMENT_LABELS[part] || (part.charAt(0).toUpperCase() + part.slice(1))
    }

    crumbs.push({ path: accumulated, label })
  })

  return crumbs
}

export default function Breadcrumbs() {
  const { pathname } = useLocation()

  if (pathname === '/') return null

  const crumbs = buildCrumbs(pathname)
  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1 text-sm text-slate-500 mb-4 flex-wrap">
      <Link
        to="/"
        className="flex items-center p-0.5 rounded hover:text-slate-700 transition-colors"
        aria-label="Inicio"
      >
        <Home size={14} />
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-slate-300 flex-shrink-0" />
            {isLast ? (
              <span className="text-slate-700 font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-slate-700 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
