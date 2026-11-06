import { pacientesStorageService } from './pacientesStorageService'
import {
  obtenerDatoClinico,
  guardarEvolucionClinica as guardarEvolucionSupabase,
  obtenerEvolucionesRemotas,
  obtenerEvolucionTratamientoRealizado as obtenerCierreRemoto
} from '../../../../infrastructure/supabase/datosClinicosSupabase'
import type { EvolucionClinicaRow } from '../../../../infrastructure/supabase/datosClinicosSupabase'
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { USE_SUPABASE, supabase } from '../../../../infrastructure/supabase/supabaseClient'

const log = createLogger('evolucionesStorageService')

/**
 * Servicio de Persistencia de Evoluciones Clínicas (F6-D-5 + P1-3)
 *
 * Estrategia: Supabase como fuente de verdad, localStorage como caché offline,
 * y cola diferida pendingEvoluciones para garantizar resiliencia y cero pérdida
 * de notas clínicas según la Ley 20.584.
 *
 * Transformación bidireccional:
 * - Local: { id, fecha: 'DD-MM-YYYY HH:MM', texto, tipo, sincronizado }
 * - Supabase: { id, fecha_hora: ISO string, texto, tipo: 'evolucion' }
 */

export interface EvolucionClinicaLocal {
  id: string | number
  fecha: string
  texto: string
  tipo: string
  sincronizado?: boolean
  pacienteId?: string
  clinicaId?: string | null
  tratamientoRef?: string
  tratamiento_ref?: string
  [key: string]: unknown
}

export interface EvolucionClinicaSupabasePayload {
  id?: string
  fecha_hora: string
  texto: string
  tipo: string
  [key: string]: unknown
}

export interface PendingEvolucionItem {
  id: string | number
  pacienteId?: string
  clinicaId?: string | null
  fecha?: string
  texto?: string
  tipo?: string
  sincronizado?: boolean
  [key: string]: unknown
}

export type PendingEvolucionEntry = PendingEvolucionItem | string | number

// Aliases para cumplimiento arquitectónico
export const createTenantLocalStorageRepository = createTenantRepository

// P1-3: Cola local de evoluciones pendientes aislada por tenant
const pendingEvolucionesRepo = createTenantRepository<PendingEvolucionEntry[]>('studio_dental_evoluciones_pending', [])

const obtenerClinicaId = (): string | null => {
  try {
    return getClinicaActivaSync()
  } catch {
    return null
  }
}

/**
 * Obtiene la lista de evoluciones pendientes de sincronizar para la clínica activa (P1-3).
 */
export const obtenerPendingEvoluciones = (): PendingEvolucionEntry[] => {
  return pendingEvolucionesRepo.obtener([]) || []
}

/**
 * Guarda la lista de evoluciones pendientes de sincronizar para la clínica activa (P1-3).
 */
export const guardarPendingEvoluciones = (pending?: PendingEvolucionEntry[] | null): void => {
  if (!pending || pending.length === 0) {
    pendingEvolucionesRepo.eliminar()
  } else {
    pendingEvolucionesRepo.guardar(pending)
  }
}

/**
 * Normaliza fecha/hora de múltiples formatos a ISO string
 * Maneja: 'DD-MM-YYYY HH:MM', 'DD/MM/YYYY HH:MM', ISO strings
 */
const normalizarFechaHora = (fecha?: unknown): string => {
  if (!fecha) return new Date().toISOString()

  // Si ya es ISO string válido, retornar tal cual
  if (typeof fecha === 'string' && fecha.includes('T') && fecha.includes('Z')) {
    return fecha
  }

  // Formato chileno: DD-MM-YYYY HH:MM o DD/MM/YYYY HH:MM
  if (typeof fecha === 'string') {
    const matchChile = fecha.match(/^(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2})$/)
    if (matchChile) {
      const [, dia, mes, anio, hora, minuto] = matchChile
      return `${anio}-${mes}-${dia}T${hora}:${minuto}:00.000Z`
    }
  }

  // Si es un número (timestamp), convertir
  if (typeof fecha === 'number') {
    return new Date(fecha).toISOString()
  }

  // Fallback: intentar parsear como Date
  const parsed = new Date(String(fecha))
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  // Último recurso: fecha actual
  return new Date().toISOString()
}

/**
 * Transforma evolución de formato Supabase a formato local
 */
