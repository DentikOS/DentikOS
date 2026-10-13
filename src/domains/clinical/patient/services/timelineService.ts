import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

export interface EventoTimeline {
  id?: string
  tipo: 'cita' | 'evolucion' | 'receta' | 'consentimiento' | 'cambio_estado' | 'pago' | 'adjunto' | 'presupuesto' | 'llamada' | 'email' | 'admin' | string
  fecha: string
  titulo: string
  detalles?: string
  usuario?: string
  profesional?: string
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
        await supabase
          .from('timeline_paciente')
          .insert({
            id,
            paciente_id: pacienteId,
            tipo: evento.tipo,
            fecha: evento.fecha,
            titulo: evento.titulo,
            detalles: evento.detalles || null,
            usuario: evento.usuario || null,
            profesional: evento.profesional || null,
          })
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

    return [
      ...unicos,
      {
        id: `tl-1-${pacienteId}`,
        fecha: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        tipo: 'evolucion',
        titulo: 'Evolución Clínica — Control post operatorio',
        profesional: 'Dr. Roberto Gómez',
        detalles: 'Tejidos en franca cicatrización, asintomático.',
      },
      {
        id: `tl-2-${pacienteId}`,
        fecha: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        tipo: 'pago',
        titulo: 'Abono Recibido — Plan de Rehabilitación',
        profesional: 'Recepción Central',
        detalles: 'Pago confirmado $45.000 vía transferencia bancaria.',
      },
      {
        id: `tl-3-${pacienteId}`,
        fecha: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        tipo: 'consentimiento',
        titulo: 'Consentimiento Firmado — Endodoncia Molar',
        profesional: 'Dr. Roberto Gómez',
        detalles: 'Documento digital firmado con verificación forense SHA-256.',
      },
    ]
  },
}
