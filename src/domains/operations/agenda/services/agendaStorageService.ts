/**
 * Persistencia de Citas de Agenda (F4-02c-3 — migración a Supabase).
 *
 * Estrategia de "caché local + sync en background" (alineada con pacientesStorageService):
 *
 *   localStorage (caché rápida, síncrona)
 *          ↕
 *   Caché en memoria (variable de módulo)
 *          ↕ (async, on-demand)
 *   Supabase (fuente de verdad)
 *
 * API pública:
 * - obtenerCitas()              → SÍNCRONO, retorna de caché en memoria
 * - guardarCitas(citas)         → ASYNC, escribe en Supabase + actualiza caché
 * - sincronizarDesdeSupabase()  → ASYNC, refresca caché desde Supabase
 * - resetCache()                → limpia caché (para tests)
 *
 * Modo dual (VITE_USE_SUPABASE):
 * - true: usa Supabase como fuente de verdad, localStorage como caché
 * - false: usa localStorage como fuente de verdad (legacy)
 *
 * Mapeo bidireccional de estados:
 * - El código usa: 'Agendado', 'Confirmado', 'En Sillón', 'Completado', 'Cancelado'
 * - Supabase espera: 'Agendada', 'Confirmada', 'En Curso', 'Completada', 'Cancelada'
 * - Al leer desde Supabase: desnormalizar al formato del código
 * - Al escribir a Supabase: normalizar al formato esperado
 */
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { validarListaCitas, type Cita } from '../schemas/citaSchema'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { createLogger } from '../../../../infrastructure/logging/logger'
import {
  transformarDesdeSupabase,
  transformarParaSupabase
} from './agendaTransformations'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { tenantCache } from '../../../../infrastructure/tenant/tenantCache'
import { normalizarCita } from '../utils/normalizarCita'
import { deduplicarCitas } from '../utils/deduplicarCitas'

const log = createLogger('agendaStorageService')

const STORAGE_KEY_AGENDA = 'studio_dental_agenda_citas_v3'
// F7-36 FASE 1 (Commit 1.5b): migrado a createTenantRepository para aislamiento multi-tenant.
// La clave legacy 'studio_dental_agenda_citas_v3' ahora se almacena como sd_<clinicaId>_studio_dental_agenda_citas_v3.
const citasRepo = createTenantRepository<Cita[]>(STORAGE_KEY_AGENDA, [], { notify: true })

// P0-1: Repositorio aislado por tenant para registrar eliminaciones pendientes explícitas
const STORAGE_KEY_PENDING_DELETES = 'studio_dental_agenda_pending_deletes'
const pendingDeletesRepo = createTenantRepository<string[]>(STORAGE_KEY_PENDING_DELETES, [])

const obtenerPendingDeletes = (): string[] => pendingDeletesRepo.obtener([])
const guardarPendingDeletes = (ids: string[]) => {
  if (!ids || ids.length === 0) {
    return pendingDeletesRepo.eliminar()
  }
  return pendingDeletesRepo.guardar(ids)
}

// Caché en memoria: evita lecturas repetidas de localStorage y permite
// que la API pública permanezca síncrona.
let citasCache: Cita[] | null = null
let cacheInicializado = false

// ═══════════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE CACHÉ
// ═══════════════════════════════════════════════════════════════════

const inicializarCache = (defaults: Cita[]): void => {
  if (cacheInicializado) return
  const datos = citasRepo.obtener(defaults)
  citasCache = Array.isArray(datos) ? datos : defaults
  cacheInicializado = true
}

// ═══════════════════════════════════════════════════════════════════
// OBTENER CITAS (SÍNCRONO)
// ═══════════════════════════════════════════════════════════════════

/**
 * Obtiene la lista de citas desde la caché en memoria.
 * SIEMPRE SÍNCRONO: nunca bloquea la UI.
 */
const obtenerCitas = (defaults: Cita[] = []): Cita[] => {
  if (!cacheInicializado) {
    inicializarCache(defaults)
  }
  const raw = citasCache ?? defaults
  return deduplicarCitas(raw.map((c) => normalizarCita(c)))
}

// ═══════════════════════════════════════════════════════════════════
// SINCRONIZAR DESDE SUPABASE (ASYNC)
// ═══════════════════════════════════════════════════════════════════

interface QueryBuilderLike {
  is?: (col: string, val: unknown) => QueryBuilderLike
  order: (col: string, opts?: { ascending?: boolean }) => {
    order: (col: string, opts?: { ascending?: boolean }) => Promise<{
      data: Record<string, unknown>[] | null
      error: { message: string } | null
    }>
  }
}

/**
 * Refresca la caché de citas desde Supabase.
 * Útil después del login, después de migración, o al recibir eventos Realtime.
 */
const sincronizarDesdeSupabase = async (): Promise<Cita[] | null> => {
  return obtenerCitasDesdeSupabase()
}

// ═══════════════════════════════════════════════════════════════════
// GUARDAR CITAS (ASYNC con actualización de caché síncrona)
// ═══════════════════════════════════════════════════════════════════

