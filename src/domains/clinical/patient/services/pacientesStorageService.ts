/**
 * Persistencia de Pacientes (F4-02c-2 — migración a Supabase).
 *
 * Estrategia de "caché local + sync en background" (alineada con RFC F4-01):
 *   localStorage (caché rápida, síncrona) ↕ Caché en memoria ↕ Supabase
 */
import { createTenantRepository, leerJSON, escribirJSON } from '../../../../infrastructure/storage/localStorageRepository'
import { validarListaPacientes } from '../schemas/pacienteSchema'
import type { Paciente } from '../schemas/pacienteSchema'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { transformarParaSupabase } from './pacientesTransformations'
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { 
  eliminarPaciente as softDeleteEliminar, 
  restaurarPaciente as softDeleteRestaurar, 
  listarPacientesEliminados as softDeleteListar,
  vaciarPapeleraPacientes as softDeleteVaciarPacientes
} from './pacientesSoftDeleteService'
import type { PurgeResult } from './pacientesSoftDeleteService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { createLogger } from '../../../../infrastructure/logging/logger'
import {
  pendingPacientesRepo,
  obtenerPendingPacientes,
  guardarPendingPacientes,
  encolarPaciente,
  guardarPacienteHelper,
  procesarColaPacientesHelper,
  sincronizarPacientesDesdeSupabaseHelper,
  pendingDeletesPacientesRepo,
  obtenerPendingDeletesPacientes,
  guardarPendingDeletesPacientes,
  procesarPendingDeletesPacientesHelper
} from './pacientesOfflineQueueService'

const log = createLogger('pacientesStorageService')

export const createTenantLocalStorageRepository = createTenantRepository

const STORAGE_KEY_PACIENTES = 'studio_dental_pacientes_v3'
const pacientesRepo = createTenantRepository<Paciente[]>(STORAGE_KEY_PACIENTES, [])

export {
  pendingPacientesRepo,
  obtenerPendingPacientes,
  guardarPendingPacientes,
  encolarPaciente,
  pendingDeletesPacientesRepo,
  obtenerPendingDeletesPacientes,
  guardarPendingDeletesPacientes
}

let pacientesCache: Paciente[] | null = null
let cacheInicializado = false

const inicializarCache = (defaults: Paciente[]): void => {
  if (cacheInicializado) return
  const datos = pacientesRepo.obtener(defaults)
  pacientesCache = Array.isArray(datos) ? datos : defaults
  cacheInicializado = true
}

const obtenerPacientes = (defaults: Paciente[] = []): Paciente[] => {
  if (!cacheInicializado) {
    inicializarCache(defaults)
  }
  return pacientesCache || defaults
}

const sincronizarDesdeSupabase = async (): Promise<Paciente[]> => {
  return sincronizarPacientesDesdeSupabaseHelper({
    obtenerPacientes,
    actualizarPacientesLocal: (fusionados: Paciente[]) => {
      pacientesCache = fusionados
      cacheInicializado = true
      pacientesRepo.guardar(fusionados)
    }
  })
}

