import { timelineService, type EventoTimeline } from '../../../services/timelineService'

export interface DerivacionClinica {
  id: string
  fecha: string
  especialidad: string
  especialista: string
  motivo: string
  prioridad: 'urgente' | 'normal'
}

export type DerivacionInput = Omit<DerivacionClinica, 'id' | 'fecha'>

const desdeEvento = (evento: EventoTimeline): DerivacionClinica | null => {
  if (evento.tipo !== 'derivacion' || !evento.id || !evento.metadata) return null
  const { especialidad, especialista, motivo, prioridad } = evento.metadata
  if (typeof especialidad !== 'string' || typeof motivo !== 'string' ||
      typeof especialista !== 'string' || (prioridad !== 'urgente' && prioridad !== 'normal')) return null
  return { id: evento.id, fecha: evento.fecha, especialidad, especialista, motivo, prioridad }
}

export const derivacionesService = {
  async listar(pacienteId: string): Promise<DerivacionClinica[]> {
    const eventos = await timelineService.cargarTimeline(pacienteId)
    return eventos.map(desdeEvento).filter((item): item is DerivacionClinica => item !== null)
  },

  async emitir(pacienteId: string, input: DerivacionInput): Promise<DerivacionClinica> {
    const especialidad = input.especialidad.trim()
    const especialista = input.especialista.trim()
    const motivo = input.motivo.trim()
    if (!especialidad || !motivo || (input.prioridad !== 'urgente' && input.prioridad !== 'normal')) {
      throw new Error('Completa la especialidad, el motivo y la prioridad de la derivación.')
    }
    const derivacion: DerivacionClinica = {
      id: crypto.randomUUID(), fecha: new Date().toISOString(),
      especialidad, especialista, motivo, prioridad: input.prioridad,
    }
    const guardada = await timelineService.agregarEvento(pacienteId, {
      id: derivacion.id,
      tipo: 'derivacion', fecha: derivacion.fecha,
      titulo: `Derivación a ${especialidad}`,
      detalles: motivo,
      metadata: { especialidad, especialista, motivo, prioridad: input.prioridad },
    })
    if (!guardada) throw new Error('No se pudo guardar la derivación clínica. Revisa la conexión y vuelve a intentar.')
    return derivacion
  },
}
