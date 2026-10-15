import type { Cita } from '../schemas/citaSchema'

/**
 * Valida si un slot de tiempo está disponible para una cita
 * BP05 §08: Validación en tiempo real durante drag & drop
 */
export interface ResultadoValidacionSlot {
  disponible: boolean
  hayConflicto: boolean
  citasEnConflicto: Cita[]
  permiteSobrecupo: boolean
}

/**
 * Calcula si dos rangos de tiempo se superponen
 */
const rangosSeSuperponen = (
  inicio1: string,
  fin1: string,
  inicio2: string,
  fin2: string
): boolean => {
  return inicio1 < fin2 && fin1 > inicio2
}

/**
 * Valida si un slot está disponible para mover una cita
 */
export const validarSlotDisponible = (
  citaId: string | number,
  nuevaFecha: string,
  nuevaHoraInicio: string,
  nuevaHoraFin: string,
  doctor: string | undefined,
  box: string | undefined,
  todasLasCitas: Cita[],
  permiteSobrecupos: boolean = false
): ResultadoValidacionSlot => {
  const citasMismoSlot = todasLasCitas.filter((c) => {
    if (String(c.id) === String(citaId)) return false
    if (c.fecha !== nuevaFecha) return false
    if (c.estado === 'Cancelada' || c.estado === 'No-show') return false

    const citaInicio = c.horaInicio || ''
    const citaFin = c.horaFin || c.horaInicio || ''

    if (!rangosSeSuperponen(nuevaHoraInicio, nuevaHoraFin, citaInicio, citaFin)) {
      return false
    }

    if (doctor && c.doctor && c.doctor !== doctor) return false
    if (box && c.boxAsignado && c.boxAsignado !== box) return false

    return true
  })

  const hayConflicto = citasMismoSlot.length > 0

  return {
    disponible: !hayConflicto || permiteSobrecupos,
    hayConflicto,
    citasEnConflicto: citasMismoSlot,
    permiteSobrecupo: permiteSobrecupos,
  }
}

/**
 * Obtiene el color de borde para un slot según su disponibilidad
 */
export const obtenerColorBordeSlot = (resultado: ResultadoValidacionSlot): string => {
  if (!resultado.hayConflicto) return 'border-transparent'
  if (resultado.permiteSobrecupo) return 'border-amber-400 dark:border-amber-600'
  return 'border-rose-500 dark:border-rose-600'
}
