import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'

export type TipoComandoUrgencia = 'ingreso' | 'triage' | 'ficha' | 'enmienda'

export interface ComandoUrgenciaPendiente {
  /** ID exclusivo del comando almacenado localmente. */
  id: string
  /** ID del ingreso/ficha en Supabase; puede repetirse entre tipos de comando. */
  recordId: string
  clinicaId: string
  actorUserId: string
  createdAtLocal: string
  kind: TipoComandoUrgencia
  payload: Record<string, unknown> & { id: string; clinica_id: string }
  attempts: number
  lastErrorCode?: string
}

const REPO = createTenantRepository<ComandoUrgenciaPendiente[]>(
  'studio_dental_urgencias_ges_pending',
  []
)

export const validarContextoPendiente = (
  comando: ComandoUrgenciaPendiente,
  clinicaActiva: string | null,
  usuarioAutenticado: string | null
): void => {
  if (!clinicaActiva || comando.clinicaId !== clinicaActiva || comando.payload.clinica_id !== comando.clinicaId) {
    throw new Error('La clínica activa no coincide con la clínica del comando pendiente')
  }
  if (!usuarioAutenticado || comando.actorUserId !== usuarioAutenticado) {
    throw new Error('El usuario autenticado no coincide con quien creó el comando pendiente')
  }
  if (comando.recordId !== comando.payload.id) {
    throw new Error('El identificador del comando pendiente no coincide con su registro')
  }
}

const leer = (): ComandoUrgenciaPendiente[] => REPO.obtener([]) || []

export const obtenerComandosPendientes = (
  clinicaId: string | null = getClinicaActivaSync()
): ComandoUrgenciaPendiente[] => {
  if (!clinicaId || clinicaId !== getClinicaActivaSync()) return []
  return leer().filter((comando) => comando.clinicaId === clinicaId)
}

export const guardarComandoPendiente = (
  comando: ComandoUrgenciaPendiente,
  usuarioAutenticado: string | null
): ComandoUrgenciaPendiente => {
  const clinicaActiva = getClinicaActivaSync()
  validarContextoPendiente(comando, clinicaActiva, usuarioAutenticado)

  const actuales = leer()
  const existente = actuales.find((item) => item.kind === comando.kind && item.recordId === comando.recordId)
  if (existente) {
    if (JSON.stringify(existente.payload) !== JSON.stringify(comando.payload)) {
      throw new Error('El identificador pendiente ya está asociado a otros datos')
    }
    return existente
  }

  if (!REPO.guardar([...actuales, comando])) {
    throw new Error('No se pudo conservar el comando para sincronización')
  }
  return comando
}

export const registrarIntentoFallido = (id: string, errorCode = 'network'): void => {
  const actuales = leer()
  const actualizadas = actuales.map((item) => item.id === id
    ? { ...item, attempts: item.attempts + 1, lastErrorCode: errorCode.slice(0, 40) }
    : item)
  REPO.guardar(actualizadas)
}

export const retirarComandoPendiente = (id: string): void => {
  const actualizadas = leer().filter((item) => item.id !== id)
  if (actualizadas.length === 0) REPO.eliminar()
  else REPO.guardar(actualizadas)
}
