export { PresupuestosModulo } from './PresupuestosModulo'
export {
  presupuestosStorageService,
  type PresupuestoLocal,
} from './services/presupuestosStorageService'

// Schemas & Types BP07
export {
  presupuestoSchema,
  itemPresupuestoSchema,
  pagoSchema,
  descuentoPresupuestoSchema,
  planPagoSchema,
  type Presupuesto,
  type ItemPresupuesto,
  type Pago,
  type PlanPago as PlanPagoType,
  type DescuentoPresupuesto,
} from './schemas/presupuestoSchema'

// Store Zustand
export { usePresupuestosStore } from '../../../app/stores/presupuestosStore'

// Components BP07
export { ModalNuevoPresupuesto } from './components/modal/ModalNuevoPresupuesto'
export { DescuentosPresupuesto } from './components/utils/DescuentosPresupuesto'
export { PlanPago } from './components/utils/PlanPago'
export { PresupuestoComparativo } from './components/vistas/PresupuestoComparativo'
export { ModoPresentacion } from './components/vistas/ModoPresentacion'

// Hooks BP07
export { useEstadosPresupuesto } from './hooks/useEstadosPresupuesto'
export { useVinculacionPlanTratamiento } from './hooks/useVinculacionPlanTratamiento'

// Utils BP07
export { generarHashForense, generarPayloadQRVerificacion } from './utils/esteganografia'
export { crearRegistroVersion, compararVersiones } from './utils/historialVersiones'
