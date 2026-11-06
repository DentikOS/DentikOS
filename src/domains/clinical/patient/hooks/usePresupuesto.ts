/**
 * usePresupuesto — Hook orquestador de presupuesto de paciente
 * Combina usePresupuestoForm + useDescuentoInventario (F7-25)
 * F2-07a: sincronización con arancel global
 * F2-12: descuento de inventario con modal de selección
 */
import {
  usePresupuestoForm,
  type UsePresupuestoFormOptions,
  type UsePresupuestoFormReturn,
  type ItemPresupuesto,
  type PrestacionArancel,
  type AbonoItem
} from './usePresupuestoForm'
import {
  useDescuentoInventario,
  type UseDescuentoInventarioOptions,
  type UseDescuentoInventarioReturn,
  type MaterialEnriquecido
} from './useDescuentoInventario'
import type { Paciente } from '../schemas/pacienteSchema'

export type {
  ItemPresupuesto,
  PrestacionArancel,
  AbonoItem,
  MaterialEnriquecido,
  UsePresupuestoFormReturn,
  UseDescuentoInventarioReturn
}

export type UsePresupuestoProps = Omit<UsePresupuestoFormOptions, 'paciente'> &
  Omit<UseDescuentoInventarioOptions, 'paciente'> & {
    paciente: Paciente | { id: string | number; nombre: string; prevision?: string | null; [key: string]: unknown }
  }

export interface UsePresupuestoReturn extends UsePresupuestoFormReturn, UseDescuentoInventarioReturn {}

export const usePresupuesto = (props: UsePresupuestoProps): UsePresupuestoReturn => {
  const form = usePresupuestoForm(props)
  const descuento = useDescuentoInventario(props)

  return {
    ...form,
    ...descuento
  }
}
