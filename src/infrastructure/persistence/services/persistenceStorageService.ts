/**
 * Servicio de Persistencia y Copias de Seguridad (Backup / Restore)
 */
import { getClinicaActivaSync } from '../../auth/authService'
import { createLogger } from '../../logging/logger'

const log = createLogger('persistenceStorageService')
const BACKUP_VERSION = 2
const TENANT_STORAGE_PREFIX = 'sd_'

export interface BackupBaseDeDatos {
  versionSystem: string
  versionBackup?: number
  fechaExportacion: string
  clinicaId?: string
  localStorageData: Record<string, string | null>
}

const esObjetoPlano = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const prefijoTenant = (clinicaId: string): string => `${TENANT_STORAGE_PREFIX}${clinicaId}_`

const esClaveSensible = (key: string): boolean =>
  /(?:^|[-_])(auth|token|session|password|secret|credential)(?:$|[-_])/i.test(key)

const obtenerClavesGestionadas = (clinicaId: string): string[] => {
  if (typeof localStorage === 'undefined') return []
  const prefix = prefijoTenant(clinicaId)
  const keys: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix) && !esClaveSensible(key.slice(prefix.length))) {
      keys.push(key)
    }
  }

  return keys
}

const validarYNormalizarBackup = (
  jsonBackup: BackupBaseDeDatos,
  clinicaIdActiva: string
): Record<string, string> => {
  if (!esObjetoPlano(jsonBackup) || !esObjetoPlano(jsonBackup.localStorageData)) {
    throw new Error('El archivo de respaldo no tiene un formato válido de Studio Dental OS.')
  }

  if (jsonBackup.versionBackup !== undefined && jsonBackup.versionBackup !== BACKUP_VERSION) {
    throw new Error('La versión de este respaldo no es compatible con esta versión de la aplicación.')
  }

  const prefix = prefijoTenant(clinicaIdActiva)
  const backupClinicaId = typeof jsonBackup.clinicaId === 'string' ? jsonBackup.clinicaId : null

  if (jsonBackup.versionBackup === BACKUP_VERSION && !backupClinicaId) {
    throw new Error('El respaldo no identifica la clínica a la que pertenece.')
  }

  if (backupClinicaId && backupClinicaId !== clinicaIdActiva) {
    throw new Error('Este respaldo pertenece a otra clínica. Cambia a la clínica correspondiente para restaurarlo.')
  }

  const entries = Object.entries(jsonBackup.localStorageData)
  const tieneMetadataTenant = jsonBackup.versionBackup === BACKUP_VERSION && backupClinicaId !== null

  if (tieneMetadataTenant && backupClinicaId !== clinicaIdActiva) {
    throw new Error('El respaldo no corresponde a la clínica activa.')
  }

  const tenantEntries = entries.filter(([key]) => key.startsWith(prefix))

  if (!tieneMetadataTenant && entries.length > 0 && tenantEntries.length === 0) {
    throw new Error('El respaldo antiguo no contiene datos identificables de la clínica activa.')
  }

  const resultado: Record<string, string> = {}
  for (const [key, value] of entries) {
    if (!key.startsWith(prefix)) {
      if (tieneMetadataTenant) {
        throw new Error('El respaldo contiene datos fuera de la clínica indicada y no se puede restaurar.')
      }
      // Los respaldos antiguos podían incluir sesiones, preferencias y varias
      // clínicas. Se conservan solo las claves identificables del tenant actual.
      continue
    }

    if (esClaveSensible(key.slice(prefix.length))) continue
    if (value !== null && typeof value !== 'string') {
      throw new Error('El respaldo contiene un valor inválido y no se puede restaurar.')
    }
    if (typeof value === 'string') resultado[key] = value
  }

  return resultado
}

const reemplazarDatosTenant = (clinicaId: string, datos: Record<string, string>): void => {
  if (typeof localStorage === 'undefined') {
    throw new Error('El almacenamiento local no está disponible.')
  }

  const existentes = obtenerClavesGestionadas(clinicaId)
  const clavesNuevas = Object.keys(datos)
  const clavesTocadas = new Set([...existentes, ...clavesNuevas])
  const valoresAnteriores = new Map<string, string | null>()
  clavesTocadas.forEach((key) => valoresAnteriores.set(key, localStorage.getItem(key)))

  try {
    const clavesNuevasSet = new Set(clavesNuevas)
    existentes.forEach((key) => {
      if (!clavesNuevasSet.has(key)) localStorage.removeItem(key)
    })
    Object.entries(datos).forEach(([key, value]) => localStorage.setItem(key, value))
  } catch {
    // localStorage no ofrece transacciones. Si una escritura falla (por
    // ejemplo, por cuota), se intenta volver al estado previo antes de fallar.
    clavesTocadas.forEach((key) => {
      try {
        const anterior = valoresAnteriores.get(key)
        if (anterior === null || anterior === undefined) localStorage.removeItem(key)
        else localStorage.setItem(key, anterior)
      } catch (rollbackError: unknown) {
        log.error('No se pudo revertir completamente la restauración local:', rollbackError)
      }
    })
    throw new Error('No se pudo restaurar el respaldo. Los datos anteriores se conservaron cuando fue posible.')
  }

  window.dispatchEvent(new Event('storage'))
}

export const persistenceStorageService = {
  exportarBaseDeDatosCompleta: (): BackupBaseDeDatos => {
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId) {
      throw new Error('Selecciona una clínica activa antes de crear un respaldo.')
    }
    if (typeof localStorage === 'undefined') {
      throw new Error('El almacenamiento local no está disponible.')
    }

    const localStorageData: Record<string, string> = {}
    obtenerClavesGestionadas(clinicaId).forEach((key) => {
      const value = localStorage.getItem(key)
      if (value !== null) localStorageData[key] = value
    })

    return {
      versionSystem: '3.0.0',
      versionBackup: BACKUP_VERSION,
      fechaExportacion: new Date().toISOString(),
      clinicaId,
      localStorageData
    }
  },

  importarBaseDeDatosCompleta: (jsonBackup: BackupBaseDeDatos): void => {
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId) {
      throw new Error('Selecciona una clínica activa antes de restaurar un respaldo.')
    }

    const datos = validarYNormalizarBackup(jsonBackup, clinicaId)
    reemplazarDatosTenant(clinicaId, datos)
  },

}

export const descargarArchivoBackupJSON = (datos: unknown, nombreArchivo: string): void => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(datos, null, 2))
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute('href', dataStr)
  downloadAnchor.setAttribute('download', nombreArchivo)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  downloadAnchor.remove()
}
