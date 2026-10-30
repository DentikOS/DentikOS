/**
 * Servicio de Persistencia para Fichas Clínicas (BP06/BP07).
 *
 * Persiste los módulos clínicos en Supabase (tabla `fichas_clinicas`) con:
 * - Aislamiento multi-clínica mediante RLS y clinica_id
 * - Caché local tenant-aware para soporte offline
 * - Suscripción a Supabase Realtime para cambios colaborativos
 */
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { tenantCache } from '../../../../infrastructure/tenant/tenantCache'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('fichasClinicasStorageService')

export interface FichaClinicaRecord {
  id?: string
  paciente_id: string
  clinica_id: string
  odontograma: unknown
  periodontograma: unknown
  evoluciones: unknown[]
  recetas: unknown[]
  consentimientos: unknown[]
  plan_tratamiento: unknown
  adjuntos?: unknown[]
  timeline: unknown[]
  version?: number
  updated_at?: string
}

const FICHA_VACIA: Omit<FichaClinicaRecord, 'paciente_id' | 'clinica_id'> = {
  odontograma: { piezas: [] },
  periodontograma: [],
  evoluciones: [],
  recetas: [],
  consentimientos: [],
  plan_tratamiento: {},
  adjuntos: [],
  timeline: [],
  version: 1,
}

export const fichasClinicasStorageService = {
  /**
   * Obtiene la ficha clínica del paciente desde Supabase con fallback a caché local.
   */
  async obtenerFichaClinica(pacienteId: string): Promise<FichaClinicaRecord | null> {
    if (!pacienteId) return null
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId) return null
    const cacheKey = `ficha_clinica_${pacienteId}`

    if (USE_SUPABASE && supabase && esUuidValido(pacienteId)) {
      try {
        const { data, error } = await supabase
          .from('fichas_clinicas')
          .select('*')
          .eq('paciente_id', pacienteId)
          .eq('clinica_id', clinicaId)
          .maybeSingle()

        if (!error && data?.clinica_id === clinicaId && data?.paciente_id === pacienteId) {
          try {
            tenantCache.escribirTenant(cacheKey, data)
          } catch {
            // Contexto sin tenant cache activo en test
          }
          return data as FichaClinicaRecord
        }
      } catch (err) {
        log.warn('Error leyendo ficha desde Supabase, recurriendo a cache:', err)
      }
    }

    try {
      const cached = tenantCache.leerTenant<FichaClinicaRecord>(cacheKey, null as unknown as FichaClinicaRecord)
      if (cached?.clinica_id === clinicaId && cached?.paciente_id === pacienteId) return cached
    } catch {
      // Sin tenant cache
    }

    return {
      paciente_id: pacienteId,
      clinica_id: clinicaId,
      ...FICHA_VACIA,
    }
  },

  /**
   * Actualiza una sección específica de la ficha clínica (odontograma, recetas, etc.)
   */
  async guardarSeccionFicha(
    pacienteId: string,
    seccion: keyof Omit<FichaClinicaRecord, 'id' | 'paciente_id' | 'clinica_id' | 'created_at' | 'updated_at'>,
    datos: unknown
  ): Promise<boolean> {
    if (!pacienteId) return false
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId) return false
    const cacheKey = `ficha_clinica_${pacienteId}`
    const current = tenantCache.leerTenant<FichaClinicaRecord | null>(cacheKey, null)
    if (current && (current.clinica_id !== clinicaId || current.paciente_id !== pacienteId)) return false
    const updatedAt = new Date().toISOString()

    // Persistir en Supabase
    if (USE_SUPABASE && supabase) {
      if (!esUuidValido(pacienteId) || !esUuidValido(clinicaId)) return false
      try {
        const { error } = await supabase
          .from('fichas_clinicas')
          .upsert(
            {
              paciente_id: pacienteId,
              clinica_id: clinicaId,
              [seccion]: datos,
              updated_at: updatedAt,
            },
            { onConflict: 'clinica_id,paciente_id' }
          )

        if (error) {
          log.error(`Error guardando ${String(seccion)} en Supabase:`, error.message)
          return false
        }
        tenantCache.escribirTenant(cacheKey, {
          ...(current || { paciente_id: pacienteId, clinica_id: clinicaId, ...FICHA_VACIA }),
          [seccion]: datos,
          updated_at: updatedAt,
        })
        return true
      } catch (err) {
        log.error(`Excepción guardando ${String(seccion)} en Supabase:`, err)
        return false
      }
    }

    return tenantCache.escribirTenant(cacheKey, {
      ...(current || { paciente_id: pacienteId, clinica_id: clinicaId, ...FICHA_VACIA }),
      [seccion]: datos,
      updated_at: updatedAt,
    })
  },

  /**
   * Suscribe a cambios en tiempo real de la ficha clínica del paciente.
   */
  suscribirFichaRealtime(
    pacienteId: string,
    callback: (cambio: Partial<FichaClinicaRecord>) => void
  ): () => void {
    if (!USE_SUPABASE || !supabase || !esUuidValido(pacienteId)) {
      return () => {}
    }

    const channelName = `realtime_ficha_${pacienteId}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fichas_clinicas',
          filter: `paciente_id=eq.${pacienteId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as Partial<FichaClinicaRecord>)
          }
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  },
}