const guardarPacientes = async (pacientes: Paciente[]): Promise<boolean> => {
  const { valido, datos, error } = validarListaPacientes(pacientes)
  if (!valido || !datos) {
    log.error('Error de validación al guardar pacientes:', error)
    return false
  }

  pacientesCache = datos
  cacheInicializado = true
  pacientesRepo.guardar(datos)

  if (!USE_SUPABASE || !supabase) {
    return true
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return true

    const aInsertar: Paciente[] = []
    const aActualizar: Paciente[] = []
    const idsEnMemoria = new Set<string>()

    for (const paciente of datos) {
      if (esUuidValido(paciente.id)) {
        aActualizar.push(paciente)
        idsEnMemoria.add(paciente.id)
      } else {
        aInsertar.push(paciente)
      }
    }

    if (aActualizar.length > 0) {
      const paraUpdate = aActualizar.map(p => ({
        ...transformarParaSupabase(p),
        user_id: user.id
      }))
      const { error: updateError } = await supabase
        .from('pacientes')
        .upsert(paraUpdate, { onConflict: 'id' })

      if (updateError) log.error('Error al actualizar en Supabase:', updateError.message)
    }

    for (const paciente of aInsertar) {
      const paraInsert: Record<string, unknown> = {
        ...transformarParaSupabase(paciente),
        user_id: user.id
      }
      delete paraInsert.id

      if (paciente.rut) {
        const { data: existente, error: checkError } = await supabase
          .from('pacientes')
          .select('id')
          .eq('user_id', user.id)
          .eq('rut', paciente.rut)
          .maybeSingle()

        if (!checkError && existente) {
          const { error: updateError } = await supabase
            .from('pacientes')
            .update(paraInsert)
            .eq('id', existente.id)

          if (updateError) {
            log.error(`Error al actualizar duplicado ${paciente.nombre}:`, updateError.message)
            continue
          }

          idsEnMemoria.add(existente.id)
          const index = pacientesCache?.findIndex(p => p.rut === paciente.rut && !esUuidValido(p.id)) ?? -1
          if (index >= 0 && pacientesCache) {
            const legacyId = pacientesCache[index].id
            pacientesCache[index] = { ...pacientesCache[index], id: existente.id }
            migrationStorageService.registrarMapeo(legacyId, existente.id)
          }
          continue
        }
      }

      const { data: insertado, error: insertError } = await supabase
        .from('pacientes')
        .insert(paraInsert)
        .select('id')
        .single()

      if (insertError) {
        if (insertError.code === '23505' || insertError.message.includes('duplicate key') || insertError.message.includes('unique constraint')) {
          log.warn(`Duplicado detectado por constraint unique para ${paciente.nombre} (RUT: ${paciente.rut})`)
          const rutNorm = typeof paraInsert.rut === 'string' ? paraInsert.rut.toUpperCase().replace(/\./g, '').replace(/-/g, '') : ''
          const { data: existentePostError, error: findError } = await supabase
            .from('pacientes')
            .select('id')
            .eq('user_id', user.id)
            .eq('rut_normalizado', rutNorm)
            .maybeSingle()

          if (!findError && existentePostError && pacientesCache) {
            idsEnMemoria.add(existentePostError.id)
            const index = pacientesCache.findIndex(p => !esUuidValido(p.id) && p.rut === paciente.rut)
            if (index >= 0) {
              const legacyId = pacientesCache[index].id
              pacientesCache[index] = { ...pacientesCache[index], id: existentePostError.id }
              migrationStorageService.registrarMapeo(legacyId, existentePostError.id)
            }
          }
          continue
        }
        log.error(`Error al insertar ${paciente.nombre}:`, insertError.message)
        continue
      }

      if (insertado && pacientesCache) {
        idsEnMemoria.add(insertado.id)
        const index = pacientesCache.findIndex(p => !esUuidValido(p.id) && p.rut === paciente.rut)
        if (index >= 0) {
          const legacyId = pacientesCache[index].id
          pacientesCache[index] = { ...pacientesCache[index], id: insertado.id }
          migrationStorageService.registrarMapeo(legacyId, insertado.id)
        }
      }
    }

    await procesarPendingDeletesPacientesHelper()
    if (pacientesCache) pacientesRepo.guardar(pacientesCache)
    return true
  } catch (error: unknown) {
    log.error('Excepción al guardar en Supabase:', error)
    return true
  }
}

export const guardarPaciente = async (paciente: Paciente): Promise<Paciente | null> => {
  return guardarPacienteHelper(paciente, {
    obtenerPacientes,
    actualizarPacientesLocal: (listado: Paciente[]) => {
      pacientesCache = listado
      cacheInicializado = true
      pacientesRepo.guardar(listado)
    }
  })
}

export const procesarColaPacientes = async (): Promise<{ procesados: number; fallidos: number }> => {
  return procesarColaPacientesHelper({
    obtenerPacientes,
    actualizarPacientesLocal: (listado: Paciente[]) => {
      pacientesCache = listado
      pacientesRepo.guardar(listado)
    }
  })
}

