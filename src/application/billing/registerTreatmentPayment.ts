/**
 * Application Service: registerTreatmentPayment (Fase 4C-1)
 *
 * Unifica el registro y la eliminación de pagos/abonos de tratamiento,
 * resolviendo el ciclo de dependencia Pacientes ↔ Pagos.
 *
 * Sincroniza bidireccionalmente:
 * 1. Abonos locales de la ficha del paciente (`abonos_${pacienteId}`)
 * 2. Pagos globales en `pagosStorageService`
 *
 * Consume EXCLUSIVAMENTE las APIs públicas de los dominios:
 * - domains/clinical/patient
 * - domains/billing/payment
 */
import {
  pacientesStorageService,
} from '../../domains/clinical/patient'
import {
  pagosStorageService,
  crearPagoDesdeAbono,
  type Pago,
} from '../../domains/billing/payment'
import { createLogger } from '../../infrastructure/logging/logger'

const log = createLogger('registerTreatmentPayment')

export interface AbonoItem {
  id: string | number
  fecha?: string
  monto: number | string
  metodoPago?: string
  pacienteNombre?: string
  [key: string]: unknown
}

export interface PacienteRef {
  id: string | number
  nombre?: string
  rut?: string
  [key: string]: unknown
}

export interface RegistrarAbonoParams {
  paciente: PacienteRef
  monto: number | string
  metodoPago?: string
  fecha?: string
  abonosPrevios?: AbonoItem[]
}

export interface RegistrarAbonoResult {
  abono: AbonoItem
  abonosActualizados: AbonoItem[]
}

export interface EliminarAbonoParams {
  pacienteId: string | number
  idAbono: string | number
  abonosPrevios?: AbonoItem[]
}

export interface EliminarAbonoResult {
  success: boolean
  pagoGlobalAnulado: boolean
  abonosActualizados: AbonoItem[]
}

/**
 * Obtiene los abonos registrados en la ficha de un paciente.
 */
export const obtenerAbonosPaciente = (pacienteId: string | number): AbonoItem[] => {
  if (!pacienteId) return []
  try {
    const abonos = pacientesStorageService.obtenerItem(`abonos_${pacienteId}`, [])
    return Array.isArray(abonos) ? abonos : []
  } catch {
    return []
  }
}

/**
 * Detecta si un abono de paciente está vinculado a un pago global en el módulo Pagos.
 */
export const obtenerPagoAsociadoAAbono = (
  idAbono: string | number,
  pacienteId: string | number
): Pago | null => {
  if (!idAbono || !pacienteId) return null
  try {
    const pagos: Pago[] = pagosStorageService.obtenerPagos([])
    return (
      pagos.find(
        (p) =>
          String(p.id) === String(idAbono) &&
          String(p.pacienteId) === String(pacienteId) &&
          p.estado !== 'Anulado'
      ) || null
    )
  } catch {
    return null
  }
}

/**
 * Registra un nuevo abono para un paciente:
 * 1. Crea el abono y lo persiste en la ficha del paciente
 * 2. Sincroniza un nuevo comprobante en el módulo de Pagos globales
 */
export const registrarPagoTratamiento = ({
  paciente,
  monto,
  metodoPago = 'Efectivo',
  fecha,
  abonosPrevios,
}: RegistrarAbonoParams): RegistrarAbonoResult => {
  const montoNumerico = parseInt(String(monto), 10) || 0
  const fechaAbono = fecha || new Date().toLocaleDateString('es-CL')

  const abonoObj: AbonoItem = {
    id: Date.now(),
    fecha: fechaAbono,
    monto: montoNumerico,
    metodoPago,
    pacienteNombre: paciente.nombre || '',
  }

  const prev =
    abonosPrevios !== undefined
      ? abonosPrevios
      : obtenerAbonosPaciente(paciente.id)

  const abonosActualizados = [abonoObj, ...prev]

  // Persistir en ficha del paciente
  pacientesStorageService.guardarItem(`abonos_${paciente.id}`, abonosActualizados)

  // Sincronizar en módulo Pagos (crea recibo interno)
  try {
    crearPagoDesdeAbono(paciente, abonoObj)
  } catch (err) {
    log.error('Error al sincronizar pago global desde abono:', err)
  }

  return {
    abono: abonoObj,
    abonosActualizados,
  }
}

/**
 * Elimina un abono de la ficha del paciente y, si estaba sincronizado con Pagos globales,
 * anula el registro de pago correspondiente en lugar de dejar datos inconsistentes.
 */
export const eliminarPagoTratamiento = async ({
  pacienteId,
  idAbono,
  abonosPrevios,
}: EliminarAbonoParams): Promise<EliminarAbonoResult> => {
  if (!pacienteId || !idAbono) {
    return {
      success: false,
      pagoGlobalAnulado: false,
      abonosActualizados: abonosPrevios || [],
    }
  }

  let pagoGlobalAnulado = false

  try {
    // 1. Detectar si el abono corresponde a un pago global sincronizado
    const pagos: Pago[] = pagosStorageService.obtenerPagos([])
    const pagoAsociado = pagos.find(
      (p) =>
        String(p.id) === String(idAbono) &&
        String(p.pacienteId) === String(pacienteId) &&
        p.estado !== 'Anulado'
    )

    if (pagoAsociado) {
      const pagosActualizados: Pago[] = pagos.map((p) =>
        String(p.id) === String(idAbono)
          ? {
              ...p,
              estado: 'Anulado',
              motivoAnulacion: 'Abono eliminado desde Plan de Tratamiento',
              fechaAnulacion: new Date().toLocaleDateString('es-CL'),
            }
          : p
      )
      await pagosStorageService.guardarPagos(pagosActualizados)
      pagoGlobalAnulado = true
    }
  } catch (err) {
    log.error('Error al anular pago global asociado:', err)
  }

  // 2. Eliminar abono de la ficha del paciente
  const prev =
    abonosPrevios !== undefined
      ? abonosPrevios
      : obtenerAbonosPaciente(pacienteId)
  const abonosActualizados = prev.filter(
    (a) => String(a.id) !== String(idAbono)
  )

  pacientesStorageService.guardarItem(`abonos_${pacienteId}`, abonosActualizados)

  return {
    success: true,
    pagoGlobalAnulado,
    abonosActualizados,
  }
}
