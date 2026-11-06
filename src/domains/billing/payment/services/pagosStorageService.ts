/**
 * Persistencia de Pagos (F4-02c-5 — migración a Supabase).
 *
 * Estrategia de "caché local + sync en background":
 * - Pagos globales (historial completo) → migrados a Supabase
 * - Abonos por paciente (claves dinámicas) → siguen en localStorage (F4-02d)
 *
 * API pública:
 * - obtenerPagos()                    → SÍNCRONO, retorna de caché en memoria
 * - guardarPagos()                    → ASYNC, escribe en Supabase + actualiza caché
 * - sincronizarDesdeSupabase()        → ASYNC, refresca caché desde Supabase
 * - registrarPago()                   → ASYNC, offline-first con cola pendingPagos
 * - procesarColaPagos()               → ASYNC, procesa pagos y deletes pendientes
 * - resetCache()                      → limpia caché (para tests)
 */
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { transformarParaSupabase } from './pagosTransformations'
import { createLogger } from '../../../../infrastructure/logging/logger'
import {
  registrarPagoHelper,
  procesarColaPagosHelper,
  sincronizarPagosDesdeSupabaseHelper,
  eliminarPagoHelper,
  obtenerPendingPagos,
  guardarPendingPagos,
  obtenerPendingDeletesPagos,
  guardarPendingDeletesPagos
} from './pagosOfflineQueueService'

export interface Pago {
  id: string | number
  folioComprobante?: string
  folio?: string
  tipoDTE?: string
  folioDTE?: string | null
  pacienteId?: string | number
  paciente_id?: string | number
  pacienteNombre?: string
  pacienteRut?: string
  fecha?: string
  hora?: string
  monto?: number
  metodoPago?: string
  metodo_pago?: string
  moneda?: string
  concepto?: string
  estado?: string
  prestacionesImputadas?: string[]
  emitidoPor?: string
  observacion?: string
  sincronizado?: boolean
  clinicaId?: string | null
  clinica_id?: string | null
  userId?: string
  user_id?: string
  motivoPurga?: string | null
  fechaPurga?: string | null
  purgadoPor?: string | null
  motivoAnulacion?: string
  fechaAnulacion?: string
  [key: string]: unknown
}

export interface PacienteRef {
  id: string | number
  nombre?: string
  rut?: string
  [key: string]: unknown
}

export interface AbonoRef {
  id: string | number
  monto?: number | string
  fecha?: string
  metodoPago?: string
  pacienteNombre?: string
  [key: string]: unknown
}

export interface ProcesarColaResult {
  procesados: number
  fallidos: number
  borradoresEfectivo?: number
  razon?: string
  offline?: boolean
  [key: string]: unknown
}

const log = createLogger('pagosStorageService')

const STORAGE_KEY_PAGOS = 'studio_dental_pagos_historial_v3'
const pagosRepo = createTenantRepository<Pago[]>(STORAGE_KEY_PAGOS, [])

// Caché en memoria
let pagosCache: Pago[] | null = null
let cacheInicializado = false

const inicializarCache = (defaults: Pago[]): void => {
  if (cacheInicializado) return
  const datos = pagosRepo.obtener(defaults)
  pagosCache = Array.isArray(datos) ? datos : defaults
  cacheInicializado = true
}

export const obtenerPagos = (defaults: Pago[] = []): Pago[] => {
  if (!cacheInicializado) {
    inicializarCache(defaults)
  }
  return pagosCache || defaults
}

const actualizarPagosLocal = (nuevosPagos: Pago[]): void => {
  pagosCache = nuevosPagos
  cacheInicializado = true
  pagosRepo.guardar(nuevosPagos)
}

export const sincronizarDesdeSupabase = async (): Promise<Pago[]> => {
  return sincronizarPagosDesdeSupabaseHelper({
    obtenerPagos,
    actualizarPagosLocal,
    pagosRepo
  })
}

export const registrarPago = async (pago: Pago): Promise<Pago | null> => {
  return registrarPagoHelper(pago, {
    obtenerPagos,
    actualizarPagosLocal
  })
}

export const procesarColaPagos = async (): Promise<ProcesarColaResult> => {
  return procesarColaPagosHelper({
    obtenerPagos,
    actualizarPagosLocal
  })
}

export const eliminarPago = async (pagoId: string | number): Promise<boolean> => {
  return eliminarPagoHelper(pagoId, {
    obtenerPagos,
    actualizarPagosLocal
  })
}

export {
  obtenerPendingPagos,
  guardarPendingPagos,
  obtenerPendingDeletesPagos,
  guardarPendingDeletesPagos
}

