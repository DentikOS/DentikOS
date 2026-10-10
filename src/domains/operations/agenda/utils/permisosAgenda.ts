import { useSesionStore } from '../../../../app/stores/sesionStore'

export interface PermisosAgendaConfig {
  verTodasCitas: boolean
  verColumnaPropia: boolean
  crearCitas: boolean
  editarCitas: boolean
  cancelarCitas: boolean
  dragAndDrop: boolean
  crearBloqueos: boolean
  verDetallesClinicos: boolean
  configurarHorariosDoctor: boolean
  configurarHorariosSede: boolean
}

export const PERMISOS_AGENDA: Record<string, PermisosAgendaConfig> = {
  admin: {
    verTodasCitas: true,
    verColumnaPropia: true,
    crearCitas: true,
    editarCitas: true,
    cancelarCitas: true,
    dragAndDrop: true,
    crearBloqueos: true,
    verDetallesClinicos: true,
    configurarHorariosDoctor: true,
    configurarHorariosSede: true
  },
  dentista: {
    verTodasCitas: true,
    verColumnaPropia: true,
    crearCitas: true,
    editarCitas: true,
    cancelarCitas: true,
    dragAndDrop: true,
    crearBloqueos: true,
    verDetallesClinicos: true,
    configurarHorariosDoctor: true,
    configurarHorariosSede: false
  },
  asistente: {
    verTodasCitas: true,
    verColumnaPropia: false,
    crearCitas: false,
    editarCitas: false,
    cancelarCitas: false,
    dragAndDrop: false,
    crearBloqueos: true,
    verDetallesClinicos: false,
    configurarHorariosDoctor: false,
    configurarHorariosSede: false
  },
  recepcion: {
    verTodasCitas: true,
    verColumnaPropia: false,
    crearCitas: true,
    editarCitas: true,
    cancelarCitas: true,
    dragAndDrop: true,
    crearBloqueos: false,
    verDetallesClinicos: false,
    configurarHorariosDoctor: false,
    configurarHorariosSede: false
  }
}

export const obtenerPermisosAgenda = (rol?: string): PermisosAgendaConfig => {
  const rolNormalizado = (rol || 'recepcion').toLowerCase()
  return PERMISOS_AGENDA[rolNormalizado] || PERMISOS_AGENDA.recepcion
}

export const usePermisosAgenda = (): PermisosAgendaConfig => {
  const userProfile = useSesionStore((state: { userProfile?: { rol?: string } | null }) => state.userProfile)
  return obtenerPermisosAgenda(userProfile?.rol)
}
