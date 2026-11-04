/**
 * Persistencia aislada en LocalStorage para Arancel y Paquetes Clínicos
 *
 * F2-04d: Integración de validación con prestacionSchema antes de persistir
 * el arancel, siguiendo el patrón establecido en pacientesStorageService (F2-04),
 * agendaStorageService (F2-04b) y finanzasStorageService (F2-04c).
 * Rechaza datos malformados antes de escribirlos a localStorage,
 * evitando corrupción silenciosa del arancel.
 *
 * Nota: paquetes aún no tiene esquema de validación (posible tarea derivada
 * futura si se requiere).
 */
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { validarListaPrestaciones, type Prestacion } from '../schemas/prestacionSchema'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('prestacionesStorageService')

export type { Prestacion }

export interface PaqueteClinico {
  id: number | string
  nombre: string
  descripcion?: string
  precioCombo?: number
  ahorroEstimado?: string
  pendienteCompartir?: boolean
  [key: string]: unknown
}

const STORAGE_KEY_ARANCEL = 'clinica_arancel_prestaciones'
const STORAGE_KEY_PAQUETES = 'clinica_paquetes_clinicos_promos'

// F7-36 FASE 1 (Commit 1.5e): migrados a createTenantRepository para aislamiento multi-tenant.
// Claves con prefijo clinica_ ahora: sd_<clinicaId>_clinica_arancel_prestaciones, sd_<clinicaId>_clinica_paquetes_clinicos_promos
const arancelRepo = createTenantRepository<Prestacion[] | undefined>(STORAGE_KEY_ARANCEL, undefined)
const paquetesRepo = createTenantRepository<PaqueteClinico[] | undefined>(STORAGE_KEY_PAQUETES, undefined)

export const prestacionesStorageService = {
  // Arancel — con validación F2-04d
  obtenerPrestaciones: (defaults?: Prestacion[]): Prestacion[] | undefined => arancelRepo.obtener(defaults),

  /**
   * Valida la lista de prestaciones con prestacionSchema antes de persistir.
   * Si la validación falla, NO escribe en localStorage y retorna false.
   * Si la validación pasa, persiste los datos validados y retorna true.
   *
   * @param {Prestacion[] | null | undefined} prestaciones - Lista de prestaciones a persistir.
   * @returns {boolean} true si se guardó exitosamente, false si la validación falló.
   */
  guardarPrestaciones: (prestaciones?: Prestacion[] | null): boolean => {
    // Si es undefined o null, permite guardar (caso inicial sin arancel)
    if (prestaciones == null) {
      return arancelRepo.guardar(prestaciones ?? undefined)
    }
    const validacion = validarListaPrestaciones(prestaciones)
    if (!validacion.valido || !validacion.datos) {
      log.error(
        'Error de validación al guardar arancel de prestaciones (F2-04d):',
        validacion.error
      )
      return false
    }
    return arancelRepo.guardar(validacion.datos)
  },

  // Paquetes clínicos (sin validación por ahora, posible tarea futura)
  obtenerPaquetes: (defaults?: PaqueteClinico[]): PaqueteClinico[] | undefined => paquetesRepo.obtener(defaults),
  guardarPaquetes: (paquetes?: PaqueteClinico[] | null): boolean => paquetesRepo.guardar(paquetes ?? undefined)
}