const COLUMNAS_DB_CITAS = new Set([
  'id', 'user_id', 'clinica_id', 'paciente_id', 'paciente_nombre',
  'fecha', 'hora_inicio', 'hora_fin', 'estado', 'motivo', 'notas',
  'deleted_at'
])

const sanitizarParaSupabase = (fila: Record<string, unknown>): Record<string, unknown> => {
  const limpio: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fila)) {
    if (COLUMNAS_DB_CITAS.has(k) && v !== undefined) {
      limpio[k] = v
    }
  }
  return limpio
}

/**
 * Guarda la lista completa de citas con logs de depuración (FIX-1).
 */
const guardarCitas = async (citas: unknown): Promise<boolean> => {
  // (F2-04b) — validación Zod antes de persistir
  const validacion = validarListaCitas(citas)
  if (!validacion.valido || !validacion.datos) {
    log.error('Error de validación al guardar citas (F2-04b):', validacion.error)
    return false
  }
  const datos = validacion.datos

  // 1. Actualizar caché en memoria inmediatamente
  citasCache = datos
  cacheInicializado = true

  // 2. Persistir en localStorage como caché
  citasRepo.guardar(datos)

  if (!USE_SUPABASE || !supabase) {
    return true
  }

  // 3. Sincronizar con Supabase en background
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return true
    }

    // Obtener clinicaId de la sesión
    const sesionStore = useSesionStore.getState()
    const clinicaId = (
      sesionStore.clinicaActual ||
      sesionStore.userProfile?.clinicaId ||
      (sesionStore as unknown as Record<string, unknown>).clinicaId ||
      ((sesionStore as unknown as Record<string, unknown>).clinicaActiva as { id?: string } | undefined)?.id ||
      getClinicaActivaSync()
    ) as string | null

    if (!clinicaId) {
      return false
    }

    const aInsertar: Cita[] = []
    const aActualizar: Cita[] = []

    for (const cita of datos) {
      if (esUuidValido(String(cita.id))) {
        aActualizar.push(cita)
      } else {
        aInsertar.push(cita)
      }
    }

    // INSERT
    if (aInsertar.length > 0) {
      const paraInsert = aInsertar.map((c: Cita) => {
        const transformado = transformarParaSupabase(c) || {}
        const limpio = sanitizarParaSupabase({
          ...transformado,
          clinica_id: clinicaId,
          user_id: user.id
        })
        delete limpio.id // Generar UUID en DB si no es UUID válido
        return limpio
      })

      const { error: insertError, data: insertData } = await supabase
        .from('citas')
        .insert(paraInsert)
        .select()

      if (insertError) {
        log.error('Error insertando citas en Supabase:', insertError)
        return false
      }

      // Actualizar mapeo legacy -> UUID en caché y storage
      if (Array.isArray(insertData) && insertData.length > 0 && citasCache) {
        for (let i = 0; i < insertData.length; i++) {
          const insertado = insertData[i] as { id?: string }
          const citaOriginal = aInsertar[i]
          if (citaOriginal && insertado?.id) {
            const idx = citasCache.findIndex((c) => String(c.id) === String(citaOriginal.id))
            if (idx >= 0) {
              citasCache[idx] = { ...citasCache[idx], id: insertado.id }
              migrationStorageService.registrarMapeo(String(citaOriginal.id), String(insertado.id))
            }
          }
        }
        citasRepo.guardar(citasCache)
      }
    }

    // UPDATE
    if (aActualizar.length > 0) {
      const paraUpdate = aActualizar.map((c: Cita) => {
        const transformado = transformarParaSupabase(c) || {}
        return sanitizarParaSupabase({
          ...transformado,
          clinica_id: clinicaId,
          user_id: user.id
        })
      })

      const { error: updateError } = await supabase
        .from('citas')
        .upsert(paraUpdate, { onConflict: 'id' })

      if (updateError) {
        log.error('Error actualizando citas en Supabase:', updateError)
        return false
      }
    }

    // P0-1: Procesar eliminaciones pendientes explícitas (soft-delete vía UPDATE)
    // PROHIBIDO el diff destructivo por ausencia de IDs en memoria
    const pendingDeletes = obtenerPendingDeletes()
    if (Array.isArray(pendingDeletes) && pendingDeletes.length > 0) {
      const exitosos: string[] = []
      const timestampEliminacion = new Date().toISOString()

      for (const idAEliminar of pendingDeletes) {
        if (!esUuidValido(idAEliminar)) {
          exitosos.push(idAEliminar)
          continue
        }

        const { error: updateError } = await supabase
          .from('citas')
          .update({ deleted_at: timestampEliminacion })
          .eq('id', idAEliminar)
          .is('deleted_at', null)

        if (!updateError) {
          exitosos.push(idAEliminar)
        } else {
          log.warn(`Error al aplicar soft-delete a cita ${idAEliminar}:`, updateError.message)
        }
      }

      if (exitosos.length > 0) {
        const exitososSet = new Set(exitosos)
        const restantes = pendingDeletes.filter(id => !exitososSet.has(id))
        guardarPendingDeletes(restantes)
      }
    }

    // Persistir la caché actualizada (con UUIDs nuevos)
    if (citasCache) {
      citasRepo.guardar(citasCache)
    }

    return true
  } catch (error: unknown) {
    log.error('Excepción sincronizando citas con Supabase:', error)
    return false
  }
}