export const transformarDesdeSupabase = (
  evoSupabase: Partial<EvolucionClinicaRow> & Record<string, unknown>
): EvolucionClinicaLocal => {
  const res: EvolucionClinicaLocal = {
    id: (evoSupabase.id as string | number) || '',
    fecha: String(evoSupabase.fecha_hora || evoSupabase.fechaHora || evoSupabase.fecha || ''),
    texto: String(evoSupabase.texto || ''),
    tipo: String(evoSupabase.tipo || 'evolucion')
  }
  if (typeof evoSupabase.tratamiento_ref === 'string') {
    res.tratamientoRef = evoSupabase.tratamiento_ref
    res.tratamiento_ref = evoSupabase.tratamiento_ref
  }
  if (evoSupabase.sincronizado !== undefined) {
    res.sincronizado = Boolean(evoSupabase.sincronizado)
  }
  return res
}

/**
 * Transforma evolución de formato local a formato Supabase
 */
export const transformarHaciaSupabase = (
  evoLocal: Partial<EvolucionClinicaLocal> & Record<string, unknown>
): EvolucionClinicaSupabasePayload => ({
  id: evoLocal.id !== undefined && evoLocal.id !== null ? String(evoLocal.id) : undefined,
  fecha_hora: normalizarFechaHora(evoLocal.fecha || evoLocal.fecha_hora),
  texto: String(evoLocal.texto || ''),
  tipo: String(evoLocal.tipo || 'evolucion'),
  ...(evoLocal.tipo === 'tratamiento_realizado'
    ? { tratamientoRef: String(evoLocal.tratamientoRef || evoLocal.tratamiento_ref || '') }
    : {})
})

/**
 * Valida si un ID es UUID válido
 */
