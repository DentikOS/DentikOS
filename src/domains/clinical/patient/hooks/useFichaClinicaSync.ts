/**
 * F6-D-1: Hook de sincronización de datos clínicos desde Supabase.
 *
 * Sincroniza los módulos heredados del paciente (odontograma, perio,
 * evoluciones) desde Supabase al abrir la ficha, y limpia la
 * caché al cerrarla (desmontar el componente).
 *
 * Uso:
 *   const { sincronizando, error } = useFichaClinicaSync(paciente?.id)
 *
 * Coherente con D53 (hook unificado de sincronización) y RFC F4-01
 * (offline-first con fallback a localStorage).
 */
import { useEffect, useState } from 'react'
import {
  sincronizarPaciente,
  limpiarCachePaciente
} from '../../../../infrastructure/supabase/datosClinicosSupabase'
import { procesarColaEvoluciones } from '../services/evolucionesStorageService'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('useFichaClinicaSync')

export interface UseFichaClinicaSyncReturn {
  sincronizando: boolean
  error: string | null
}

/**
 * Sincroniza los datos clínicos de un paciente desde Supabase.
 *
 * @param pacienteId - UUID del paciente en Supabase
 * @returns {UseFichaClinicaSyncReturn}
 */
export const useFichaClinicaSync = (pacienteId?: string | number | null): UseFichaClinicaSyncReturn => {
  const [sincronizando, setSincronizando] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // F6-D-1: no sincronizar si no hay pacienteId (paciente nuevo sin guardar)
    if (!pacienteId) return

    let cancelled = false

    const ejecutarSync = async (): Promise<void> => {
      setSincronizando(true)
      setError(null)
      try {
        // P1-3: Si hay conexión, intentar procesar cola de evoluciones diferidas
        if (typeof navigator === 'undefined' || navigator.onLine) {
          procesarColaEvoluciones?.().catch((e: unknown) => {
            const err = e as Error
            log.warn('Error procesando evoluciones diferidas al montar ficha:', err?.message || String(e))
          })
        }
        await sincronizarPaciente(String(pacienteId))
      } catch (err: unknown) {
        // F6-D-1: si Supabase falla, no romper la ficha — el fallback
        // a localStorage sigue funcionando (RFC F4-01 offline-first)
        log.error('Error sincronizando paciente:', err)
        if (!cancelled) {
          const e = err as Error
          setError(e.message || 'Error desconocido')
        }
      } finally {
        if (!cancelled) setSincronizando(false)
      }
    }

    ejecutarSync()

    // Cleanup: limpiar caché al cerrar la ficha
    return () => {
      cancelled = true
      try {
        limpiarCachePaciente(String(pacienteId))
      } catch (err) {
        log.warn('Error limpiando caché:', err)
      }
    }
  }, [pacienteId])

  return { sincronizando, error }
}
