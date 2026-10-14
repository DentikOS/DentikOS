/**
 * useDashboardRealtime — Hook para suscribir widgets del Dashboard a Supabase Realtime
 *
 * Blueprint 04 §03: "Actualización: Tiempo real (Supabase Realtime)"
 *
 * Suscribe a cambios en las tablas principales y dispara eventos
 * para que los widgets se actualicen automáticamente.
 */
import { useEffect } from 'react'
import { supabase, USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../app/stores/sesionStore'
import { createLogger } from '../../infrastructure/logging/logger'

const log = createLogger('useDashboardRealtime')

export const useDashboardRealtime = (): void => {
  const userProfile = useSesionStore((s) => s.userProfile)
  const clinicaActual = useSesionStore((s) => s.clinicaActual)
  const clinicaId = clinicaActual || (userProfile as { clinicaId?: string } | null)?.clinicaId

  useEffect(() => {
    if (!USE_SUPABASE || !supabase || !clinicaId) {
      log.warn('Supabase Realtime no disponible o sin clinicaId')
      return
    }

    log.info('🔌 Suscribiendo Dashboard a Supabase Realtime')

    // Canal único para el Dashboard
    const channel = supabase
      .channel(`dashboard-realtime-${clinicaId}`)
      // Widget 1: Agenda del día
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'citas', filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          log.info('📅 Cambio en citas:', payload)
          window.dispatchEvent(new CustomEvent('dashboard:agenda:changed', { detail: payload }))
        }
      )
      // Widget 2: Pacientes recientes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pacientes', filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          log.info('👥 Cambio en pacientes:', payload)
          window.dispatchEvent(new CustomEvent('dashboard:pacientes:changed', { detail: payload }))
        }
      )
      // Widget 3: Alertas clínicas (cambios en alergias/contraindicaciones)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pacientes', filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          const newRecord = payload.new as { alergias?: string; contraindicaciones?: string }
          if (newRecord?.alergias || newRecord?.contraindicaciones) {
            log.info('⚠️ Cambio en alertas clínicas:', payload)
            window.dispatchEvent(new CustomEvent('dashboard:alertas:changed', { detail: payload }))
          }
        }
      )
      // Widget 5: Esterilización
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cargas_esterilizacion', filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          log.info('🔬 Cambio en esterilización:', payload)
          window.dispatchEvent(new CustomEvent('dashboard:esterilizacion:changed', { detail: payload }))
        }
      )
      // Widget 6: Inventario crítico
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario', filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          log.info('📦 Cambio en inventario:', payload)
          window.dispatchEvent(new CustomEvent('dashboard:inventario:changed', { detail: payload }))
        }
      )
      // Widget 7: Pagos pendientes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pagos', filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          log.info('💰 Cambio en pagos:', payload)
          window.dispatchEvent(new CustomEvent('dashboard:pagos:changed', { detail: payload }))
        }
      )
      // Widget 8: Comunicaciones
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes', filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          log.info('💬 Cambio en comunicaciones:', payload)
          window.dispatchEvent(new CustomEvent('dashboard:comunicaciones:changed', { detail: payload }))
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          log.info('✅ Dashboard suscrito a Realtime')
        } else if (status === 'CHANNEL_ERROR') {
          log.error('❌ Error al suscribir Dashboard a Realtime')
        }
      })

    // Cleanup al desmontar
    return () => {
      log.info('🔌 Desuscribiendo Dashboard de Realtime')
      supabase?.removeChannel(channel)
    }
  }, [clinicaId])
}
