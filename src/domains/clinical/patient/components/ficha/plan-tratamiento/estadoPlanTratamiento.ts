import type { PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'
import type { FasePlan } from './planOdontogramaGenerator'

export interface EstadoPlanTratamiento {
  tratamientosRealizados: boolean
  saldoCubierto: boolean
  completado: boolean
}

export const evaluarEstadoPlanTratamiento = (
  fases: FasePlan[],
  presupuestos: PresupuestoLocal[],
  pacienteId: string,
  revision?: string
): EstadoPlanTratamiento => {
  const procedimientos = fases.flatMap((fase) => fase.procedimientos)
  const tratamientosRealizados = procedimientos.length > 0 && procedimientos.every((proc) => proc.estado === 'realizado')
  const porGrupo = new Map<string, PresupuestoLocal>()
  if (revision) for (const presupuesto of presupuestos) {
    if (!presupuesto.origenPlan || String(presupuesto.pacienteId) !== pacienteId) continue
    const grupo = presupuesto.versionGrupoId || String(presupuesto.id)
    const previo = porGrupo.get(grupo)
    if (!previo || Number(presupuesto.version || 1) > Number(previo.version || 1)) porGrupo.set(grupo, presupuesto)
  }
  const vigentes = [...porGrupo.values()].filter((presupuesto) => {
    if (presupuesto.requiereRevision || ['archivado', 'rechazado', 'Rechazado'].includes(presupuesto.estado || '')) return false
    const itemsPlan = (presupuesto.items || []).filter((item) => item.origenPlanProcedimientoId)
    const ids = new Set(itemsPlan.map((item) => item.origenPlanProcedimientoId))
    return itemsPlan.length === procedimientos.length && ids.size === procedimientos.length && procedimientos.every((proc) =>
      !proc.requiereRevision && proc.prestacionId && proc.costo !== null &&
      itemsPlan.some((item) => item.origenPlanProcedimientoId === proc.id &&
        String(item.codigoPrestacion) === proc.prestacionId &&
        Number(item.precioPlanOriginal) === proc.costo)
    )
  })
  const saldoCubierto = vigentes.length > 0 && vigentes.every((presupuesto) => {
    const total = Number(presupuesto.montoTotal)
    const abonado = Number(presupuesto.montoAbonado || 0)
    return presupuesto.sincronizado !== false && Number.isFinite(total) && total >= 0 &&
      Number.isFinite(abonado) && abonado >= total
  })
  return { tratamientosRealizados, saldoCubierto, completado: tratamientosRealizados && saldoCubierto }
}