export const actualizarPaciente = async (
  pacienteId: string | number,
  updates: Partial<Paciente>
): Promise<boolean> => {
  console.log('[DEBUG] actualizarPaciente:', { pacienteId, updates })

  const pacientes = obtenerPacientes()
  const index = pacientes.findIndex((p) => String(p.id) === String(pacienteId))

  if (index < 0) {
    log.error('Paciente no encontrado para actualizar:', pacienteId)
    return false
  }

  const pacienteActualizado = { ...pacientes[index], ...updates }
  console.log('[DEBUG] Paciente actualizado:', {
    id: pacienteActualizado.id,
    estado: pacienteActualizado.estado,
    doctorTratanteId: pacienteActualizado.doctorTratanteId,
  })

  pacientes[index] = pacienteActualizado
  const resultado = await guardarPacientes(pacientes)
  console.log('[DEBUG] Resultado guardarPacientes:', resultado)

  return resultado
}

export const resetCache = (): void => {
  pacientesCache = null
  cacheInicializado = false
}

export const pacientesStorageService = {
  obtenerPacientes,
  guardarPacientes,
  guardarPaciente,
  actualizarPaciente,
  procesarColaPacientes,
  obtenerPendingPacientes,
  guardarPendingPacientes,
  obtenerPendingDeletesPacientes,
  guardarPendingDeletesPacientes,
  sincronizarDesdeSupabase,
  resetCache,

  obtenerItem: <T>(key: string, fallback: T = [] as unknown as T): T => leerJSON<T>(key, fallback),
  guardarItem: (key: string, data: unknown): boolean => escribirJSON(key, data),
  eliminarItem: (key: string): void => {
    if (!key) return
    try {
      localStorage.removeItem(key)
    } catch (e: unknown) {
      log.error(`Error al eliminar item ${key}:`, e)
    }
  },

  eliminarPaciente: async (pacienteId: string | number): Promise<boolean> => {
    const idStr = String(pacienteId)
    const pending = obtenerPendingDeletesPacientes()
    if (!pending.includes(idStr)) {
      guardarPendingDeletesPacientes([...pending, idStr])
    }

    const resultado = await softDeleteEliminar(pacienteId)
    
    if (resultado) {
      const actualizados = obtenerPendingDeletesPacientes().filter(id => id !== idStr)
      guardarPendingDeletesPacientes(actualizados)
    }

    if (resultado && (!USE_SUPABASE || !supabase) && pacientesCache) {
      pacientesCache = pacientesCache.filter(p => String(p.id) !== idStr)
      pacientesRepo.guardar(pacientesCache)
    }
    
    return resultado
  },

  restaurarPaciente: async (pacienteId: string | number): Promise<boolean> => {
    return await softDeleteRestaurar(String(pacienteId))
  },

  listarPacientesEliminados: async (): Promise<Paciente[]> => {
    return await softDeleteListar()
  },

  vaciarPapeleraPacientes: async (pacienteIds?: string[]): Promise<PurgeResult> => {
    return await softDeleteVaciarPacientes(pacienteIds || [])
  },

  eliminarEvolucionesDePaciente: (pacienteId?: string | number | null): void => {
    if (!pacienteId) return
    try {
      localStorage.removeItem(`evoluciones_notas_${pacienteId}`)
    } catch (e: unknown) {
      log.error(`Error al eliminar evoluciones del paciente ${pacienteId}:`, e)
    }
  },

  eliminarRecetasDePaciente: (pacienteId?: string | number | null): void => {
    if (!pacienteId) return
    try {
      localStorage.removeItem(`recetas_${pacienteId}`)
    } catch (e: unknown) {
      log.error(`Error al eliminar recetas del paciente ${pacienteId}:`, e)
    }
  }
}

export {
  obtenerPacientes,
  guardarPacientes,
  sincronizarDesdeSupabase
}
