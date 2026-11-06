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

// Hooks BP07
export { useEstadosPresupuesto } from './hooks/useEstadosPresupuesto'
export { useVinculacionPlanTratamiento } from './hooks/useVinculacionPlanTratamiento'

// Utils BP07
export { generarHashForense, generarPayloadQRVerificacion } from './utils/esteganografia'
export { crearRegistroVersion, compararVersiones } from './utils/historialVersiones'
