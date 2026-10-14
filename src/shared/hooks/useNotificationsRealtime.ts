/**
 * useNotificationsRealtime — Sincroniza notificaciones con Supabase Realtime
 * Blueprint 03 §05: Sistema de notificaciones persistente
 * 
 * - Carga notificaciones no leídas al iniciar
 * - Suscribe a INSERT en tiempo real
 * - Integra con notificationService existente
 */
import { useEffect, useRef } from 'react'
import { supabase, USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { notificationService } from '../../infrastructure/notification/notificationService'
import { useSesionStore } from '../../app/stores/sesionStore'
import { createLogger } from '../../infrastructure/logging/logger'
import { playSound } from '../utils/soundEffects'

const log = createLogger('useNotificationsRealtime')

interface SupabaseNotification {
  id: string
  user_id: string
  clinic_id: string
  severity: 'critical' | 'operational' | 'informational'
  title: string
  message: string | null
  action_label: string | null
  action_url: string | null
  action_payload: Record<string, unknown> | null
  read: boolean
  created_at: string
}

const severityToTipo = (severity: string): 'error' | 'success' | 'warning' | 'info' => {
  switch (severity) {
    case 'critical': return 'error'
    case 'operational': return 'success'
    case 'informational': return 'info'
    default: return 'info'
  }
}

export const useNotificationsRealtime = () => {
  const user = useSesionStore((s: unknown) => (s as { user?: { id?: string } })?.user)
  const userProfile = useSesionStore((s) => s.userProfile)
  const userId = user?.id || (userProfile as unknown as { id?: string })?.id
  const loadedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!USE_SUPABASE || !supabase || !userId) return
    const client = supabase

    // 1. Cargar notificaciones no leídas al iniciar
    const cargarNotificacionesPendientes = async () => {
      try {
        const { data, error } = await client
          .from('notificaciones')
          .select('*')
          .eq('user_id', userId)
          .eq('read', false)
          .eq('dismissed', false)
          .order('created_at', { ascending: false })
          .limit(50) // Máximo 50 notificaciones históricas

        if (error) throw error

        data?.forEach((notif: SupabaseNotification) => {
          if (loadedIdsRef.current.has(notif.id)) return
          loadedIdsRef.current.add(notif.id)

          notificationService.mostrar(notif.message || notif.title, {
            tipo: severityToTipo(notif.severity),
            severity: notif.severity,
            titulo: notif.title,
            duracion: 0,
          })
        })

        log.info(`Cargadas ${data?.length || 0} notificaciones históricas`)
      } catch (error) {
        log.error('Error cargando notificaciones:', error)
      }
    }

    cargarNotificacionesPendientes()

    // 2. Suscripción Realtime a nuevas notificaciones
    const channel = client
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${userId}` },
        (payload) => {
          const notif = payload.new as SupabaseNotification
          if (loadedIdsRef.current.has(notif.id)) return
          loadedIdsRef.current.add(notif.id)

          log.info(`Nueva notificación recibida: ${notif.severity} - ${notif.title}`)

          notificationService.mostrar(notif.message || notif.title, {
            tipo: severityToTipo(notif.severity),
            severity: notif.severity,
            titulo: notif.title,
            duracion: 0,
          })

          try {
            if (notif.severity === 'critical') {
              playSound('criticalNotif') // 220Hz, 180ms
            } else if (notif.severity === 'operational') {
              playSound('infoNotif') // 850Hz, 30ms
            }
          } catch {}
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${userId}` },
        (payload) => {
          const deleted = payload.old as SupabaseNotification
          if (deleted?.id) {
            notificationService.ocultar(deleted.id)
            loadedIdsRef.current.delete(deleted.id)
          }
        }
      )
      .subscribe((status) => {
        log.info(`Canal de notificaciones: ${status}`)
      })

    return () => {
      client.removeChannel(channel)
    }
  }, [userId, userProfile?.clinicaId])
}
