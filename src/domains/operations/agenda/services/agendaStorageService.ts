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
  return citasCache ?? defaults
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
  if (!USE_SUPABASE || !supabase) {
    return citasCache
  }

  try {
    let query = supabase.from('citas').select('*') as unknown as QueryBuilderLike
    if (typeof query.is === 'function') {
      query = query.is('deleted_at', null)
    }
    const { data, error } = await query
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: true })

    if (error) {
      log.warn('Error al sincronizar desde Supabase:', error.message)
      return citasCache
    }

    if (!Array.isArray(data)) return citasCache

    // F7-36: Supabase [] = clínica sin citas. Error de red ya retornó cache arriba.
    if (data.length === 0) {
      log.info('Supabase retornó []: clínica sin citas, cache limpiada')
    }

    const nuevas: Cita[] = data
      .map((row: Record<string, unknown>) => transformarDesdeSupabase(row))
      .filter((c): c is Cita => c !== null)
    citasCache = nuevas
    citasRepo.guardar(nuevas)

    return nuevas
  } catch (error: unknown) {
    log.error('Excepción al sincronizar desde Supabase:', error)
    return citasCache
  }
}

// ═══════════════════════════════════════════════════════════════════
// GUARDAR CITAS (ASYNC con actualización de caché síncrona)
// ═══════════════════════════════════════════════════════════════════

/**
 * Guarda la lista completa de citas.
 *
 * 1. Actualiza caché en memoria (síncrono) — UX optimista
 * 2. Persiste en localStorage como caché persistente
 * 3. Si Supabase activo, sincroniza en background (no bloquea)
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

    const aInsertar: Cita[] = []
    const aActualizar: Cita[] = []
    const idsEnMemoria = new Set<string>()

    for (const cita of datos) {
      if (esUuidValido(cita.id)) {
        aActualizar.push(cita)
        idsEnMemoria.add(String(cita.id))
      } else {
        aInsertar.push(cita)
      }
    }

    // UPDATE en batch
    if (aActualizar.length > 0) {
      const paraUpdate = aActualizar.map((c: Cita) => ({
        ...transformarParaSupabase(c),
        user_id: user.id
      }))

      const { error: updateError } = await supabase
        .from('citas')
        .upsert(paraUpdate, { onConflict: 'id' })

      if (updateError) {
        log.error('Error al actualizar en Supabase:', updateError.message)
      }
    }

    // INSERT uno por uno (INSERT directo sin verificación de duplicados)
    for (const cita of aInsertar) {
      const paraInsert: Record<string, unknown> = {
        ...transformarParaSupabase(cita),
        user_id: user.id
      }
      delete paraInsert.id

      // INSERT directo en Supabase
      const { data: insertado, error: insertError } = await supabase
        .from('citas')
        .insert(paraInsert)
        .select('id')
        .single()

      if (insertError) {
        log.error(`Error al insertar cita:`, insertError.message)
        continue
      }

      // Actualizar la cita en caché con el nuevo UUID
      if (citasCache && insertado) {
        const index = citasCache.findIndex(c => !esUuidValido(c.id) &&
          c.fecha === cita.fecha && c.horaInicio === cita.horaInicio &&
          c.pacienteId === cita.pacienteId)
        if (index >= 0) {
          const legacyId = citasCache[index].id
          citasCache[index] = { ...citasCache[index], id: insertado.id }
          migrationStorageService.registrarMapeo(String(legacyId), String(insertado.id))
        }
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
    log.error('Excepción al guardar en Supabase:', error)
    return true
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
    const { data, error } = await supabase
      .from('citas')
      .select('*')
      .order('fecha', { ascending: true })

    if (error) {
      log.error('Error obteniendo citas de Supabase:', error.message || error)
      return obtenerCitas()
    }

    const transformadas = (data || [])
      .map((row: Record<string, unknown>) => transformarDesdeSupabase(row))
      .filter((c): c is Cita => c !== null)

    citasCache = transformadas
    cacheInicializado = true
    citasRepo.guardar(transformadas)
    return transformadas
  } catch (error) {
    log.error('Excepción al obtener citas desde Supabase:', error)
    return obtenerCitas()
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

