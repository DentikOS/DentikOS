/**
 * Persistencia de Presupuestos (F4-02c-4 — migración a Supabase).
 *
 * Estrategia de "caché local + sync en background":
 * - Presupuestos globales (historial completo) → migrados a Supabase
 * - Items de presupuesto → sincronizados transaccionalmente con cola offline (P1-3)
 *
 * API pública:
 * - obtenerPresupuestos()              → SÍNCRONO, retorna de caché en memoria
 * - guardarPresupuestos()              → ASYNC, escribe en Supabase + actualiza caché
 * - guardarPresupuesto()               → ASYNC, offline-first con cola pendingPresupuestos
 * - guardarItemPresupuesto()           → ASYNC, offline-first con cola pendingPresupuestoItems
 * - eliminarPresupuesto()              → ASYNC, eliminación con cola pendingDeletesPresupuestos
 * - eliminarItemPresupuesto()          → ASYNC, eliminación con cola pendingDeletesPresupuestoItems
 * - procesarColaPresupuestos()         → ASYNC, drena colas transaccionalmente
 * - procesarPendingDeletesPresupuestos()→ ASYNC, procesa eliminaciones pendientes
 * - sincronizarDesdeSupabase()         → ASYNC, refresca caché desde Supabase protegiendo pendientes
 * - resetCache()                       → limpia caché (para tests)
 */
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { leerJSON, escribirJSON, createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { validarListaPresupuestos } from '../schemas/presupuestoSchema'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { TRANSICIONES_MANUALES_PRESUPUESTO } from '../constants/presupuestosConstants'
import {
  guardarPresupuestoHelper,
  guardarItemPresupuestoHelper,
  eliminarPresupuestoHelper,
  eliminarItemPresupuestoHelper,
  procesarColaPresupuestosHelper,
  procesarPendingDeletesPresupuestosHelper,
  sincronizarPresupuestosDesdeSupabaseHelper,
  obtenerPendingPresupuestos,
  guardarPendingPresupuestos,
  obtenerPendingPresupuestoItems,
  guardarPendingPresupuestoItems,
  obtenerPendingDeletesPresupuestos,
  guardarPendingDeletesPresupuestos,
  obtenerPendingDeletesPresupuestoItems,
  guardarPendingDeletesPresupuestoItems,
  transformarPresupuestoParaSupabase,
  type PresupuestoLocal,
  type PresupuestoItemLocal,
  type PendingPresupuesto,
  type PendingPresupuestoItem
} from './presupuestosOfflineQueueService'

export type { PresupuestoLocal, PresupuestoItemLocal, PendingPresupuesto, PendingPresupuestoItem }

export interface PacienteRefPresupuesto {
  id: string | number
  nombre?: string
  rut?: string
  prevision?: string
  [key: string]: unknown
}

export interface AbonoLocalRef {
  id?: string | number
  monto?: number | string
  [key: string]: unknown
}

export interface ProcesarColaPresupuestosResult {
  procesados: number
  fallidos: number
  razon?: string
  offline?: boolean
  [key: string]: unknown
}

const log = createLogger('presupuestosStorageService')

const STORAGE_KEY_PRESUPUESTOS = 'studio_dental_presupuestos_globales'
const presupuestosRepo = createTenantRepository<PresupuestoLocal[]>(STORAGE_KEY_PRESUPUESTOS, [], {
  notify: true,
  eventos: ['presupuestos_actualizados']
})

// Caché en memoria
let presupuestosCache: PresupuestoLocal[] | null = null
let cacheInicializado = false

const inicializarCache = (defaults: PresupuestoLocal[]): void => {
  if (cacheInicializado) return
  const datos = presupuestosRepo.obtener(defaults)
  presupuestosCache = Array.isArray(datos) ? datos : defaults
  cacheInicializado = true
}

export const obtenerPresupuestos = (defaults: PresupuestoLocal[] = []): PresupuestoLocal[] => {
  if (!cacheInicializado) {
    inicializarCache(defaults)
  }
  return presupuestosCache || defaults
}

const actualizarPresupuestosLocal = (nuevos: PresupuestoLocal[]): void => {
  presupuestosCache = nuevos
  cacheInicializado = true
  presupuestosRepo.guardar(nuevos)
}

export const guardarPresupuesto = async (presupuesto: PresupuestoLocal): Promise<PresupuestoLocal | null> => {
  return guardarPresupuestoHelper(presupuesto, {
    obtenerPresupuestos,
    actualizarPresupuestosLocal
  })
}

export const guardarItemPresupuesto = async (item: PresupuestoItemLocal): Promise<PresupuestoItemLocal | null> => {
  return guardarItemPresupuestoHelper(item, {
    obtenerPresupuestos,
    actualizarPresupuestosLocal
  })
}

export const eliminarPresupuesto = async (presupuestoId: string | number): Promise<boolean> => {
  return eliminarPresupuestoHelper(presupuestoId, {
    obtenerPresupuestos,
    actualizarPresupuestosLocal
  })
}

export const eliminarItemPresupuesto = async (
  itemId: string | number,
  presupuestoId?: string | number | null
): Promise<boolean> => {
  if (presupuestoId === undefined || presupuestoId === null) return false
  return eliminarItemPresupuestoHelper(itemId, presupuestoId, {
    obtenerPresupuestos,
    actualizarPresupuestosLocal
  })
}

export const procesarColaPresupuestos = async (): Promise<ProcesarColaPresupuestosResult> => {
  return procesarColaPresupuestosHelper({
    obtenerPresupuestos,
    actualizarPresupuestosLocal
  })
}

export const procesarPendingDeletesPresupuestos = async (): Promise<void> => {
  return procesarPendingDeletesPresupuestosHelper()
}

export const sincronizarDesdeSupabase = async (): Promise<PresupuestoLocal[]> => {
  return sincronizarPresupuestosDesdeSupabaseHelper({
    obtenerPresupuestos,
    actualizarPresupuestosLocal,
    presupuestosRepo
  })
}

export {
  obtenerPendingPresupuestos,
  guardarPendingPresupuestos,
  obtenerPendingPresupuestoItems,
  guardarPendingPresupuestoItems,
  obtenerPendingDeletesPresupuestos,
  guardarPendingDeletesPresupuestos,
  obtenerPendingDeletesPresupuestoItems,
  guardarPendingDeletesPresupuestoItems
}

export const guardarPresupuestos = async (presupuestos: PresupuestoLocal[]): Promise<boolean> => {
  const validacion = validarListaPresupuestos(presupuestos)
  if (!validacion.valido || !validacion.datos) {
    log.error('Error de validación al guardar presupuestos (F2-04e):', validacion.error)
    return false
  }
  const datos = validacion.datos as PresupuestoLocal[]

  presupuestosCache = datos
  cacheInicializado = true
  presupuestosRepo.guardar(datos)

  if (!USE_SUPABASE || !supabase) {
    return true
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return true
    }

    const aInsertar: PresupuestoLocal[] = []
    const aActualizar: PresupuestoLocal[] = []

    for (const presupuesto of datos) {
      if (esUuidValido(presupuesto.id)) {
        aActualizar.push(presupuesto)
      } else {
        aInsertar.push(presupuesto)
      }
    }

    // UPDATE en batch
    if (aActualizar.length > 0) {
      const paraUpdate = aActualizar.map((p) => transformarPresupuestoParaSupabase(p, user.id))
      const { error: updateError } = await supabase
        .from('presupuestos')
        .upsert(paraUpdate, { onConflict: 'id' })

      if (updateError) {
        log.error('Error al actualizar en Supabase:', updateError.message)
      }
    }

    // INSERT uno por uno
    for (const presupuesto of aInsertar) {
      const paraInsert = transformarPresupuestoParaSupabase(presupuesto, user.id)
      delete paraInsert.id

      const { data: insertado, error: insertError } = await supabase
        .from('presupuestos')
        .insert(paraInsert)
        .select('id')
        .single()

      if (insertError) {
        log.error('Error al insertar presupuesto:', insertError.message)
        continue
      }

      if (presupuestosCache && insertado?.id) {
        const index = presupuestosCache.findIndex((p) => !esUuidValido(p.id) &&
          p.folio === presupuesto.folio && p.pacienteId === presupuesto.pacienteId)
        if (index >= 0) {
          const legacyId = presupuestosCache[index].id
          presupuestosCache[index] = { ...presupuestosCache[index], id: insertado.id }
          migrationStorageService.registrarMapeo(legacyId, insertado.id)
        }
      }
    }

    // P1-3: SE REMOVIÓ EL BLOQUE DESTRUCTIVO DE DIFF DELETE (idsAEliminar)
    // Las eliminaciones deben realizarse explícitamente vía pendingDeletesPresupuestos
    if (presupuestosCache) {
      presupuestosRepo.guardar(presupuestosCache)
    }
    return true
  } catch (error) {
    log.error('Excepción al guardar en Supabase:', error)
    return true
  }
}

