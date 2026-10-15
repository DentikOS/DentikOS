import type { Cita } from '../schemas/citaSchema'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Estados legacy → estados core BP05 §02 */
const ESTADOS_LEGACY: Record<string, string> = {
  Agendado: 'Pendiente',
  Agendada: 'Pendiente',
  Confirmado: 'Confirmada',
  'En Espera': 'En sala de espera',
  EnEspera: 'En sala de espera',
  Atendido: 'Completada',
  Atendida: 'Completada',
  Cancelado: 'Cancelada',
}

export const esUuid = (v: string): boolean => UUID_RE.test(v)

export const normalizarEstado = (estado: string): string =>
  ESTADOS_LEGACY[estado] || estado || 'Pendiente'

/**
 * Si cita.doctor contiene un UUID, lo mueve a doctorId y resuelve
 * el nombre legible usando el mapa userId→nombreCompleto.
 */
export const normalizarDoctor = (
  cita: Cita,
  mapaDoctores: Record<string, string>
): Cita => {
  const doc = cita.doctor
  if (doc && esUuid(doc)) {
    return { ...cita, doctorId: doc, doctor: mapaDoctores[doc] || undefined }
  }
  return cita
}

export const normalizarCita = (cita: Cita, mapaDoctores: Record<string, string> = {}): Cita =>
  normalizarDoctor(
    { ...cita, estado: normalizarEstado(cita.estado || 'Pendiente') },
    mapaDoctores
  )
