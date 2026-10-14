/**
 * useSupabaseRealtime — Hook que subscribe a Supabase Realtime para badges y estado del sistema.
 * Blueprint 02 §05 y §09: Actualiza useSidebarStore en tiempo real.
 */
import { useEffect } from 'react'
import { supabase, USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { useSidebarStore } from '../../app/stores/useSidebarStore'
import { useSesionStore } from '../../app/stores/sesionStore'
import { createLogger } from '../../infrastructure/logging/logger'

const log = createLogger('useSupabaseRealtime')

export const useSupabaseRealtime = (): void => {
  const updateBadge = useSidebarStore((s) => s.updateBadge)
  const setActiveDevices = useSidebarStore((s) => s.setActiveDevices)
  const setConnectivityStatus = useSidebarStore((s) => s.setConnectivityStatus)
  const setLastSyncAt = useSidebarStore((s) => s.setLastSyncAt)
  const userProfile = useSesionStore((s) => s.userProfile)
  const clinicaActual = useSesionStore((s) => s.clinicaActual)
  const user = (useSesionStore.getState() as unknown as { user?: { id?: string; app_metadata?: { clinic_id?: string } } })?.user
  const clinicId = user?.app_metadata?.clinic_id || (userProfile?.clinicaId as string | undefined) || clinicaActual

  // Detectar estado inicial al montar
  useEffect(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    const initialStatus = isOnline ? 'connected' : 'pending'
    setConnectivityStatus(initialStatus)
    if (isOnline) {
      setLastSyncAt(Date.now())
    }
    log.info(`Estado inicial: ${initialStatus}`)
  }, [setConnectivityStatus, setLastSyncAt])

  // Monitorear conectividad del navegador (CRÍTICO)
  useEffect(() => {
    const handleOnline = (): void => {
      log.info('🟢 Conectado')
      setConnectivityStatus('connected')
      setLastSyncAt(Date.now())
    }

    const handleOffline = (): void => {
      log.warn('🟡 Sin conexión')
      setConnectivityStatus('pending')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setConnectivityStatus, setLastSyncAt])

  // Supabase Realtime (solo si hay conexión y credenciales)
  useEffect(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    if (!USE_SUPABASE || !supabase || !clinicId || !isOnline) {
      return
    }

    log.info(`Conectando a Supabase Realtime para clínica ${clinicId}`)

    // Badges
    const badgesChannel = supabase
      .channel(`badges_${clinicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificaciones_modulo',
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          log.info('Badge actualizado:', payload)
          if (payload.new && typeof payload.new.modulo === 'string' && typeof payload.new.cantidad === 'number') {
            updateBadge(payload.new.modulo, payload.new.cantidad)
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          log.info('✅ Subscrito a badges')
          setLastSyncAt(Date.now())
        } else if (status === 'CHANNEL_ERROR') {
          log.error('❌ Error en canal de badges')
          setConnectivityStatus('error')
        }
      })

    // Sesiones activas
    let sesionesChannel: ReturnType<typeof supabase.channel> | null = null
    if (user?.id) {
      sesionesChannel = supabase
        .channel(`sesiones_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sesiones_activas',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            try {
              if (!supabase) return
              const { count } = await supabase
                .from('sesiones_activas')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('activa', true)
              setActiveDevices(count || 1)
            } catch (err) {
              log.warn('Error al consultar sesiones activas:', err)
            }
          }
        )
        .subscribe()
    }

    return () => {
      try {
        badgesChannel.unsubscribe()
        if (sesionesChannel) sesionesChannel.unsubscribe()
      } catch (err) {
        log.warn('Error al desuscribir canales realtime:', err)
      }
    }
  }, [clinicId, user?.id, updateBadge, setActiveDevices, setConnectivityStatus, setLastSyncAt])
}
