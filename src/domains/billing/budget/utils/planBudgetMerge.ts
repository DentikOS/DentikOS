import type { ItemPresupuesto } from '../schemas/presupuestoSchema'

export interface ItemDesdePlan extends ItemPresupuesto {
  origenPlanProcedimientoId: string
  precioPlanOriginal: number
}

const tieneOrigen = (item: ItemPresupuesto): item is ItemDesdePlan =>
  typeof (item as ItemDesdePlan).origenPlanProcedimientoId === 'string'

/** Conserva ítems manuales y ajustes sobre ítems del plan; señala revisión aparte. */
export const fusionarItemsDelPlan = (
  anteriores: ItemPresupuesto[],
  nuevosDelPlan: ItemDesdePlan[],
): ItemPresupuesto[] => {
  const porOrigen = new Map(anteriores.filter(tieneOrigen).map((item) => [item.origenPlanProcedimientoId, item]))
  const actualizados = nuevosDelPlan.map((nuevo) => {
    const anterior = porOrigen.get(nuevo.origenPlanProcedimientoId)
    if (!anterior) return nuevo
    const precioFueAjustado = anterior.precioUnitario !== anterior.precioPlanOriginal
    const precioUnitario = precioFueAjustado ? anterior.precioUnitario : nuevo.precioUnitario
    const cantidad = anterior.cantidad
    const descuento = anterior.descuento
    return {
      ...nuevo,
      id: anterior.id,
      cantidad,
      precioUnitario,
      descuento,
      notas: anterior.notas,
      precioPlanOriginal: nuevo.precioUnitario,
      subtotal: Math.max(0, cantidad * precioUnitario - descuento),
    }
  })
  return [...actualizados, ...anteriores.filter((item) => !tieneOrigen(item))]
}

export const recalcularTotalBorrador = (
  items: ItemPresupuesto[],
  descuentoAnterior: number,
  porcentaje?: number | null,
) => {
  const bruto = items.reduce((total, item) => total + item.subtotal, 0)
  const descuento = porcentaje == null
    ? Math.min(bruto, Math.max(0, descuentoAnterior))
    : Math.round(bruto * Math.min(100, Math.max(0, porcentaje)) / 100)
  return { bruto, descuento, total: bruto - descuento }
}
