/**
 * Permisos y roles de La Pastora
 *
 * Roles:
 *  - admin    → acceso total
 *  - compras  → proveedores, viajes, inventario (con distribución), productos, transferencias, reportes
 *              SIN acceso a usuarios ni a la pestaña de rentabilidad
 *  - punto_a  → ventas (Punto A) e inventario (solo lectura Punto A)
 *  - punto_b  → ventas (Punto B) e inventario (solo lectura Punto B)
 */

export const ROLES = {
  ADMIN: 'admin',
  COMPRAS: 'compras',
  PUNTO_A: 'punto_a',
  PUNTO_B: 'punto_b',
}

export const ROL_LABELS = {
  admin: 'Administrador',
  compras: 'Compras',
  punto_a: 'Punto A',
  punto_b: 'Punto B',
}

// Rutas permitidas por rol (null = sin restricción)
const ROUTE_ACCESS = {
  admin: null,
  compras: [
    '/',
    '/proveedores',
    '/viajes',
    '/inventario',
    '/productos',
    '/transferencias',
    '/reportes',
  ],
  punto_a: ['/', '/ventas', '/inventario', '/solicitudes'],
  punto_b: ['/', '/ventas', '/inventario', '/solicitudes'],
}

/**
 * Verifica si un rol puede acceder a una ruta.
 * Usa prefix matching para cubrir sub-rutas (ej. /viajes/123).
 */
export function canAccess(rol, pathname) {
  const allowed = ROUTE_ACCESS[rol]
  if (!allowed) return true // admin
  return allowed.some((r) =>
    r === '/'
      ? pathname === '/'
      : pathname === r || pathname.startsWith(r + '/')
  )
}

/**
 * Items de navegación visibles según rol.
 * Cada entrada es una de las rutas base definidas en NAV_ALL_ITEMS.
 */
export const NAV_PATHS_POR_ROL = {
  admin: ['/', '/proveedores', '/viajes', '/inventario', '/productos', '/ventas', '/transferencias', '/reportes', '/usuarios', '/solicitudes'],
  compras: ['/', '/proveedores', '/viajes', '/inventario', '/productos', '/transferencias', '/reportes'],
  punto_a: ['/', '/ventas', '/inventario', '/solicitudes'],
  punto_b: ['/', '/ventas', '/inventario', '/solicitudes'],
}

/**
 * ¿El rol puede ver precios de compra y márgenes?
 */
export function puedeVerCostos(rol) {
  return rol === 'admin' || rol === 'compras'
}

/**
 * ¿El rol puede ver la pestaña de rentabilidad?
 */
export function puedeVerRentabilidad(rol) {
  return rol === 'admin'
}

/**
 * Punto de venta asignado al rol (para punto_a y punto_b).
 * Devuelve null si el rol no está restringido a un punto.
 */
export function puntoDeVentaDelRol(rol) {
  if (rol === 'punto_a') return 'punto_a'
  if (rol === 'punto_b') return 'punto_b'
  return null
}