export const guardarPagos = async (pagos: Pago[]): Promise<boolean> => {
  if (!Array.isArray(pagos)) {
    log.error('guardarPagos: se esperaba un array')
    return false
  }

  // 1. Actualizar caché en memoria inmediatamente
  pagosCache = pagos
  cacheInicializado = true

  // 2. Persistir en localStorage como caché
  pagosRepo.guardar(pagos)

  if (!USE_SUPABASE || !supabase) {
    return true
  }

  // 3. Sincronizar con Supabase en background
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return true
    }

    const aInsertar: Pago[] = []
    const aActualizar: Pago[] = []

    for (const pago of pagos) {
      if (esUuidValido(pago.id)) {
        aActualizar.push(pago)
      } else {
        aInsertar.push(pago)
      }
    }

    // UPDATE en batch
    if (aActualizar.length > 0) {
      const paraUpdate = aActualizar.map((p) => ({
        ...(transformarParaSupabase(p as unknown as Record<string, unknown>) || {}),
        user_id: user.id
      }))

      const { error: updateError } = await supabase
        .from('pagos')
        .upsert(paraUpdate, { onConflict: 'id' })

      if (updateError) {
        log.error('Error al actualizar en Supabase:', updateError.message)
      }
    }

    // INSERT uno por uno
    for (const pago of aInsertar) {
      const paraInsert: Record<string, unknown> = {
        ...(transformarParaSupabase(pago as unknown as Record<string, unknown>) || {}),
        user_id: user.id
      }
      delete paraInsert.id

      const { data: insertado, error: insertError } = await supabase
        .from('pagos')
        .insert(paraInsert)
        .select('id')
        .single()

      if (insertError) {
        log.error('Error al insertar pago:', insertError.message)
        continue
      }

      // Actualizar el pago en caché con el nuevo UUID
      if (pagosCache && insertado?.id) {
        const index = pagosCache.findIndex((p) => !esUuidValido(p.id) &&
          p.folio === pago.folio && p.monto === pago.monto)
        if (index >= 0) {
          const legacyId = pagosCache[index].id
          pagosCache[index] = { ...pagosCache[index], id: insertado.id }
          migrationStorageService.registrarMapeo(legacyId, insertado.id)
        }
      }
    }

    // Persistir la caché actualizada
    if (pagosCache) {
      pagosRepo.guardar(pagosCache)
    }

    return true
  } catch (error) {
    log.error('Excepción al guardar en Supabase:', error)
    return true
  }
}

export const resetCache = (): void => {
  pagosCache = null
  cacheInicializado = false
}

export const purgarPago = (pagoId: string | number, motivo: string, userId: string | null = null): boolean => {
  const actuales = pagosCache || pagosRepo.obtener([])
  const pago = actuales.find((p) => String(p.id) === String(pagoId))
  if (!pago) {
    log.warn(`purgarPago: pago ${pagoId} no encontrado`)
    return false
  }
  const actualizados = actuales.map((p) =>
    String(p.id) === String(pagoId)
      ? { ...p, estado: 'Purgado', motivoPurga: motivo, fechaPurga: new Date().toLocaleDateString('es-CL'), purgadoPor: userId }
      : p
  )
  pagosCache = actualizados
  pagosRepo.guardar(actualizados)
  log.warn(`[AUDITORÍA] Purga: id=${pagoId}, folio=${pago.folioComprobante || 's/d'}, monto=${pago.monto}, motivo="${motivo}", userId=${userId}, fecha=${new Date().toISOString()}`)
  if (USE_SUPABASE && supabase && esUuidValido(pagoId)) {
    supabase.from('pagos').update({ estado: 'Purgado' }).eq('id', pagoId)
      .then(({ error }) => { if (error) log.error('Error purgando Supabase:', error) })
  }
  return true
}

export const crearPagoDesdeAbono = (paciente: PacienteRef | null | undefined, abono: AbonoRef | null | undefined): boolean => {
  if (!paciente?.id || !abono?.id) {
    log.warn('crearPagoDesdeAbono: paciente o abono inválido')
    return false
  }

  const actuales = pagosCache || pagosRepo.obtener([])
  const existe = actuales.some((p) => String(p.id) === String(abono.id))
  if (existe) {
    log.info(`crearPagoDesdeAbono: pago ${abono.id} ya existe, omitiendo`)
    return true
  }

  const año = new Date().getFullYear()
  const secuencia = String(Date.now()).slice(-4)
  const folioComprobante = `REC-${año}-${secuencia}`

  const nuevoPago: Pago = {
    id: abono.id,
    folioComprobante,
    tipoDTE: 'recibo_interno',
    folioDTE: null,
    pacienteId: paciente.id,
    pacienteNombre: paciente.nombre || abono.pacienteNombre || '',
    pacienteRut: paciente.rut || '',
    fecha: abono.fecha || new Date().toLocaleDateString('es-CL'),
    hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    monto: parseInt(String(abono.monto || 0), 10),
    metodoPago: abono.metodoPago || 'Efectivo',
    concepto: 'Abono Plan de Tratamiento',
    estado: 'Emitido',
    prestacionesImputadas: [],
    emitidoPor: 'Sistema (desde Ficha Clínica)',
    observacion: 'Abono registrado desde Plan de Tratamiento del paciente'
  }

  const actualizados = [nuevoPago, ...actuales]
  pagosCache = actualizados
  pagosRepo.guardar(actualizados)

  log.info(`crearPagoDesdeAbono: pago ${folioComprobante} creado para paciente ${paciente.nombre}`)
  return true
}

export const obtenerPagosParaAuditoria = (): Pago[] => pagosCache || pagosRepo.obtener([])

export const pagosStorageService = {
  obtenerPagos,
  guardarPagos,
  sincronizarDesdeSupabase,
  resetCache,
  eliminarPago,
  purgarPago,
  crearPagoDesdeAbono,
  obtenerPagosParaAuditoria,
  registrarPago,
  procesarColaPagos,
  obtenerPendingPagos,
  guardarPendingPagos,
  obtenerPendingDeletesPagos,
  guardarPendingDeletesPagos
}
