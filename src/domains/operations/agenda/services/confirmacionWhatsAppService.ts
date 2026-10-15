import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { leerJSON, escribirJSON } from '../../../../infrastructure/storage/localStorageRepository'
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'

const log = createLogger('confirmacionWhatsAppService')
const HISTORIAL_LOCAL_KEY = 'dentikos_confirmaciones_historial_v1'

export type TipoConfirmacion = 
  | 'whatsapp_enviado'
  | 'whatsapp_respondido'
  | 'telefono'
  | 'presencial'
  | 'cancelacion_paciente'

export interface RegistroConfirmacion {
  id: string
  appointmentId: string | number
  clinicaId: string
  tipo: TipoConfirmacion
  canal?: string
  mensajeEnviado?: string
  respuestaPaciente?: string
  motivoCancelacion?: string
  registradoPorId?: string
  registradoPorNombre?: string
  rolUsuario?: string
  createdAt: string
  metadata?: Record<string, unknown>
}

/**
 * Plantilla oficial de WhatsApp (BP05 §04 - Brand Manual §9.1)
 */
export const PLANTILLA_WHATSAPP_OFICIAL = (data: {
  nombrePaciente: string
  fecha: string
  hora: string
  profesional: string
  clinica: string
}): string => {
  return `Estimado(a) ${data.nombrePaciente}:

Le recordamos su atención odontológica programada para mañana ${data.fecha} a las ${data.hora} con el/la ${data.profesional} en ${data.clinica}.

Para coordinar su box clínico, por favor responda:
1 para Confirmar asistencia
2 para Solicitar reagendamiento

DentikOS Clinical Gateway • Notificación Asistencial Oficial`
}

export const confirmacionWhatsAppService = {
  /**
   * Registra un intento de confirmación (WhatsApp, teléfono, presencial, cancelación)
   */
  registrarConfirmacion: async (data: {
    appointmentId: string | number
    tipo: TipoConfirmacion
    mensajeEnviado?: string
    respuestaPaciente?: string
    motivoCancelacion?: string
    metadata?: Record<string, unknown>
  }): Promise<RegistroConfirmacion | null> => {
    const userProfile = useSesionStore.getState().userProfile
    const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
    const userId = (userProfile as { id?: string })?.id || 'local-user'
    const userName = (userProfile as { nombreCompleto?: string })?.nombreCompleto || 'Usuario local'
    const userRol = (userProfile as { rol?: string })?.rol || 'unknown'

    if (!clinicaId) {
      log.warn('Sin clinicaId, no se puede registrar confirmación')
      return null
    }

    const registro: RegistroConfirmacion = {
      id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      appointmentId: data.appointmentId,
      clinicaId,
      tipo: data.tipo,
      canal: data.tipo.startsWith('whatsapp') ? 'whatsapp' : data.tipo === 'telefono' ? 'telefono' : data.tipo === 'presencial' ? 'presencial' : 'cancelacion',
      mensajeEnviado: data.mensajeEnviado,
      respuestaPaciente: data.respuestaPaciente,
      motivoCancelacion: data.motivoCancelacion,
      registradoPorId: userId,
      registradoPorNombre: userName,
      rolUsuario: userRol,
      createdAt: new Date().toISOString(),
      metadata: data.metadata || {},
    }

    // Guardar en Supabase si está disponible
    if (USE_SUPABASE && supabase) {
      const idRemoto = esUuidValido(String(data.appointmentId))
        ? String(data.appointmentId)
        : migrationStorageService.obtenerSupabaseId(String(data.appointmentId))

      if (!idRemoto) {
        log.warn('Confirmación no persistida: cita sin UUID remoto todavía', { appointmentId: data.appointmentId })
      } else {
        try {
          const { error } = await supabase
            .from('appointment_confirmations')
            .insert({
              appointment_id: idRemoto,
              clinica_id: clinicaId,
              tipo: data.tipo,
              canal: registro.canal,
              mensaje_enviado: data.mensajeEnviado,
              respuesta_paciente: data.respuestaPaciente,
              motivo_cancelacion: data.motivoCancelacion,
              registrado_por: esUuidValido(userId) ? userId : null,
              registrado_por_nombre: userName,
              rol_usuario: userRol,
              metadata: data.metadata || {},
            })

          if (error) {
            log.error('Error guardando confirmación en Supabase:', error)
          } else {
            log.info('Confirmación registrada en Supabase:', registro.id)
          }
        } catch (e) {
          log.error('Error inesperado Supabase:', e)
        }
      }
    }

    // Siempre guardar en localStorage como fallback
    try {
      const historial = leerJSON<RegistroConfirmacion[]>(HISTORIAL_LOCAL_KEY, [])
      historial.push(registro)
      escribirJSON(HISTORIAL_LOCAL_KEY, historial)
    } catch (e) {
      log.error('Error guardando confirmación en localStorage:', e)
    }

    return registro
  },

  /**
   * Obtiene historial de confirmaciones de una cita específica
   */
  obtenerHistorialCita: async (appointmentId: string | number): Promise<RegistroConfirmacion[]> => {
    if (!USE_SUPABASE || !supabase) {
      const historial = leerJSON<RegistroConfirmacion[]>(HISTORIAL_LOCAL_KEY, [])
      return historial.filter(r => String(r.appointmentId) === String(appointmentId))
    }

    try {
      const { data, error } = await supabase
        .from('appointment_confirmations')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })

      if (error) {
        log.error('Error obteniendo historial:', error)
        const historial = leerJSON<RegistroConfirmacion[]>(HISTORIAL_LOCAL_KEY, [])
        return historial.filter(r => String(r.appointmentId) === String(appointmentId))
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        appointmentId: row.appointment_id,
        clinicaId: row.clinica_id,
        tipo: row.tipo,
        canal: row.canal,
        mensajeEnviado: row.mensaje_enviado,
        respuestaPaciente: row.respuesta_paciente,
        motivoCancelacion: row.motivo_cancelacion,
        registradoPorId: row.registrado_por,
        registradoPorNombre: row.registrado_por_nombre,
        rolUsuario: row.rol_usuario,
        createdAt: row.created_at,
        metadata: row.metadata || {},
      }))
    } catch (e) {
      log.error('Error inesperado obteniendo historial:', e)
      const historial = leerJSON<RegistroConfirmacion[]>(HISTORIAL_LOCAL_KEY, [])
      return historial.filter(r => String(r.appointmentId) === String(appointmentId))
    }
  },

  /**
   * Obtiene todas las citas sin confirmar de la clínica (para widget Dashboard)
   */
  obtenerCitasSinConfirmar: async (citasHoy: any[]): Promise<any[]> => {
    const userProfile = useSesionStore.getState().userProfile
    const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
    if (!clinicaId) return []

    return (citasHoy || []).filter(c => 
      c.confirmation_status !== 'confirmado' && 
      c.estado !== 'Cancelada' &&
      c.estado !== 'Completada'
    )
  },

  /**
   * Envía mensaje WhatsApp abriendo WhatsApp Web con mensaje precargado
   */
  prepararMensajeWhatsApp: (data: {
    telefono: string
    nombrePaciente: string
    fecha: string
    hora: string
    profesional: string
    clinica: string
  }): string => {
    const mensaje = PLANTILLA_WHATSAPP_OFICIAL(data)
    return `https://wa.me/${data.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
  },
}
