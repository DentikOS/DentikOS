import type { SnapshotImputacionesPresupuesto } from '../../../../../billing/budget/services/imputacionesPagoService'
import type { PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'
import type { FasePlan } from './planOdontogramaGenerator'

export type EstadoFinancieroProcedimiento =
  | 'sin_presupuesto'
  | 'consultando'
  | 'no_disponible'
  | 'pendiente'
  | 'parcial'
  | 'pagado'
  | 'sin_saldo'

export const evaluarEstadoFinancieroProcedimientos = (
  fases: FasePlan[],
  presupuestos: PresupuestoLocal[],
  snapshots: Record<string, SnapshotImputacionesPresupuesto | null>,
  consultando = false,
): Record<string, EstadoFinancieroProcedimiento> => {
  const resultado: Record<string, EstadoFinancieroProcedimiento> = {}

  for (const procedimiento of fases.flatMap((fase) => fase.procedimientos)) {
    const presupuestosVinculados = presupuestos.flatMap((presupuesto) => {
      const item = presupuesto.items?.find((candidato) =>
        candidato.origenPlanProcedimientoId === procedimiento.id)
      return item ? [{ presupuesto, item }] : []
    })

    if (presupuestosVinculados.length === 0) {
      resultado[procedimiento.id] = 'sin_presupuesto'
      continue
    }
    if (consultando) {
      resultado[procedimiento.id] = 'consultando'
      continue
    }

    let montoNeto = 0
    let montoImputado = 0
    const estadoValido = presupuestosVinculados.every(({ presupuesto, item }) => {
      const snapshot = snapshots[String(presupuesto.id)]
      const monto = snapshot?.items.find((prestacion) => prestacion.id === String(item.id))
      if (!monto || presupuesto.sincronizado === false ||
        !Number.isSafeInteger(monto.montoNeto) || monto.montoNeto < 0 ||
        !Number.isSafeInteger(monto.montoImputado) || monto.montoImputado < 0 ||
        monto.montoImputado > monto.montoNeto) return false
      montoNeto += monto.montoNeto
      montoImputado += monto.montoImputado
      return Number.isSafeInteger(montoNeto) && Number.isSafeInteger(montoImputado)
    })

    if (!estadoValido) {
      resultado[procedimiento.id] = 'no_disponible'
    } else if (montoNeto === 0) {
      resultado[procedimiento.id] = 'sin_saldo'
    } else if (montoImputado === montoNeto) {
      resultado[procedimiento.id] = 'pagado'
    } else if (montoImputado > 0) {
      resultado[procedimiento.id] = 'parcial'
    } else {
      resultado[procedimiento.id] = 'pendiente'
    }
  }

  return resultado
}
