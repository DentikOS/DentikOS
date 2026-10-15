/**
 * Transiciones de estado válidas (BP05 §02).
 * Solo los 8 estados oficiales: Pendiente → Confirmada → En sala de espera →
 * En atención → Completada. Con ramas paralelas de Cancelada, No-show y Reagendada.
 *
 * Diagrama:
 * Pendiente ──┬──► Confirmada ──► En sala de espera ──► En atención ──► Completada
 *              │                     │
 *              ├──► Cancelada        ├──► No-show (paciente se fue)
 *              ├──► No-show          │
 *              └──► Reagendada       └──► Cancelada
 */
export const TRANSICIONES_PERMITIDAS: Record<string, readonly string[]> = {
  Pendiente: ['Confirmada', 'Cancelada', 'No-show', 'Reagendada'],
  Confirmada: ['En sala de espera', 'Cancelada', 'No-show', 'Reagendada'],
  'En sala de espera': ['En atención', 'No-show', 'Cancelada'],
  'En atención': ['Completada'],
  Completada: [],
  Cancelada: [],
  'No-show': [],
  Reagendada: ['Pendiente', 'Confirmada'],
  Bloqueado: [],
}

/**
 * Valida si una transición de estado es permitida según BP05 §02.
 * Si la transición NO es válida, retorna false y el llamador debe
 * mostrar toast: "Transición no permitida".
 */
export const validarTransicion = (estadoActual: string, estadoNuevo: string): boolean => {
  if (estadoActual === estadoNuevo) return true
  const permitidas = TRANSICIONES_PERMITIDAS[estadoActual]
  return permitidas ? permitidas.includes(estadoNuevo) : false
}
