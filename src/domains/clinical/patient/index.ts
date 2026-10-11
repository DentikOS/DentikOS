// Exportar componentes nuevos (BP06)
export { PacientesListado } from './components/listado/PacientesListado'
export { FichaClinica } from './components/ficha/FichaClinica'
export { usePacientesStore } from '../../../app/stores/pacientesStore'

// Schemas
export { pacienteSchema, type Paciente } from './schemas/pacienteSchema'
export { fichaClinicaSchema, type FichaClinica as FichaClinicaData } from './schemas/fichaClinicaSchema'

// Servicios
export {
  pacientesStorageService,
  guardarPaciente,
  procesarColaPacientes,
} from './services/pacientesStorageService'
export {
  evolucionesStorageService,
  type EvolucionClinicaLocal,
} from './services/evolucionesStorageService'
export {
  fichasClinicasStorageService,
  type FichaClinicaRecord,
} from './services/fichasClinicasStorageService'