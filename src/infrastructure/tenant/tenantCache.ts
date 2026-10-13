/**
 * tenantCache — Helper para aislamiento de caché por clínica (F7-36 FASE 1)
 *
 * Resuelve el problema de caché compartida entre clínicas en un entorno
 * multi-tenant. Todas las claves de localStorage que manejan datos de
 * negocio deben usar este helper para garantizar aislamiento.
 *
 * Formato de clave: sd_<clinicaId>_<baseKey>
 *
 * Principios:
 * 1. Fail-safe: si no hay clínica activa, no se permite acceso a cache tenant
 * 2. Aislamiento estricto: datos de clínica A nunca visibles en clínica B
 * 3. Invalidación explícita: al cambiar de clínica o logout, limpiar cache
 * 4. Backward compatible: no rompe servicios existentes que aún no migraron
 *
 * Uso:
 *   import { tenantCache } from './tenantCache'
 *   const datos = tenantCache.leerTenant('pacientes_v3', [])
 *   tenantCache.escribirTenant('pacientes_v3', nuevosDatos)
 */

import { getClinicaActivaSync } from '../auth/authService'
import { createLogger } from '../logging/logger'

const log = createLogger('tenantCache')
const PREFIX = 'sd'

export interface TenantCacheInstance {
  claveTenant: (baseKey: string) => string
  leerTenant: <T>(baseKey: string, fallback?: T) => T
  escribirTenant: (baseKey: string, value: unknown) => boolean
  existeTenant: (baseKey: string) => boolean
  eliminarTenant: (baseKey: string) => boolean
  invalidarClinica: (clinicaId: string) => number
  invalidarTodas: () => number
  listarClavesTenant: () => string[]
  getClinicaId?: () => string | null
}

/**
 * Crea una instancia de tenantCache con un getter de clinicaId inyectable.
 * Permite testing sin depender de authService real.
 *
 * @param getClinicaId - Función que retorna el clinica_id activo
 * @returns API de tenantCache
 */
export const createTenantCache = (getClinicaId: () => string | null): TenantCacheInstance => {
  /**
   * Genera la clave de localStorage para un tenant específico.
   * @param baseKey - Clave base del servicio (ej: 'pacientes_v3')
   * @returns Clave completa con tenant (ej: 'sd_<clinicaId>_pacientes_v3')
   * @throws Si no hay clínica activa
   */
  const claveTenant = (baseKey: string): string => {
    const clinicaId = getClinicaId()
    if (!clinicaId) {
      throw new Error(
        'tenantCache: no hay clínica activa. ' +
        'No se puede acceder a cache tenant-aware sin contexto de clínica.'
      )
    }
    return `${PREFIX}_${clinicaId}_${baseKey}`
  }

  /**
   * Lee datos de cache tenant-aware de forma segura.
   * @param baseKey - Clave base
   * @param fallback - Valor a retornar si no existe o falla parseo
   * @returns Datos parseados o fallback
   */
  const leerTenant = <T>(baseKey: string, fallback: T = null as unknown as T): T => {
    try {
      const clave = claveTenant(baseKey)
      const saved = localStorage.getItem(clave)
      return saved !== null ? (JSON.parse(saved) as T) : fallback
    } catch (e: unknown) {
      log.error(`Error leyendo cache tenant para "${baseKey}":`, e)
      return fallback
    }
  }

  /**
   * Escribe datos en cache tenant-aware de forma segura.
   * @param baseKey - Clave base
   * @param value - Valor serializable a guardar
   * @returns true si fue exitoso, false si falló
   */
  const escribirTenant = (baseKey: string, value: unknown): boolean => {
    try {
      const clave = claveTenant(baseKey)
      localStorage.setItem(clave, JSON.stringify(value))
      return true
    } catch (e: unknown) {
      log.error(`Error escribiendo cache tenant para "${baseKey}":`, e)
      return false
    }
  }

  /**
   * Verifica si existe una clave tenant-aware en localStorage.
   * @param baseKey - Clave base
   * @returns true si existe
   */
  const existeTenant = (baseKey: string): boolean => {
    try {
      const clave = claveTenant(baseKey)
      return localStorage.getItem(clave) !== null
    } catch {
      return false
    }
  }

  /**
   * Elimina una clave tenant-aware específica.
   * @param baseKey - Clave base
   * @returns true si fue eliminada, false si no existía
   */
  const eliminarTenant = (baseKey: string): boolean => {
    try {
      const clave = claveTenant(baseKey)
      const existia = localStorage.getItem(clave) !== null
      localStorage.removeItem(clave)
      return existia
    } catch (e: unknown) {
      log.error(`Error eliminando cache tenant para "${baseKey}":`, e)
      return false
    }
  }

  /**
   * Invalida todas las claves de una clínica específica.
   * Usado al cambiar de clínica activa.
   * @param clinicaId - ID de la clínica a invalidar
   * @returns Cantidad de claves eliminadas
   */
  const invalidarClinica = (clinicaId: string): number => {
    const patron = `${PREFIX}_${clinicaId}_`
    let eliminadas = 0
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(patron)) {
          localStorage.removeItem(key)
          eliminadas++
        }
      })
      log.info(`Invalidadas ${eliminadas} claves de clínica ${clinicaId}`)
    } catch (e: unknown) {
      log.error(`Error invalidando clínica ${clinicaId}:`, e)
    }
    return eliminadas
  }

  /**
   * Invalida TODAS las claves tenant-aware de TODAS las clínicas.
   * Usado en logout completo.
   * @returns Cantidad de claves eliminadas
   */
  const invalidarTodas = (): number => {
    const patron = `${PREFIX}_`
    let eliminadas = 0
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(patron)) {
          localStorage.removeItem(key)
          eliminadas++
        }
      })
      log.info(`Invalidadas ${eliminadas} claves tenant (logout)`)
    } catch (e: unknown) {
      log.error('Error invalidando todas las claves tenant:', e)
    }
    return eliminadas
  }

  /**
   * Lista todas las claves tenant-aware actualmente en localStorage.
   * Útil para debugging y auditoría.
   * @returns Array de claves
   */
  const listarClavesTenant = (): string[] => {
    try {
      return Object.keys(localStorage).filter((key) => key.startsWith(`${PREFIX}_`))
    } catch {
      return []
    }
  }

  return {
    claveTenant,
    leerTenant,
    escribirTenant,
    existeTenant,
    eliminarTenant,
    invalidarClinica,
    invalidarTodas,
    listarClavesTenant,
    getClinicaId
  }
}

/**
 * Instancia por defecto de tenantCache que usa authService.getClinicaActivaSync().
 * Usa la versión síncrona porque tenantCache se invoca en contextos
 * que no soportan await (storage repositories, claves de localStorage).
 */
export const tenantCache = createTenantCache(getClinicaActivaSync)
