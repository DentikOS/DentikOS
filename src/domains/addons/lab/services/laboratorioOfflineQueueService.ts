import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { estaOnline, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { EtapaLaboratorioId } from '../constants/laboratorioConstants'
import { laboratorioCloudService, type NuevaOrdenLaboratorioInput } from './laboratorioCloudService'

const log = createLogger('laboratorioOfflineQueue')
const queueRepo = createTenantRepository<PendingLaboratorioCommand[]>('studio_dental_laboratorio_pending', [])
let procesando = false

export type PendingLaboratorioCommand =
  | {
      idempotencyKey: string
      clinicaId: string
      queuedAt: string
      tipo: 'crear_orden'
      input: NuevaOrdenLaboratorioInput
      requiereRevision?: boolean
      errorCode?: string
    }
  | {
      idempotencyKey: string
      clinicaId: string
      queuedAt: string
      tipo: 'transicionar_etapa'
      input: {
        ordenId: string
        etapa: EtapaLaboratorioId
        notas?: string | null
        idempotencyKey: string
        versionEsperada: number
      }
      requiereRevision?: boolean
      errorCode?: string
    }

export interface ProcesarColaLaboratorioResult {
  procesados: number
  pendientes: number
  requiereRevision: number
  razon?: 'sin_clinica' | 'offline' | 'supabase_no_disponible' | 'cambio_clinica' | 'en_progreso'
}

const obtenerActuales = (clinicaEsperada?: string): PendingLaboratorioCommand[] => {
  const clinicaId = getClinicaActivaSync()
  if (!clinicaId || (clinicaEsperada && clinicaId !== clinicaEsperada)) return []
  return queueRepo.obtener([]).filter(item => item.clinicaId === clinicaId)
}

const guardarSiSigueEnClinica = (clinicaId: string, commands: PendingLaboratorioCommand[]): boolean => {
  if (getClinicaActivaSync() !== clinicaId) return false
  const existentes = queueRepo.obtener([]).filter(item => item.clinicaId === clinicaId)
  const ajenos = queueRepo.obtener([]).filter(item => item.clinicaId !== clinicaId)
  const keys = new Set(commands.map(item => item.idempotencyKey))
  const conservados = existentes.filter(item => keys.has(item.idempotencyKey))
  const merged = new Map([...ajenos, ...conservados, ...commands].map(item => [item.idempotencyKey, item]))
  return queueRepo.guardar([...merged.values()])
}

export const laboratorioOfflineQueueService = {
  obtenerPendientes(): PendingLaboratorioCommand[] {
    return obtenerActuales()
  },

  encolar(command: Omit<PendingLaboratorioCommand, 'clinicaId' | 'queuedAt'> & { clinicaId?: string }): boolean {
    const clinicaActual = getClinicaActivaSync()
    const clinicaId = command.clinicaId || clinicaActual
    if (!clinicaId || clinicaId !== clinicaActual) return false
    const current = queueRepo.obtener([])
    if (current.some(item => item.idempotencyKey === command.idempotencyKey && item.clinicaId === clinicaId)) {
      return true
    }
    const normalized = {
      ...command,
      clinicaId,
      queuedAt: new Date().toISOString(),
      requiereRevision: false,
      errorCode: undefined
    } as PendingLaboratorioCommand
    return queueRepo.guardar([...current, normalized])
  },

  async procesarPendientes(): Promise<ProcesarColaLaboratorioResult> {
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId) return { procesados: 0, pendientes: 0, requiereRevision: 0, razon: 'sin_clinica' }
    if (!USE_SUPABASE) return { procesados: 0, pendientes: obtenerActuales(clinicaId).length, requiereRevision: 0, razon: 'supabase_no_disponible' }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const pending = obtenerActuales(clinicaId)
      return { procesados: 0, pendientes: pending.length, requiereRevision: pending.filter(item => item.requiereRevision).length, razon: 'offline' }
    }
    if (procesando) return { procesados: 0, pendientes: obtenerActuales(clinicaId).length, requiereRevision: 0, razon: 'en_progreso' }
    if (!(await estaOnline())) {
      const pending = obtenerActuales(clinicaId)
      return { procesados: 0, pendientes: pending.length, requiereRevision: pending.filter(item => item.requiereRevision).length, razon: 'offline' }
    }

    procesando = true
    let procesados = 0
    try {
      for (const command of obtenerActuales(clinicaId)) {
        if (getClinicaActivaSync() !== clinicaId) {
          return { procesados, pendientes: obtenerActuales().length, requiereRevision: 0, razon: 'cambio_clinica' }
        }
        if (command.requiereRevision) continue
        try {
          if (command.tipo === 'crear_orden') await laboratorioCloudService.crearOrden(command.input)
          else await laboratorioCloudService.transicionarEtapa(command.input)
          if (getClinicaActivaSync() !== clinicaId) {
            return { procesados, pendientes: obtenerActuales().length, requiereRevision: 0, razon: 'cambio_clinica' }
          }
          const remaining = obtenerActuales(clinicaId).filter(item => item.idempotencyKey !== command.idempotencyKey)
          if (!guardarSiSigueEnClinica(clinicaId, remaining)) {
            return { procesados, pendientes: obtenerActuales().length, requiereRevision: 0, razon: 'cambio_clinica' }
          }
          procesados += 1
        } catch (error) {
          const code = typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : 'SYNC_FAILED'
          if (['STALE_VERSION', 'IDEMPOTENCY_CONFLICT', 'INVALID_REFERENCE', 'WRITE_REJECTED'].includes(code)) {
            const marked = obtenerActuales(clinicaId).map(item => item.idempotencyKey === command.idempotencyKey
              ? { ...item, requiereRevision: true, errorCode: code }
              : item)
            guardarSiSigueEnClinica(clinicaId, marked)
          }
          log.warn(`No se pudo sincronizar una orden de laboratorio (${code})`)
        }
      }
    } finally {
      procesando = false
    }

    const pendientes = obtenerActuales(clinicaId)
    return {
      procesados,
      pendientes: pendientes.length,
      requiereRevision: pendientes.filter(item => item.requiereRevision).length
    }
  }
}
