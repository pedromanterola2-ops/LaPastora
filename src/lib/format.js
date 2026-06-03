/** Formatea un número como moneda MXN */
export function moneda(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0)
}

/** Fecha larga: "15 de enero de 2025" */
export function fechaLarga(str) {
  if (!str) return '—'
  return new Date(`${str}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Fecha corta: "15 ene 2025" */
export function fechaCorta(str) {
  if (!str) return '—'
  return new Date(`${str}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Sumar campos de gastos de un viaje */
export const GASTOS_KEYS = [
  'gastos_gasolina', 'gastos_casetas', 'gastos_comida',
  'gastos_hospedaje', 'gastos_otros',
]

export const GASTOS_LABELS = {
  gastos_gasolina:  'Gasolina',
  gastos_casetas:   'Casetas',
  gastos_comida:    'Comida',
  gastos_hospedaje: 'Hospedaje',
  gastos_otros:     'Otros gastos',
}

export function totalGastosViaje(viaje) {
  return GASTOS_KEYS.reduce((a, k) => a + (Number(viaje[k]) || 0), 0)
}

export function totalMerchViaje(items) {
  return (items || []).reduce(
    (a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precio_unitario_compra) || 0), 0
  )
}

/** Config visual de estados de un viaje */
export const ESTADO_VIAJE = {
  planeado:   { label: 'Planeado',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  en_curso:   { label: 'En curso',   cls: 'bg-amber-50  text-amber-700  border-amber-200' },
  completado: { label: 'Completado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}
