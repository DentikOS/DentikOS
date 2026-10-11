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
  timeline: [],
  version: 1,
}

export const fichasClinicasStorageService = {
  /**
   * Obtiene la ficha clínica del paciente desde Supabase con fallback a caché local.
   */
  async obtenerFichaClinica(pacienteId: string): Promise<FichaClinicaRecord | null> {
    if (!pacienteId) return null
    const cacheKey = `ficha_clinica_${pacienteId}`

    if (USE_SUPABASE && supabase && esUuidValido(pacienteId)) {
      try {
        const { data, error } = await supabase
          .from('fichas_clinicas')
          .select('*')
          .eq('paciente_id', pacienteId)
          .maybeSingle()

        if (!error && data) {
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
      if (cached) return cached
    } catch {
      // Sin tenant cache
    }

    const clinicaId = getClinicaActivaSync() || 'clinica-default'
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
    const cacheKey = `ficha_clinica_${pacienteId}`
    const clinicaId = getClinicaActivaSync() || 'clinica-default'

    // Actualizar cache local
    try {
      const current = tenantCache.leerTenant<FichaClinicaRecord>(cacheKey, {
        paciente_id: pacienteId,
        clinica_id: clinicaId,
        ...FICHA_VACIA,
      } as FichaClinicaRecord)

      const updated = {
        ...current,
        [seccion]: datos,
        updated_at: new Date().toISOString(),
      }
      tenantCache.escribirTenant(cacheKey, updated)
    } catch {
      // Ignorar si tenantCache no tiene contexto
    }

    // Persistir en Supabase
    if (USE_SUPABASE && supabase && esUuidValido(pacienteId) && esUuidValido(clinicaId)) {
      try {
        const { error } = await supabase
          .from('fichas_clinicas')
          .upsert(
            {
              paciente_id: pacienteId,
              clinica_id: clinicaId,
              [seccion]: datos,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'clinica_id,paciente_id' }
          )

        if (error) {
          log.error(`Error guardando ${String(seccion)} en Supabase:`, error.message)
          return false
        }
        return true
      } catch (err) {
        log.error(`Excepción guardando ${String(seccion)} en Supabase:`, err)
        return false
      }
    }

    return true
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
