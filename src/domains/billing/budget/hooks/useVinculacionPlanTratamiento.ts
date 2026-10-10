import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'
import type { Presupuesto, ItemPresupuesto } from '../schemas/presupuestoSchema'

export interface ProcedimientoVinculado {
  id: string
  descripcion: string
  pieza?: number | string
  costo: number
  estado: 'pendiente' | 'aprobado' | 'realizado' | 'cancelado'
  fase?: 'urgencias' | 'estabilizacion' | 'rehabilitacion' | 'estetica'
}

export const useVinculacionPlanTratamiento = () => {
  const crearPresupuestoStore = usePresupuestosStore((s) => s.crearPresupuesto)
  const actualizarPresupuestoStore = usePresupuestosStore((s) => s.actualizarPresupuesto)

  const convertirProcedimientosAItems = (
    procedimientos: ProcedimientoVinculado[]
  ): ItemPresupuesto[] => {
    return procedimientos.map((p) => ({
      id: p.id || crypto.randomUUID(),
      nombrePrestacion: p.descripcion,
      piezaDental: p.pieza,
      cantidad: 1,
      precioUnitario: p.costo,
      descuento: 0,
      subtotal: p.costo,
      faseClinica: p.fase || 'estabilizacion',
    }))
  }

  const generarPresupuestoDesdePlan = (
    pacienteId: string | number,
    pacienteNombre: string,
    procedimientos: ProcedimientoVinculado[],
    planTratamientoId?: string
  ): Presupuesto => {
    const items = convertirProcedimientosAItems(procedimientos)
    const total = items.reduce((sum, it) => sum + it.subtotal, 0)

    return crearPresupuestoStore({
      pacienteId,
      pacienteNombre,
      items,
      totalBruto: total,
      totalAPagar: total,
      total,
      montoTotal: total,
      estado: 'borrador',
      planTratamientoId,
    })
  }

  const sincronizarPlanConPresupuesto = (
    presupuestoId: string | number,
    procedimientosActualizados: ProcedimientoVinculado[]
  ) => {
    const items = convertirProcedimientosAItems(procedimientosActualizados)
    const total = items.reduce((sum, it) => sum + it.subtotal, 0)

    actualizarPresupuestoStore(presupuestoId, {
      items,
      totalBruto: total,
      totalAPagar: total,
      total,
      montoTotal: total,
    })
  }

  return {
    convertirProcedimientosAItems,
    generarPresupuestoDesdePlan,
    sincronizarPlanConPresupuesto,
  }
}
