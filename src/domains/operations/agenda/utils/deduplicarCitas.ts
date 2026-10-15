import type { Cita } from '../schemas/citaSchema'

const claveCita = (c: Cita): string =>
  `${(c.fecha || '').split('T')[0]}|${c.horaInicio}|${c.pacienteId || c.pacienteNombre || ''}`

/** Prioriza la copia con más datos (doctor, doctorId, box, id string) */
const riqueza = (c: Cita): number =>
  (c.doctor ? 2 : 0) +
  (c.doctorId ? 2 : 0) +
  (typeof c.id === 'string' ? 1 : 0) +
  (c.boxAsignado ? 1 : 0)

export const deduplicarCitas = (citas: Cita[]): Cita[] => {
  const mapa = new Map<string, Cita>()
  for (const cita of citas) {
    const clave = claveCita(cita)
    const previa = mapa.get(clave)
    if (!previa || riqueza(cita) > riqueza(previa)) mapa.set(clave, cita)
  }
  return Array.from(mapa.values())
}
