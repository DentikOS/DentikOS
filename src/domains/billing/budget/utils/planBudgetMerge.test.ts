import { describe, expect, it } from 'vitest'
import { fusionarItemsDelPlan, recalcularTotalBorrador, type ItemDesdePlan } from './planBudgetMerge'

const plan = (id: string, precio: number): ItemDesdePlan => ({
  id, origenPlanProcedimientoId: id, precioPlanOriginal: precio,
  nombrePrestacion: `Prestación ${id}`, cantidad: 1, precioUnitario: precio,
  descuento: 0, subtotal: precio, faseClinica: 'urgencias',
})

describe('fusionarItemsDelPlan', () => {
  it('actualiza ítems del plan y conserva ítems manuales y descuentos', () => {
    const anterior = { ...plan('p-1', 10000), id: 'item-1', descuento: 1000, subtotal: 9000 }
    const manual = { id: 'manual-1', nombrePrestacion: 'Ajuste manual', cantidad: 1, precioUnitario: 5000, descuento: 0, subtotal: 5000 }
    const fusion = fusionarItemsDelPlan([anterior, manual], [plan('p-1', 12000), plan('p-2', 3000)])
    expect(fusion).toEqual([
      expect.objectContaining({ id: 'item-1', origenPlanProcedimientoId: 'p-1', precioUnitario: 12000, descuento: 1000, subtotal: 11000 }),
      expect.objectContaining({ origenPlanProcedimientoId: 'p-2', subtotal: 3000 }),
      manual,
    ])
    expect(recalcularTotalBorrador(fusion, 2000)).toEqual({ bruto: 19000, descuento: 2000, total: 17000 })
  })

  it('preserva un precio sobreescrito por el profesional y recalcula porcentaje', () => {
    const anterior = { ...plan('p-1', 10000), id: 'item-1', precioUnitario: 8500, subtotal: 8500 }
    const fusion = fusionarItemsDelPlan([anterior], [plan('p-1', 12000)])
    expect(fusion[0]).toMatchObject({ precioUnitario: 8500, precioPlanOriginal: 12000, subtotal: 8500 })
    expect(recalcularTotalBorrador(fusion, 0, 10)).toEqual({ bruto: 8500, descuento: 850, total: 7650 })
  })

  it('retira solo ítems originados en el plan que ya no existen', () => {
    const manual = { id: 'manual-1', nombrePrestacion: 'Ajuste manual', cantidad: 1, precioUnitario: 5000, descuento: 0, subtotal: 5000 }
    expect(fusionarItemsDelPlan([plan('p-1', 10000), manual], [])).toEqual([manual])
  })
})
