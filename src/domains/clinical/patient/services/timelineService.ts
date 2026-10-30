import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

export interface EventoTimeline {
  id?: string
  tipo: 'cita' | 'evolucion' | 'receta' | 'consentimiento' | 'cambio_estado' | 'pago' | 'adjunto' | 'presupuesto' | 'llamada' | 'email' | 'admin' | string
  fecha: string
  titulo: string
  detalles?: string
  usuario?: string
  profesional?: string
  metadata?: Record<string, unknown>
}

const eventosExtra: Record<string, EventoTimeline[]> = {}

export const timelineService = {
  agregarEvento: async (pacienteId: string | number, evento: EventoTimeline): Promise<void> => {
    const id = evento.id || crypto.randomUUID()
    const eventoCompleto: EventoTimeline = { ...evento, id }
    const key = String(pacienteId)
    eventosExtra[key] = [eventoCompleto, ...(eventosExtra[key] || [])]

    if (typeof localStorage !== 'undefined') {
      try {
        const storageKey = `timeline_${pacienteId}`
        const timeline = JSON.parse(localStorage.getItem(storageKey) || '[]')
        timeline.unshift(eventoCompleto)
        localStorage.setItem(storageKey, JSON.stringify(timeline))
      } catch (err) {
        console.error('Error guardando timeline local:', err)
      }
    }

    if (USE_SUPABASE && supabase) {
      try {
        const esUuid = (val: unknown): boolean =>
          typeof val === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

        if (esUuid(pacienteId)) {
          await supabase
            .from('timeline_paciente')
            .insert({
              ...(esUuid(id) ? { id } : {}),
              paciente_id: pacienteId,
              tipo: evento.tipo,
              fecha: evento.fecha,
              titulo: evento.titulo,
              detalles: evento.detalles || null,
              usuario: evento.usuario || null,
              profesional: evento.profesional || null,
            })
        }
      } catch (err) {
        console.error('Error sincronizando evento de timeline con Supabase:', err)
      }
    }
  },

  obtenerTimeline: (pacienteId: string | number): EventoTimeline[] => {
    const extra = eventosExtra[String(pacienteId)] || []
    let locales: EventoTimeline[] = []
    if (typeof localStorage !== 'undefined') {
      try {
        locales = JSON.parse(localStorage.getItem(`timeline_${pacienteId}`) || '[]')
      } catch {
        locales = []
      }
    }
    const combinados = [...extra, ...locales]
    const vistos = new Set<string>()
    const unicos = combinados.filter((e) => {
      const id = String(e.id)
      if (vistos.has(id)) return false
      vistos.add(id)
      return true
    })

    return unicos
  },
}
