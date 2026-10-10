import { obtenerAlertasOperativas } from '../../../../shared/utils/alertasOperativas'
import { obtenerTareasClinicas } from '../../../../shared/utils/tareasClinicas'
import type { Cita } from '../../../../domains/operations/agenda/schemas/citaSchema'
import type { Pago } from '../../../../domains/billing/payment'
import type { PresupuestoLocal } from '../../../../domains/billing/budget'

export const calcularMetricasClinicas = (
  citas: Cita[] = [],
  pagos: Pago[] = [],
  presupuestos: PresupuestoLocal[] = [],
  evoluciones: unknown[] = [],
  recetas: unknown[] = [],
  certificados: unknown[] = []
) => {
  const alertas = (obtenerAlertasOperativas(citas, pagos, presupuestos) || []) as unknown
  const tareas = (obtenerTareasClinicas(citas, evoluciones, recetas, certificados) || []) as unknown
  return { alertas, tareas }
}
