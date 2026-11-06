import { timelineService, type EventoTimeline } from '../../../services/timelineService'

export interface DerivacionClinica {
  id: string
  fecha: string
  especialidad: string
  especialista: string
  motivo: string
  diagnostico?: string
  prioridad: 'urgente' | 'normal'
  archivoIds?: string[]
  incluirOdontograma?: boolean
  incluirEvoluciones?: boolean
  emisor?: string
}

export type DerivacionInput = Omit<DerivacionClinica, 'id' | 'fecha'>

const desdeEvento = (evento: EventoTimeline): DerivacionClinica | null => {
  if (evento.tipo !== 'derivacion' || !evento.id || !evento.metadata) return null
  const { especialidad, especialista, motivo, prioridad, diagnostico, archivoIds,
    incluirOdontograma, incluirEvoluciones } = evento.metadata
  if (typeof especialidad !== 'string' || typeof motivo !== 'string' ||
      typeof especialista !== 'string' || (prioridad !== 'urgente' && prioridad !== 'normal')) return null
  return { id: evento.id, fecha: evento.fecha, especialidad, especialista, motivo, prioridad,
    diagnostico: typeof diagnostico === 'string' ? diagnostico : undefined,
    archivoIds: Array.isArray(archivoIds) ? archivoIds.filter((id): id is string => typeof id === 'string') : [],
    incluirOdontograma: incluirOdontograma === true, incluirEvoluciones: incluirEvoluciones === true,
    emisor: typeof evento.profesional === 'string' ? evento.profesional : undefined }
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
    const diagnostico = input.diagnostico?.trim() || ''
    const archivoIds = input.archivoIds || []
    if (!especialidad || !motivo || (input.prioridad !== 'urgente' && input.prioridad !== 'normal')) {
      throw new Error('Completa la especialidad, el motivo y la prioridad de la derivación.')
    }
    if (archivoIds.length > 20 || archivoIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      throw new Error('Revisa los archivos seleccionados para la derivación.')
    }
    const derivacion: DerivacionClinica = {
      id: crypto.randomUUID(), fecha: new Date().toISOString(),
      especialidad, especialista, motivo, diagnostico, prioridad: input.prioridad,
      archivoIds, incluirOdontograma: input.incluirOdontograma === true,
      incluirEvoluciones: input.incluirEvoluciones === true, emisor: input.emisor?.trim(),
    }
    const guardada = await timelineService.agregarEvento(pacienteId, {
      id: derivacion.id,
      tipo: 'derivacion', fecha: derivacion.fecha,
      titulo: `Derivación a ${especialidad}`,
      detalles: motivo,
      profesional: derivacion.emisor,
      metadata: { especialidad, especialista, motivo, diagnostico, prioridad: input.prioridad,
        archivoIds, incluirOdontograma: derivacion.incluirOdontograma,
        incluirEvoluciones: derivacion.incluirEvoluciones },
    })
    if (!guardada) throw new Error('No se pudo guardar la derivación clínica. Revisa la conexión y vuelve a intentar.')
    return derivacion
  },
}
