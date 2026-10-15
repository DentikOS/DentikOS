import { createLogger } from '../../../../infrastructure/logging/logger'
import { registrarCambioEstado } from '../utils/auditoriaCita'
import type { Cita } from '../schemas/citaSchema'

const log = createLogger('doctorAusenteService')

export interface ResultadoReasignacion {
  totalCitas: number
  reasignadas: number
  pendientesRevision: number
  detalles: Array<{
    citaId: string | number
    pacienteNombre?: string
    horaOriginal: string
    nuevoDoctor?: string
    estado: 'reasignada' | 'pendiente'
    motivo?: string
  }>
}

/**
 * BP05 §09 (F4: C): Doctor ausente
 * 
 * Lista las citas del doctor en la fecha especificada y prepara
 * plan de reasignación. En MVP, marca las citas como pendientes
 * de reasignación manual por la recepcionista (plan B del CEO).
 */
export const procesarAusenciaDoctor = async (
  doctorId: string,
  doctorNombre: string,
  fecha: string,
  citasActuales: Cita[]
): Promise<ResultadoReasignacion> => {
  const resultado: ResultadoReasignacion = {
    totalCitas: 0,
    reasignadas: 0,
    pendientesRevision: 0,
    detalles: [],
  }

  // Filtrar citas activas del doctor en la fecha
  const citasDelDoctor = citasActuales.filter(c =>
    String(c.doctor) === String(doctorId) &&
    c.fecha === fecha &&
    c.estado !== 'Cancelada' &&
    c.estado !== 'Completada' &&
    c.estado !== 'No-show'
  )

  resultado.totalCitas = citasDelDoctor.length

  if (citasDelDoctor.length === 0) {
    return resultado
  }

  // Plan B del CEO: marcar para revisión manual de la recepcionista
  for (const cita of citasDelDoctor) {
    // Registrar en timeline que el doctor está ausente
    await registrarCambioEstado(
      cita.id,
      cita.estado,
      cita.estado, // El estado no cambia, solo registramos el evento
      'sistema',
      `Doctor ${doctorNombre} ausente - Cita pendiente de reasignación por recepcionista`
    )

    resultado.detalles.push({
      citaId: cita.id,
      pacienteNombre: cita.pacienteNombre,
      horaOriginal: cita.horaInicio,
      estado: 'pendiente',
      motivo: 'Requiere reasignación manual',
    })
    resultado.pendientesRevision++
  }

  log.info(`Ausencia procesada: ${resultado.totalCitas} citas pendientes de revisión`)
  return resultado
}
