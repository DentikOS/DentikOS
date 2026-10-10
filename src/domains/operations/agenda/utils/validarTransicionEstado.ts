export const TRANSICIONES_PERMITIDAS: Record<string, readonly string[]> = {
  Pendiente: ['Confirmada', 'Cancelada', 'No-show', 'Reagendada'],
  Agendado: ['Confirmada', 'Confirmado', 'Cancelada', 'No-show', 'Reagendada'],
  Confirmada: ['En sala de espera', 'Cancelada', 'No-show', 'Reagendada'],
  Confirmado: ['En sala de espera', 'En Espera', 'Cancelada', 'No-show', 'Reagendada'],
  'En sala de espera': ['En atención', 'No-show', 'Cancelada'],
  'En Espera': ['En atención', 'En Sillón', 'No-show', 'Cancelada'],
  'En atención': ['Completada'],
  'En Sillón': ['Completada', 'Atendido'],
  Completada: [],
  Atendido: [],
  Cancelada: [],
  Anulado: [],
  'No-show': [],
  Reagendada: ['Pendiente', 'Confirmada']
}

export const validarTransicion = (estadoActual: string, estadoNuevo: string): boolean => {
  if (estadoActual === estadoNuevo) return true
  const permitidas = TRANSICIONES_PERMITIDAS[estadoActual]
  return permitidas ? permitidas.includes(estadoNuevo) : false
}
