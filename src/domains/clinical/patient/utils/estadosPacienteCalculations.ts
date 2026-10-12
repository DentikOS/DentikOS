import type { Paciente } from '../schemas/pacienteSchema'

export type EstadoCalculado = 'activo' | 'inactivo' | 'nuevo'

export const MESES_INACTIVIDAD = 12

/**
 * Calcula los días transcurridos desde la última visita.
 * Retorna null si no hay fecha de última visita.
 */
export const calcularDiasSinVisita = (fechaUltimaVisita?: string | null): number | null => {
  if (!fechaUltimaVisita) return null
  const fecha = new Date(fechaUltimaVisita)
  if (Number.isNaN(fecha.getTime())) return null
  const ahora = new Date()
  const diffMs = ahora.getTime() - fecha.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Determina el estado clínico del paciente según BP06 §04:
 * - nuevo: sin fecha de creación reciente o sin primera visita
 * - activo: con visita en los últimos 12 meses
 * - inactivo: sin visita hace 12+ meses
 * NO sobreescribe estados administrativos (bloqueado/desactivado).
 */
export const calcularEstadoClinico = (paciente: Paciente): EstadoCalculado => {
  const fechaVisita = paciente.fechaUltimaVisita || (paciente as unknown as Record<string, unknown>).ultimaVisita
  const dias = calcularDiasSinVisita(typeof fechaVisita === 'string' ? fechaVisita : null)
  if (dias === null) return 'nuevo'
  if (dias > MESES_INACTIVIDAD * 30) return 'inactivo'
  return 'activo'
}
