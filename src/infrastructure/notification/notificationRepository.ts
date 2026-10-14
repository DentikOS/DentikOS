/**
 * notificationRepository — Persistencia de notificaciones en Supabase
 * 
 * API para crear, marcar leídas y eliminar notificaciones.
 * Las notificaciones se sincronizan en tiempo real vía Realtime.
 */
import { supabase, USE_SUPABASE } from '../supabase/supabaseClient'
import { createLogger } from '../logging/logger'

const log = createLogger('notificationRepository')

export type NotificationSeverity = 'critical' | 'operational' | 'informational'

export interface CreateNotificationParams {
  userId: string
  clinicId: string
  severity: NotificationSeverity
  title: string
  message?: string
  actionLabel?: string
  actionUrl?: string
  actionPayload?: Record<string, unknown>
  expiresInHours?: number | null
}

export const notificationRepository = {
  /**
   * Crear notificación persistente en Supabase.
   * Realtime propagará automáticamente a todos los dispositivos del usuario.
   */
  async crear(params: CreateNotificationParams): Promise<string | null> {
    if (!USE_SUPABASE || !supabase) {
      log.warn('Supabase no disponible, notificación no persistida')
      return null
    }

    try {
      const { data, error } = await supabase.rpc('crear_notificacion', {
        p_user_id: params.userId,
        p_clinic_id: params.clinicId,
        p_severity: params.severity,
        p_title: params.title,
        p_message: params.message || null,
        p_action_label: params.actionLabel || null,
        p_action_url: params.actionUrl || null,
        p_action_payload: params.actionPayload || null,
        p_expires_in_hours: params.expiresInHours || null,
      })

      if (error) throw error

      log.info(`Notificación creada: ${data} (${params.severity})`)
      return data as string
    } catch (error) {
      log.error('Error creando notificación:', error)
      return null
    }
  },

  /**
   * Marcar notificación como leída.
   */
  async marcarLeida(notifId: string): Promise<boolean> {
    if (!USE_SUPABASE || !supabase) return false

    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ read: true })
        .eq('id', notifId)

      if (error) throw error
      return true
    } catch (error) {
      log.error('Error marcando leída:', error)
      return false
    }
  },

  /**
   * Marcar todas como leídas (excepto críticas).
   * Blueprint 03 §05: Críticas requieren click individual por seguridad.
   */
  async marcarTodasLeidas(userId: string): Promise<number> {
    if (!USE_SUPABASE || !supabase) return 0

    try {
      const { data, error } = await supabase
        .from('notificaciones')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)
        .neq('severity', 'critical')
        .select('id')

      if (error) throw error
      return data?.length || 0
    } catch (error) {
      log.error('Error marcando todas:', error)
      return 0
    }
  },

  /**
   * Eliminar notificación (descartar).
   */
  async eliminar(notifId: string): Promise<boolean> {
    if (!USE_SUPABASE || !supabase) return false

    try {
      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .eq('id', notifId)

      if (error) throw error
      return true
    } catch (error) {
      log.error('Error eliminando:', error)
      return false
    }
  },

  /**
   * Purgar notificaciones antiguas manualmente.
   * Normalmente corre automáticamente vía pg_cron a las 2 AM.
   */
  async purgarAntiguas(): Promise<number> {
    if (!USE_SUPABASE || !supabase) return 0

    try {
      const { data, error } = await supabase.rpc('purgar_notificaciones_antiguas')
      if (error) throw error
      log.info(`Purga manual: ${data} notificaciones eliminadas`)
      return (data as number) || 0
    } catch (error) {
      log.error('Error en purga manual:', error)
      return 0
    }
  },
}