export const resetCache = (): void => {
  presupuestosCache = null
  cacheInicializado = false
}

export const aplicarAbonoConfirmado = (
  presupuestoId: string | number,
  montoAbonado: number,
  estado: string
): void => {
  const existentes = obtenerPresupuestos([])
  actualizarPresupuestosLocal(existentes.map((p) =>
    String(p.id) === String(presupuestoId) ? { ...p, montoAbonado, estado } : p
  ))
}

export const archivarPresupuesto = async (presupuestoId: string | number): Promise<boolean> => {
  const presupuesto = obtenerPresupuestos([]).find((p) => String(p.id) === String(presupuestoId))
  if (!presupuesto || presupuesto.estado === 'archivado' || !presupuesto.pacienteId) return false
  const guardado = await guardarPresupuesto({
    ...presupuesto,
    estado: 'archivado',
    archivadoAt: new Date().toISOString(),
    version: Number(presupuesto.version || 1) + 1,
  })
  return Boolean(guardado)
}

export const actualizarEstadoPresupuesto = async (
  presupuestoId: string | number,
  nuevoEstado: string
): Promise<boolean> => {
  const presupuesto = obtenerPresupuestos([]).find((p) => String(p.id) === String(presupuestoId))
  if (!presupuesto || !presupuesto.pacienteId ||
    !TRANSICIONES_MANUALES_PRESUPUESTO[presupuesto.estado || '']?.includes(nuevoEstado)) return false
  const guardado = await guardarPresupuesto({
    ...presupuesto,
    estado: nuevoEstado,
    version: Number(presupuesto.version || 1) + 1,
  })
  return Boolean(guardado)
}