export const esUUIDValido = (id: unknown): boolean => {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Encola una evolución en pendingEvoluciones
 */
const encolarEvolucion = ({
  id,
  pacienteId,
  fecha,
  texto,
  tipo
}: {
  id: string | number
  pacienteId?: string
  fecha?: string
  texto?: string
  tipo?: string
}): void => {
  try {
    const clinicaId = obtenerClinicaId()
    const pending = obtenerPendingEvoluciones()
    const yaEncolado = pending.some((item) =>
      typeof item === 'object' && item !== null ? item.id === id : item === id
    )
    if (!yaEncolado) {
      pending.push({
        id,
        pacienteId,
        clinicaId,
        fecha,
        texto,
        tipo: tipo || 'evolucion',
        sincronizado: false
      })
      guardarPendingEvoluciones(pending)
    }
  } catch (errQueue: unknown) {
    const msg = errQueue instanceof Error ? errQueue.message : String(errQueue)
    log.warn('Error al encolar en pendingEvoluciones:', msg)
  }
}

/**
 * Obtiene evoluciones desde Supabase con fallback a localStorage y protección
 * para incluir evoluciones pendientes que aún no están en la nube.
 */
export const obtenerEvoluciones = (
  pacienteId?: string | number | null,
  fallback: EvolucionClinicaLocal[] = []
): EvolucionClinicaLocal[] => {
  if (!pacienteId) return fallback

  let evos: EvolucionClinicaLocal[] | null = null

  // 1. Intentar desde caché de Supabase primero (ya transformado)
  const datoSupabase = obtenerDatoClinico<(Partial<EvolucionClinicaRow> & Record<string, unknown>)[]>(
    pacienteId,
    'evoluciones_notas',
    null
  )
  if (datoSupabase !== null && Array.isArray(datoSupabase)) {
    evos = datoSupabase.map(transformarDesdeSupabase)
  }

  // 2. Si no hay dato en Supabase, leer de localStorage
  if (evos === null) {
    const evosLS = pacientesStorageService.obtenerItem<EvolucionClinicaLocal[]>(
      `evoluciones_notas_${pacienteId}`,
      fallback
    )
    return Array.isArray(evosLS) ? [...evosLS] : fallback
  }

  // 3. P1-3: Proteger visibilidad de evoluciones offline solo si hay operaciones pendientes en cola
  const pending = obtenerPendingEvoluciones()
  const pendingDelPaciente = pending.filter(
    (p) => typeof p === 'object' && p !== null && (!p.pacienteId || String(p.pacienteId) === String(pacienteId))
  )

  if (pendingDelPaciente.length > 0) {
    const evosLocales = pacientesStorageService.obtenerItem<EvolucionClinicaLocal[]>(
      `evoluciones_notas_${pacienteId}`,
      []
    )
    if (Array.isArray(evosLocales) && evosLocales.length > 0) {
      const pendingIds = new Set(
        pendingDelPaciente.map((p) => (typeof p === 'object' && p !== null ? p.id : p))
      )
      const noSincronizadas = evosLocales.filter(
        (e) => e.sincronizado === false || pendingIds.has(e.id)
      )

      if (noSincronizadas.length > 0) {
        const idsExistentes = new Set(evos.map((e) => e.id))
        for (const offlineEvo of noSincronizadas) {
          if (!idsExistentes.has(offlineEvo.id)) {
            evos.unshift(offlineEvo)
            idsExistentes.add(offlineEvo.id)
          }
        }
      }
    }
  }

  return evos
}

/**
 * Guarda una única evolución clínica (P1-3).
 *
 * Estrategia dual offline-first:
 * 1. Guarda en localStorage inmediatamente con sincronizado: false
 * 2. Intenta subir a Supabase
 * 3. Si tiene éxito: marca sincronizado: true y actualiza con UUID si correspondía
 * 4. Si falla: encola ID en pendingEvoluciones para reintento diferido
 */
export const guardarEvolucionClinica = async (
  pacienteId: string,
  evolucion?: Partial<EvolucionClinicaLocal> | null
): Promise<EvolucionClinicaLocal | null> => {
  if (!pacienteId || !evolucion) return null

  const id = evolucion.id || Date.now()
  const registroLocal: EvolucionClinicaLocal = {
    ...evolucion,
    id,
    fecha: evolucion.fecha || new Date().toISOString(),
    texto: evolucion.texto || '',
    tipo: evolucion.tipo || 'evolucion',
    sincronizado: false
  }

  // 1. Obtener y actualizar listado en localStorage (offline-first inmediato)
  const evosLocales = pacientesStorageService.obtenerItem<EvolucionClinicaLocal[]>(
    `evoluciones_notas_${pacienteId}`,
    []
  )
  const listado = Array.isArray(evosLocales) ? [...evosLocales] : []
  const idx = listado.findIndex((e) => e.id === id)
  if (idx >= 0) {
    listado[idx] = registroLocal
  } else {
    listado.unshift(registroLocal)
  }
  pacientesStorageService.guardarItem(`evoluciones_notas_${pacienteId}`, listado)

  // 2. Intentar subir a Supabase
  let subidoExitoso = false
  let resultadoRemoto: EvolucionClinicaRow | null = null

  try {
    const evoSupabase = transformarHaciaSupabase(registroLocal)
    if (!esUUIDValido(evoSupabase.id)) {
      delete evoSupabase.id
    }

    resultadoRemoto = await guardarEvolucionSupabase(pacienteId, evoSupabase)
    if (resultadoRemoto && resultadoRemoto.id) {
      subidoExitoso = true
      registroLocal.id = resultadoRemoto.id
      registroLocal.sincronizado = true

      // Actualizar listado local con UUID remoto y estado sincronizado
      const idxAct = listado.findIndex((e) => e.id === id || e.id === resultadoRemoto?.id)
      if (idxAct >= 0) {
        listado[idxAct] = registroLocal
      }
      pacientesStorageService.guardarItem(`evoluciones_notas_${pacienteId}`, listado)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('Fallo al subir evolución a Supabase, encolando en pendingEvoluciones:', msg)
  }

  // 3. Si no se subió con éxito, asegurar encolado en pendingEvoluciones
  if (!subidoExitoso) {
    encolarEvolucion({
      id,
      pacienteId,
      fecha: registroLocal.fecha,
      texto: registroLocal.texto,
      tipo: registroLocal.tipo
    })
  }

  return registroLocal
}

/**
 * Persiste el evento clínico de cierre únicamente en Supabase.
 * Esta ruta no usa caché local ni cola offline: la ficha no debe poder
 * marcar un procedimiento realizado si la evolución no quedó sincronizada.
 */
export const guardarEvolucionTratamientoRealizadoSincronizada = async (
  pacienteId: string,
  tratamientoRef: string,
  texto: string
): Promise<EvolucionClinicaLocal> => {
  const clinicaId = obtenerClinicaId()
  if (!USE_SUPABASE || !supabase || !esUUIDValido(pacienteId) || !clinicaId || !esUUIDValido(clinicaId) || !tratamientoRef.trim()) {
    throw new Error('El cierre requiere una sesión sincronizada, clínica y referencia válidas.')
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Inicia sesión nuevamente para registrar el cierre clínico.')

  const existente = await obtenerCierreRemoto(pacienteId, tratamientoRef, clinicaId)
  let remoto = existente

  if (remoto) {
    if (remoto.user_id !== user.id) {
      throw new Error('El cierre del tratamiento ya fue iniciado por otro profesional.')
    }
  } else {
    remoto = await guardarEvolucionSupabase(pacienteId, {
      fechaHora: new Date().toISOString(),
      texto,
      tipo: 'tratamiento_realizado',
      tratamientoRef
    })
    if (!remoto?.id || remoto.user_id !== user.id || remoto.clinica_id !== clinicaId) {
      throw new Error('No se pudo confirmar la evolución del tratamiento en DentikOS.')
    }
  }

  const sincronizada: EvolucionClinicaLocal = {
    ...transformarDesdeSupabase(remoto),
    sincronizado: true,
    pacienteId,
    clinicaId,
    tratamientoRef,
    tratamiento_ref: tratamientoRef
  }
  const evosLocales = pacientesStorageService.obtenerItem<EvolucionClinicaLocal[]>(
    `evoluciones_notas_${pacienteId}`,
    []
  )
  const actualizadas = Array.isArray(evosLocales) ? [...evosLocales] : []
  const index = actualizadas.findIndex((e) => e.id === sincronizada.id || (
    e.tipo === 'tratamiento_realizado' && (e.tratamientoRef || e.tratamiento_ref) === tratamientoRef
  ))
  if (index >= 0) actualizadas[index] = sincronizada
  else actualizadas.unshift(sincronizada)
  pacientesStorageService.guardarItem(`evoluciones_notas_${pacienteId}`, actualizadas)
  return sincronizada
}

/**
 * Guarda lote de evoluciones en Supabase + localStorage (F6-D-5)
 * Compatible con BitacoraSection y suites existentes.
 */
export const guardarEvoluciones = async (
  pacienteId: string,
  evoluciones: EvolucionClinicaLocal[]
): Promise<boolean> => {
  if (!pacienteId || !Array.isArray(evoluciones)) return false

  // F6-D-5: escribir localStorage PRIMERO (síncrono, inmediato)
  const result = pacientesStorageService.guardarItem(`evoluciones_notas_${pacienteId}`, evoluciones)

  // Luego sincronizar con Supabase (async, puede fallar sin perder datos)
  try {
    const promesas = evoluciones.map(async (evo) => {
      const evoSupabase = transformarHaciaSupabase(evo)
      if (!esUUIDValido(evo.id)) {
        delete evoSupabase.id
      }
      try {
        const res = await guardarEvolucionSupabase(pacienteId, evoSupabase)
        if (res && res.id) {
          evo.id = res.id
          evo.sincronizado = true
        } else {
          encolarEvolucion({ ...evo, pacienteId })
        }
      } catch (errEvo: unknown) {
        const msg = errEvo instanceof Error ? errEvo.message : String(errEvo)
        log.warn('Error guardando evolución en Supabase, encolando offline:', msg)
        encolarEvolucion({ ...evo, pacienteId })
      }
    })
    await Promise.all(promesas)
    // Refrescar listado con estados sincronizados
    pacientesStorageService.guardarItem(`evoluciones_notas_${pacienteId}`, evoluciones)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log.warn('Error guardando evoluciones en Supabase:', msg)
  }

  return result
}

/**
 * Procesa la cola de evoluciones pendientes para la clínica activa (P1-3).
 * Drenaje atómico y fail-closed: solo se retiran los elementos confirmados por Supabase.
 */
export const procesarColaEvoluciones = async (): Promise<{
  procesados: number
  fallidos: number
  razon?: string
}> => {
  const clinicaIdActual = obtenerClinicaId()
  if (!clinicaIdActual) {
    return { procesados: 0, fallidos: 0, razon: 'sin-clinica' }
  }

  const pending = obtenerPendingEvoluciones()
  if (!pending || pending.length === 0) {
    return { procesados: 0, fallidos: 0 }
  }

  let procesados = 0
  let fallidos = 0
  const procesadosExitososIds: (string | number)[] = []

  for (const item of pending) {
    const id = typeof item === 'object' && item !== null ? item.id : item
    const pacienteId = typeof item === 'object' && item !== null ? item.pacienteId : undefined
    const itemClinicaId: string | null = (typeof item === 'object' && item !== null ? item.clinicaId : null) || clinicaIdActual

    // Aislamiento multi-tenant: procesar solo si pertenece a la clínica activa
    if (itemClinicaId !== clinicaIdActual) {
      continue
    }

    try {
      // 1. Obtener evolución local
      const evosLocales = pacientesStorageService.obtenerItem<EvolucionClinicaLocal[]>(
        `evoluciones_notas_${pacienteId}`,
        []
      )
      const idx = (Array.isArray(evosLocales) ? evosLocales : []).findIndex((e) => e.id === id)
      const evoLocal = idx >= 0 ? evosLocales[idx] : (typeof item === 'object' && item !== null ? (item as EvolucionClinicaLocal) : null)

      if (!evoLocal) {
        // Ya no existe localmente, retirar de la cola
        procesadosExitososIds.push(id)
        continue
      }

      if (evoLocal.sincronizado && esUUIDValido(evoLocal.id)) {
        procesadosExitososIds.push(id)
        continue
      }

      // 2. Subir a Supabase
      const evoSupabase = transformarHaciaSupabase(evoLocal)
      if (!esUUIDValido(evoSupabase.id)) {
        delete evoSupabase.id
      }

      if (!pacienteId) {
        fallidos++
        continue
      }

      const res = await guardarEvolucionSupabase(pacienteId, evoSupabase)
      if (res && res.id) {
        // 3. Actualizar registro local con UUID definitivo y sincronizado: true
        if (idx >= 0) {
          evosLocales[idx] = {
            ...evoLocal,
            id: res.id,
            sincronizado: true
          }
          pacientesStorageService.guardarItem(`evoluciones_notas_${pacienteId}`, evosLocales)
        }
        procesadosExitososIds.push(id)
        procesados++
      } else {
        fallidos++
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log.warn(`Error al procesar evolución pendiente ${id}:`, msg)
      fallidos++
    }
  }

  // Drenaje selectivo (anti-race condition y fail-closed)
  if (procesadosExitososIds.length > 0) {
    const colaRestante = pending.filter((item) => {
      const id = typeof item === 'object' && item !== null ? item.id : item
      return !procesadosExitososIds.includes(id)
    })
    guardarPendingEvoluciones(colaRestante)
  }

  return { procesados, fallidos }
}

/**
 * Sincroniza evoluciones desde Supabase protegiendo contra la purga de datos offline (P1-3).
 * Descarga las evoluciones remotas, pero nunca sobreescribe ni descarta evoluciones locales
 * con sincronizado: false o registradas en pendingEvoluciones.
 */
export const sincronizarDesdeSupabase = async (
  pacienteId: string
): Promise<EvolucionClinicaLocal[]> => {
  if (!pacienteId) return []

  // 1. Identificar evoluciones locales protegidas
  const evosLocales = pacientesStorageService.obtenerItem<EvolucionClinicaLocal[]>(
    `evoluciones_notas_${pacienteId}`,
    []
  )
  const pending = obtenerPendingEvoluciones()
  const pendingIds = new Set(
    pending
      .filter((p) => typeof p === 'object' && p !== null && (!p.pacienteId || p.pacienteId === pacienteId))
      .map((p) => (typeof p === 'object' && p !== null ? p.id : p))
  )

  const protegidasLocales = (Array.isArray(evosLocales) ? evosLocales : []).filter(
    (e) => e.sincronizado === false || pendingIds.has(e.id)
  )

  // 2. Descargar evoluciones desde Supabase
  let remotas: EvolucionClinicaRow[] = []
  try {
    remotas = (await obtenerEvolucionesRemotas(pacienteId)) as unknown as EvolucionClinicaRow[]
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('Error al descargar evoluciones remotas en sincronizarDesdeSupabase:', msg)
    return evosLocales
  }

  // 3. Transformar remotas al formato local con sincronizado: true
  const remotasTransformadas: EvolucionClinicaLocal[] = (remotas || []).map((r) => ({
    ...transformarDesdeSupabase(r),
    sincronizado: true
  }))

  // 4. Fusionar: conservar todas las remotas + las protegidas locales no presentes en la nube
  const idsRemotos = new Set(remotasTransformadas.map((r) => r.id))
  const fusionadas = [...remotasTransformadas]

  for (const localProt of protegidasLocales) {
    if (!idsRemotos.has(localProt.id)) {
      fusionadas.unshift(localProt)
    }
  }

  // 5. Guardar en localStorage
  pacientesStorageService.guardarItem(`evoluciones_notas_${pacienteId}`, fusionadas)

  return fusionadas
}

/**
 * Elimina evoluciones de un paciente (solo localStorage, F2-07d)
 */
export const eliminarEvolucionesDePaciente = (pacienteId?: string | number | null): void => {
  if (!pacienteId) return
  pacientesStorageService.eliminarItem?.(`evoluciones_notas_${pacienteId}`)
}

export const evolucionesStorageService = {
  obtenerEvoluciones,
  guardarEvoluciones,
  guardarEvolucionClinica,
  guardarEvolucionTratamientoRealizadoSincronizada,
  procesarColaEvoluciones,
  sincronizarDesdeSupabase,
  obtenerPendingEvoluciones,
  guardarPendingEvoluciones,
  eliminarEvolucionesDePaciente
}
