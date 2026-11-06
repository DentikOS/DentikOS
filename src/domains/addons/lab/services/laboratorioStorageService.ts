/**
 * Persistencia en LocalStorage para Órdenes y Directorio de Laboratorios
 */
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import type { OrdenLaboratorio, LaboratorioBase } from '../constants/laboratorioConstants'
import type { LaboratorioSnapshot } from './laboratorioCloudService'

const STORAGE_KEY_ORDENES = 'studio_dental_laboratorio_ordenes'
const STORAGE_KEY_LABS = 'studio_dental_laboratorio_directorio'
const STORAGE_KEY_CACHE_BP12 = 'studio_dental_laboratorio_cache_bp12'

// F7-36 FASE 1 (Commit 1.5d): migrados a createTenantRepository para aislamiento multi-tenant.
// Claves legacy ahora: sd_<clinicaId>_studio_dental_laboratorio_*
const ordenesRepo = createTenantRepository<OrdenLaboratorio[]>(STORAGE_KEY_ORDENES, [])
const laboratoriosRepo = createTenantRepository<LaboratorioBase[]>(STORAGE_KEY_LABS, [])
const snapshotRepo = createTenantRepository<CachedLaboratorioSnapshot | null>(STORAGE_KEY_CACHE_BP12, null)

export interface CachedLaboratorioSnapshot {
  clinicaId: string
  cachedAt: string
  snapshot: LaboratorioSnapshot
}

export const laboratorioStorageService = {
  obtenerOrdenes: (defaults?: OrdenLaboratorio[]): OrdenLaboratorio[] => ordenesRepo.obtener(defaults),
  guardarOrdenes: (ordenes: OrdenLaboratorio[]): boolean => ordenesRepo.guardar(ordenes),

  obtenerLaboratorios: (defaults?: LaboratorioBase[]): LaboratorioBase[] => laboratoriosRepo.obtener(defaults),
  guardarLaboratorios: (labs: LaboratorioBase[]): boolean => laboratoriosRepo.guardar(labs),

  obtenerSnapshotCache(clinicaId?: string | null): CachedLaboratorioSnapshot | null {
    const actual = getClinicaActivaSync()
    if (!actual || !clinicaId || actual !== clinicaId) return null
    const cached = snapshotRepo.obtener(null)
    return cached?.clinicaId === actual ? cached : null
  },

  guardarSnapshotCache(clinicaId: string, snapshot: LaboratorioSnapshot): boolean {
    if (!clinicaId || getClinicaActivaSync() !== clinicaId) return false
    return snapshotRepo.guardar({ clinicaId, cachedAt: new Date().toISOString(), snapshot })
  }
}
