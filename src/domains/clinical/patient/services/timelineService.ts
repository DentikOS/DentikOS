import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { tenantCache } from '../../../../infrastructure/tenant/tenantCache'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'

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

const claveTimeline = (pacienteId: string | number): string => `timeline_${pacienteId}`

export const timelineService = {
  agregarEvento: async (pacienteId: string | number, evento: EventoTimeline): Promise<boolean> => {
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId || !esUuidValido(clinicaId) || !esUuidValido(pacienteId)) return false
    const id = evento.id || crypto.randomUUID()
    if (!USE_SUPABASE || !supabase) return false
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { error } = await supabase.from('timeline_paciente').insert({
        ...(esUuidValido(id) ? { id } : {}),
        clinica_id: clinicaId,
        actor_user_id: user.id,
        paciente_id: String(pacienteId),
        tipo: evento.tipo,
        fecha: evento.fecha,
        titulo: evento.titulo,
        detalles: evento.detalles || null,
        usuario: evento.usuario || null,
        profesional: evento.profesional || null,
        metadata: evento.metadata || null,
      })
      if (error) return false
      const anteriores = timelineService.obtenerTimeline(pacienteId)
      tenantCache.escribirTenant(claveTimeline(pacienteId), [{ ...evento, id }, ...anteriores])
      return true
    } catch {
      return false
    }
  },

  obtenerTimeline: (pacienteId: string | number): EventoTimeline[] => {
    if (!getClinicaActivaSync()) return []
    const locales = tenantCache.leerTenant<EventoTimeline[]>(claveTimeline(pacienteId), [])
    const combinados = Array.isArray(locales) ? locales : []
    const vistos = new Set<string>()
    const unicos = combinados.filter((e) => {
      const id = String(e.id)
      if (vistos.has(id)) return false
      vistos.add(id)
      return true
    })

    return unicos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  },

  cargarTimeline: async (pacienteId: string | number): Promise<EventoTimeline[]> => {
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId || !esUuidValido(clinicaId) || !esUuidValido(pacienteId) || !USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('timeline_paciente')
      .select('id,tipo,fecha,titulo,detalles,usuario,profesional,metadata,clinica_id,paciente_id')
      .eq('clinica_id', clinicaId)
      .eq('paciente_id', String(pacienteId))
      .order('fecha', { ascending: false })
    if (error || !Array.isArray(data)) return timelineService.obtenerTimeline(pacienteId)
    const eventos = data.filter((row) => row.clinica_id === clinicaId && row.paciente_id === String(pacienteId))
      .map(({ clinica_id: _clinicaId, paciente_id: _pacienteId, ...row }) => row as EventoTimeline)
    tenantCache.escribirTenant(claveTimeline(pacienteId), eventos)
    return eventos
  },
}