export const presupuestosStorageService = {
  obtenerPresupuestos,
  guardarPresupuestos,
  guardarPresupuesto,
  guardarItemPresupuesto,
  eliminarPresupuesto,
  eliminarItemPresupuesto,
  procesarColaPresupuestos,
  procesarPendingDeletesPresupuestos,
  sincronizarDesdeSupabase,
  resetCache,
  aplicarAbonoConfirmado,
  archivarPresupuesto,
  actualizarEstadoPresupuesto,
  obtenerPendingPresupuestos,
  guardarPendingPresupuestos,
  obtenerPendingPresupuestoItems,
  guardarPendingPresupuestoItems,
  obtenerPendingDeletesPresupuestos,
  guardarPendingDeletesPresupuestos,
  obtenerPendingDeletesPresupuestoItems,
  guardarPendingDeletesPresupuestoItems,

  obtenerItemsPorPaciente: (pacienteId: string | number | null | undefined): PresupuestoItemLocal[] => {
    if (!pacienteId) return []
    return leerJSON<PresupuestoItemLocal[]>(`presupuesto_items_${pacienteId}`, [])
  },

  sincronizarConFichaPaciente: (
    pacienteId: string | number | null | undefined,
    items: PresupuestoItemLocal[],
    convenio: string = 'Particular'
  ): void => {
    if (!pacienteId) return
    const keyItems = `presupuesto_items_${pacienteId}`
    const existentes = leerJSON<PresupuestoItemLocal[]>(keyItems, [])

    const idsExistentes = new Set(existentes.map((i) => i.id))
    const nuevosAjustados = items.map((it) => ({
      ...it,
      convenio: it.convenio || convenio,
      estado: it.estado || 'Pendiente'
    })).filter((it) => !idsExistentes.has(it.id))

    const consolidados = [...existentes, ...nuevosAjustados]
    escribirJSON(keyItems, consolidados, { notify: true })
  },

  eliminarPresupuestoYFicha: (
    presupuestoId: string | number,
    pacienteId?: string | number | null,
    itemsABorrar: PresupuestoItemLocal[] = []
  ): void => {
    eliminarPresupuesto(presupuestoId)

    if (pacienteId) {
      const keyItems = `presupuesto_items_${pacienteId}`
      const existentes = leerJSON<PresupuestoItemLocal[] | null>(keyItems, null)
      if (existentes !== null) {
        if (itemsABorrar.length > 0) {
          const idsABorrar = new Set(itemsABorrar.map((i) => i.id))
          const filtrados = existentes.filter((i) => !idsABorrar.has(i.id))
          escribirJSON(keyItems, filtrados)
        } else {
          try {
            localStorage.removeItem(keyItems)
          } catch (e) {
            log.error(`Error al eliminar "${keyItems}" de localStorage:`, e)
          }
        }
      }
    }
  },

  eliminarItemsDePaciente: (pacienteId: string | number | null | undefined): void => {
    if (!pacienteId) return
    try {
      localStorage.removeItem(`presupuesto_items_${pacienteId}`)
    } catch (e) {
      log.error(`Error al eliminar items de presupuesto del paciente ${pacienteId}:`, e)
    }
  },

  consolidarPresupuestosDesdePacientes: (pacientes: PacienteRefPresupuesto[] = []): PresupuestoLocal[] => {
    const consolidados: PresupuestoLocal[] = []
    pacientes.forEach((p) => {
      const items = leerJSON<PresupuestoItemLocal[]>(`presupuesto_items_${p.id}`, [])
      const abonos = leerJSON<AbonoLocalRef[]>(`abonos_${p.id}`, [])

      if (items.length > 0) {
        const total = items.reduce((acc, curr) => acc + (parseFloat(String(curr.valor || curr.precio || 0)) || 0), 0)
        const abonado = abonos.reduce((acc, curr) => acc + (parseFloat(String(curr.monto || 0)) || 0), 0)
        const todosRealizados = items.every((i) => i.estado === 'Realizado')
        const saldoRestante = total - abonado

        let estadoCalculado = 'Emitido'
        if (todosRealizados || saldoRestante <= 0) {
          estadoCalculado = 'Aprobado'
        } else if (items.some((i) => i.estado === 'En Proceso' || i.estado === 'Realizado') || abonado > 0) {
          estadoCalculado = 'EnTratamiento'
        }

        consolidados.push({
          id: `paciente_${p.id}`,
          folio: `PRES-PAC-${p.id}`,
          pacienteId: p.id,
          pacienteNombre: p.nombre,
          pacienteRut: p.rut,
          fechaEmision: obtenerFechaLocalISO(),
          convenio: p.prevision || 'Particular',
          montoTotal: total,
          montoAbonado: abonado,
          estado: estadoCalculado,
          items,
          observacion: 'Presupuesto vinculado desde la Ficha Médica del paciente.'
        })
      }
    })
    return consolidados
  }
}
