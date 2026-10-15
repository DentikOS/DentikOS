/**
 * agendaConflictos — Detección de conflictos de horario (F10-C3.13 / BP05 §02)
 */

const ESTADOS_EXCLUIR = ['Cancelada', 'Anulado']
const TODOS_LOS_BOXES = 'Todos los Boxes'

export interface CitaParaConflicto {
  id?: string | number; estado?: string; fecha?: string; fechaIso?: string
  horaInicio?: string; horaFin?: string; boxAsignado?: string; [key: string]: unknown
}

export interface ResultadoConflicto {
  hayConflicto: boolean
  citasConflicto: CitaParaConflicto[]
}

/**
 * Detecta conflictos entre un nuevo bloqueo y citas/bloqueos existentes.
 */
export const detectarConflictoBloqueo = (
  nuevoBloqueo: CitaParaConflicto | null | undefined,
  citasExistentes: CitaParaConflicto[] = []
): ResultadoConflicto => {
  if (!nuevoBloqueo?.horaInicio || !nuevoBloqueo?.horaFin) {
    return { hayConflicto: false, citasConflicto: [] }
  }

  const { fecha, horaInicio, horaFin, boxAsignado } = nuevoBloqueo

  const citasConflicto = citasExistentes.filter(c => {
    if (c.estado && ESTADOS_EXCLUIR.includes(c.estado)) return false
    if (!c.horaInicio || !c.horaFin) return false

    const fechaA = fecha || nuevoBloqueo.fechaIso
    const fechaB = c.fecha || c.fechaIso
    if (!fechaA || !fechaB || String(fechaA) !== String(fechaB)) return false

    const boxA = boxAsignado || TODOS_LOS_BOXES
    const boxB = c.boxAsignado || TODOS_LOS_BOXES
    if (boxA !== TODOS_LOS_BOXES && boxB !== TODOS_LOS_BOXES && String(boxA) !== String(boxB)) return false

    return horaInicio < c.horaFin && horaFin > c.horaInicio
  })

  return { hayConflicto: citasConflicto.length > 0, citasConflicto }
}
