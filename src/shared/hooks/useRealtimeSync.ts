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
import { REALTIME_EVENTS, TABLAS_REALTIME } from '../../infrastructure/realtime/realtimeEvents'
import { useSincronizacionInicial } from './useSincronizacionInicial'
import { createLogger } from '../../infrastructure/logging/logger'
import { vademecumService } from '../../infrastructure/clinical-data/vademecumService'

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
    if (evento === REALTIME_EVENTS.VADEMECUM_CHANGED) {
      void vademecumService.sincronizarDesdeSupabase()
      return
    }
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
  useRealtimeSubscription('inventario_proveedores', crearHandler('inventario_proveedores'), { enabled })
  useRealtimeSubscription('inventario_ubicaciones', crearHandler('inventario_ubicaciones'), { enabled })
  useRealtimeSubscription('inventario_lotes', crearHandler('inventario_lotes'), { enabled })
  useRealtimeSubscription('inventario_stock_por_ubicacion', crearHandler('inventario_stock_por_ubicacion'), { enabled })
  useRealtimeSubscription('inventario_movimientos', crearHandler('inventario_movimientos'), { enabled })
  useRealtimeSubscription('inventario_ordenes_compra', crearHandler('inventario_ordenes_compra'), { enabled })
  useRealtimeSubscription('inventario_orden_compra_items', crearHandler('inventario_orden_compra_items'), { enabled })
  useRealtimeSubscription('inventario_kits', crearHandler('inventario_kits'), { enabled })
  useRealtimeSubscription('inventario_kit_items', crearHandler('inventario_kit_items'), { enabled })
  useRealtimeSubscription('inventario_ventas', crearHandler('inventario_ventas'), { enabled })
  useRealtimeSubscription('inventario_venta_items', crearHandler('inventario_venta_items'), { enabled })
  useRealtimeSubscription('inventario_mantenciones', crearHandler('inventario_mantenciones'), { enabled })
  useRealtimeSubscription('inventario_permisos_aditivos', crearHandler('inventario_permisos_aditivos'), { enabled })
  useRealtimeSubscription('esterilizacion_programas', crearHandler('esterilizacion_programas'), { enabled })
  useRealtimeSubscription('esterilizacion_insumos_config', crearHandler('esterilizacion_insumos_config'), { enabled })
  useRealtimeSubscription('esterilizacion_ciclos', crearHandler('esterilizacion_ciclos'), { enabled })
  useRealtimeSubscription('esterilizacion_ciclo_instrumentos', crearHandler('esterilizacion_ciclo_instrumentos'), { enabled })
  useRealtimeSubscription('esterilizacion_pasos', crearHandler('esterilizacion_pasos'), { enabled })
  useRealtimeSubscription('esterilizacion_pruebas', crearHandler('esterilizacion_pruebas'), { enabled })
  useRealtimeSubscription('esterilizacion_usos', crearHandler('esterilizacion_usos'), { enabled })
  useRealtimeSubscription('esterilizacion_eventos', crearHandler('esterilizacion_eventos'), { enabled })
  useRealtimeSubscription('laboratorios', crearHandler('laboratorios'), { enabled })
  useRealtimeSubscription('laboratorio_tipos_trabajo', crearHandler('laboratorio_tipos_trabajo'), { enabled })
  useRealtimeSubscription('laboratorio_precios', crearHandler('laboratorio_precios'), { enabled })
  useRealtimeSubscription('plantillas_laboratorio', crearHandler('plantillas_laboratorio'), { enabled })
  useRealtimeSubscription('ordenes_laboratorio', crearHandler('ordenes_laboratorio'), { enabled })
  useRealtimeSubscription('historial_etapas_laboratorio', crearHandler('historial_etapas_laboratorio'), { enabled })
  useRealtimeSubscription('garantias_laboratorio', crearHandler('garantias_laboratorio'), { enabled })
  useRealtimeSubscription('permisos_laboratorio_aditivos', crearHandler('permisos_laboratorio_aditivos'), { enabled })
  useRealtimeSubscription('ordenes_laboratorio_costos', crearHandler('ordenes_laboratorio_costos'), { enabled })
  useRealtimeSubscription('laboratorio_pagos', crearHandler('laboratorio_pagos'), { enabled })
  useRealtimeSubscription('archivos_clinicos', crearHandler('archivos_clinicos'), { enabled })
  useRealtimeSubscription('garantias_laboratorio_historial', crearHandler('garantias_laboratorio_historial'), { enabled })
  useRealtimeSubscription('configuracion_alertas_laboratorio', crearHandler('configuracion_alertas_laboratorio'), { enabled })
  useRealtimeSubscription('alertas_laboratorio_estado', crearHandler('alertas_laboratorio_estado'), { enabled })
  useRealtimeSubscription('vademecum', crearHandler('vademecum'), { enabled })
  useRealtimeSubscription('vademecum_urgencia', crearHandler('vademecum_urgencia'), { enabled })
  useRealtimeSubscription('vademecum_antirresortivos', crearHandler('vademecum_antirresortivos'), { enabled })
  useRealtimeSubscription('alergias_cruzadas', crearHandler('alergias_cruzadas'), { enabled })
  useRealtimeSubscription('interacciones_farmacologicas', crearHandler('interacciones_farmacologicas'), { enabled })
  useRealtimeSubscription('profilaxis_endocarditis', crearHandler('profilaxis_endocarditis'), { enabled })
  useRealtimeSubscription('manejo_anticoagulantes', crearHandler('manejo_anticoagulantes'), { enabled })
  useRealtimeSubscription('reference_data_meta', crearHandler('reference_data_meta'), { enabled })

  useSincronizacionInicial(enabled)

  useEffect(() => {
    if (enabled) {
      log.info('Sincronización en tiempo real activada')
    }
  }, [enabled])
}
