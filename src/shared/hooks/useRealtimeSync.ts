/**
 * Hook central de sincronización en tiempo real (F5-02).
 * Suscribe a tablas críticas de Supabase y refresca stores/emite eventos.
 * Montar UNA sola vez en App.jsx.
 */
import { useEffect } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { usePacientesStore } from '../../app/stores/pacientesStore'
import { usePrestacionesStore } from '../../app/stores/prestacionesStore'
import { useSesionStore } from '../../app/stores/sesionStore'
import { USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { notificationService } from '../../infrastructure/notification/notificationService'
import { TABLAS_REALTIME } from '../../infrastructure/realtime/realtimeEvents'
import { useSincronizacionInicial } from './useSincronizacionInicial'
import { createLogger } from '../../infrastructure/logging/logger'

const log = createLogger('useRealtimeSync')

/** Ventana (ms) para ignorar eventos de escritura local reciente (anti-loops). */
const TOLERANCIA_LOOP_MS = 2000

/** Timestamp de última escritura local por tabla (shared entre instancias). */
const ultimaEscrituraLocal: Record<string, number> = {}

/** Registra una escritura local. Llamar desde storage services al escribir. */
export const registrarEscrituraLocal = (tabla: string): void => {
  ultimaEscrituraLocal[tabla] = Date.now()
}

/** Verifica si un evento fue causado por nuestra propia escritura reciente. */
const esEventoLocal = (tabla: string): boolean => {
  const timestamp = ultimaEscrituraLocal[tabla]
  if (!timestamp) return false
  const ahora = Date.now()
  return (ahora - timestamp) < TOLERANCIA_LOOP_MS
}

interface RealtimePayload {
  eventType?: string
  [key: string]: unknown
}

/** Hook de sincronización en tiempo real. */
export const useRealtimeSync = (): void => {
  const userProfile = useSesionStore((state: { userProfile?: unknown }) => state.userProfile)
  const refrescarPacientes = usePacientesStore((state: { refrescarDesdeSupabase: () => void }) => state.refrescarDesdeSupabase)
  const enabled = !!userProfile && USE_SUPABASE

  const crearHandler = (tabla: string) => (payload: RealtimePayload): void => {
    if (esEventoLocal(tabla)) {
      log.info(`Ignorando evento local en ${tabla}`)
      return
    }

    log.info(`Cambio en ${tabla}:`, payload.eventType)

    if (tabla === 'pacientes') {
      refrescarPacientes()
      notificationService.info(
        `Otro usuario modificó datos de pacientes`,
        { titulo: 'Actualización en tiempo real', duracion: 3000 }
      )
      return
    }
    if (tabla === 'prestaciones') {
      void usePrestacionesStore.getState().sincronizarDesdeSupabase()
      return
    }

    const evento = (TABLAS_REALTIME as Record<string, string>)[tabla]
    if (evento) {
      window.dispatchEvent(new CustomEvent(evento, { detail: payload }))
    }
  }

  // Suscripciones a cada tabla crítica (explícitas por reglas de hooks)
  useRealtimeSubscription('pacientes', crearHandler('pacientes'), { enabled })
  useRealtimeSubscription('prestaciones', crearHandler('prestaciones'), { enabled })
  useRealtimeSubscription('citas', crearHandler('citas'), { enabled })
  useRealtimeSubscription('presupuestos', crearHandler('presupuestos'), { enabled })
  useRealtimeSubscription('presupuesto_items', crearHandler('presupuesto_items'), { enabled })
  useRealtimeSubscription('pagos', crearHandler('pagos'), { enabled })
  useRealtimeSubscription('movimientos_financieros', crearHandler('movimientos_financieros'), { enabled })
  useRealtimeSubscription('evoluciones_clinicas', crearHandler('evoluciones_clinicas'), { enabled })
  useRealtimeSubscription('recetas', crearHandler('recetas'), { enabled })
  useRealtimeSubscription('odontogramas', crearHandler('odontogramas'), { enabled })
  useRealtimeSubscription('periodontogramas', crearHandler('periodontogramas'), { enabled })
  useRealtimeSubscription('inventario', crearHandler('inventario'), { enabled })

  useSincronizacionInicial(enabled)

  useEffect(() => {
    if (enabled) {
      log.info('Sincronización en tiempo real activada')
    }
  }, [enabled])
}
