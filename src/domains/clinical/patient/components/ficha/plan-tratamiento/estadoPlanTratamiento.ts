import type { PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'
import type { FasePlan } from './planOdontogramaGenerator'

export interface EstadoPlanTratamiento {
  tratamientosRealizados: boolean
  saldoCubierto: boolean
  completado: boolean
  aprobaciones: Record<string, { folio: string; version: number }>
  diferenciasPrecio: Array<{ presupuestoId: string; version: number; folio: string; procedimientoId: string; precioPlan: number; precioPresupuesto: number }>
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
  const candidatos = [...porGrupo.values()].filter((presupuesto) => {
    if (['archivado', 'rechazado', 'Rechazado'].includes(presupuesto.estado || '')) return false
    const itemsPlan = (presupuesto.items || []).filter((item) => item.origenPlanProcedimientoId)
    const ids = new Set(itemsPlan.map((item) => item.origenPlanProcedimientoId))
    return itemsPlan.length === procedimientos.length && ids.size === procedimientos.length && procedimientos.every((proc) =>
      !proc.requiereRevision && proc.prestacionId && proc.costo !== null &&
      itemsPlan.some((item) => item.origenPlanProcedimientoId === proc.id &&
        String(item.codigoPrestacion) === proc.prestacionId)
    )
  })
  const precioItem = (item: NonNullable<PresupuestoLocal['items']>[number]) => Number(item.precioUnitario ?? item.precioPlanOriginal)
  const diferenciasPrecio: EstadoPlanTratamiento['diferenciasPrecio'] = []
  for (const presupuesto of candidatos) for (const item of presupuesto.items || []) {
    const proc = procedimientos.find((p) => p.id === item.origenPlanProcedimientoId)
    const precio = precioItem(item)
    if (proc && Number.isFinite(precio) && precio > 0 && precio !== proc.costo) diferenciasPrecio.push({
      presupuestoId: String(presupuesto.id), version: Number(presupuesto.version || 1),
      folio: presupuesto.folio || 'Presupuesto', procedimientoId: proc.id,
      precioPlan: Number(proc.costo), precioPresupuesto: precio,
    })
  }
  const vigentes = candidatos.filter((presupuesto) => !presupuesto.requiereRevision && (presupuesto.items || []).every((item) =>
    !item.origenPlanProcedimientoId || procedimientos.some((proc) => proc.id === item.origenPlanProcedimientoId &&
      precioItem(item) === proc.costo)
  ))
  const saldoCubierto = vigentes.length > 0 && vigentes.every((presupuesto) => {
    const total = Number(presupuesto.montoTotal)
    const abonado = Number(presupuesto.montoAbonado || 0)
    return presupuesto.sincronizado !== false && Number.isFinite(total) && total >= 0 &&
      Number.isFinite(abonado) && abonado >= total
  })
  const aprobaciones: EstadoPlanTratamiento['aprobaciones'] = {}
  for (const presupuesto of vigentes.sort((a, b) => Number(b.version || 1) - Number(a.version || 1))) {
    if (!['aprobado', 'Aprobado', 'en-curso', 'EnTratamiento', 'completado'].includes(presupuesto.estado || '')) continue
    for (const item of presupuesto.items || []) {
      const procId = String(item.origenPlanProcedimientoId || '')
      if (procId && !aprobaciones[procId]) {
        aprobaciones[procId] = { folio: presupuesto.folio || 'Presupuesto', version: Number(presupuesto.version || 1) }
      }
    }
  }
  return { tratamientosRealizados, saldoCubierto, completado: tratamientosRealizados && saldoCubierto, aprobaciones, diferenciasPrecio }
}