/**
 * Elimina una cita de forma explícita (P0-1).
 *
 * 1. Actualiza inmediatamente la caché en memoria y localStorage (UX optimista).
 * 2. Registra el ID en pendingDeletes (aislado por clínica en tenantRepository).
 * 3. Si Supabase está disponible, ejecuta el soft-delete vía UPDATE con deleted_at.
 * 4. Si tiene éxito remoto, lo retira de pendingDeletes; si falla la red, queda encolado.
 *
 * @param citaId - ID de la cita a eliminar
 * @returns Promise<boolean>
 */
const eliminarCita = async (citaId: unknown): Promise<boolean> => {
  if (!citaId) return false
  const idStr = String(citaId)

  // 1. Actualizar caché local
  if (!cacheInicializado) {
    citasCache = citasRepo.obtener([])
    cacheInicializado = true
  }
  citasCache = (citasCache || []).filter(c => String(c.id) !== idStr)
  citasRepo.guardar(citasCache)

  // 2. Registrar en cola pendingDeletes de la clínica activa
  const pending = obtenerPendingDeletes()
  if (!pending.includes(idStr)) {
    guardarPendingDeletes([...pending, idStr])
  }

  // 3. Sincronizar soft-delete con Supabase si está disponible
  if (!USE_SUPABASE || !supabase || !esUuidValido(idStr)) {
    return true
  }

  try {
    const { error } = await supabase
      .from('citas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', idStr)
      .is('deleted_at', null)

    if (!error) {
      const actualizados = obtenerPendingDeletes().filter(id => id !== idStr)
      guardarPendingDeletes(actualizados)
    } else {
      log.warn(`Error al soft-deletear cita ${idStr}, permanece en pendingDeletes:`, error.message)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`Fallo de red al soft-deletear cita ${idStr}, queda encolado:`, msg)
  }

  return true
}

// ═══════════════════════════════════════════════════════════════════
// OBTENER CITAS DESDE SUPABASE (ASYNC)
// ═══════════════════════════════════════════════════════════════════

const obtenerCitasDesdeSupabase = async (): Promise<Cita[]> => {
  if (!USE_SUPABASE || !supabase) {
    return obtenerCitas()
  }

  try {
    const sesionStore = useSesionStore.getState()
    const clinicaId = (
      sesionStore.clinicaActual ||
      sesionStore.userProfile?.clinicaId ||
      (sesionStore as unknown as Record<string, unknown>).clinicaId ||
      ((sesionStore as unknown as Record<string, unknown>).clinicaActiva as { id?: string } | undefined)?.id ||
      getClinicaActivaSync() ||
      tenantCache.getClinicaId?.()
    ) as string | null

    if (!clinicaId) {
      // F7-36: Sin clinicaId válido, retornar array vacío.
      // NO hacer fallback a localStorage porque puede contener datos
      // de otra clínica (violación de aislamiento multi-tenant).
      return []
    }

    let query: any = supabase.from('citas').select('*')

    if (typeof query.is === 'function') {
      query = query.is('deleted_at', null)
    }

    if (clinicaId && typeof query.eq === 'function') {
      query = query.eq('clinica_id', clinicaId)
    }

    if (typeof query.order === 'function') {
      query = query.order('fecha', { ascending: true })
    }

    const { data, error } = await query

    if (error) {
      log.error('Error obteniendo citas de Supabase:', error)
      // En caso de error de Supabase, retornar array vacío para evitar
      // contaminación cross-tenant. El fallback a localStorage solo está
      // permitido cuando USE_SUPABASE es false.
      return []
    }

    const citasTransformadas = transformarDesdeSupabase(data || [])
    const resultadoFinal: Cita[] = deduplicarCitas(
      (Array.isArray(citasTransformadas) ? citasTransformadas : []).map((c) => normalizarCita(c))
    )

    citasCache = resultadoFinal
    cacheInicializado = true
    citasRepo.guardar(resultadoFinal)

    return resultadoFinal
  } catch (error) {
    log.error('Excepción obteniendo citas de Supabase:', error)
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════
// RESET CACHE (para tests)
// ═══════════════════════════════════════════════════════════════════

const resetCache = (): void => {
  citasCache = null
  cacheInicializado = false
}

// ═══════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════

export interface AgendaStorageServiceAPI {
  obtenerCitas: (defaults?: Cita[]) => Cita[]
  guardarCitas: (citas: unknown) => Promise<boolean>
  eliminarCita: (citaId: unknown) => Promise<boolean>
  sincronizarDesdeSupabase: () => Promise<Cita[] | null>
  obtenerCitasDesdeSupabase: () => Promise<Cita[]>
  resetCache: () => void
  obtenerPendingDeletes: () => string[]
}

export const agendaStorageService: AgendaStorageServiceAPI = {
  obtenerCitas,
  guardarCitas,
  eliminarCita,
  sincronizarDesdeSupabase,
  obtenerCitasDesdeSupabase,
  resetCache,
  obtenerPendingDeletes
}

