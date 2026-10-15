import { useSesionStore } from '../../../../app/stores/sesionStore'

/**
 * Matriz de permisos oficiales BP05 §09 (13 acciones × 4 roles)
 * Coherente con la regla de oro: "lo que no puedes hacer, no lo ves"
 */
export interface PermisosAgendaConfig {
  verTodasCitas: boolean
  verColumnaPropia: boolean
  crearCitas: boolean
  editarCitas: boolean
  editarCitasEsterilizacion: boolean // BP05 §09: asistente sí, dentista no
  editarCitasPropias?: boolean       // Si true, solo puede editar SUS propias citas
  cancelarCitas: boolean
  cancelarCitasPropias?: boolean     // Si true, solo puede cancelar SUS propias citas
  dragAndDrop: boolean
  dragAndDropPropio?: boolean        // Si true, solo puede mover SUS propias citas
  crearBloqueos: boolean
  crearBloqueosPersonales?: boolean  // Si true, solo puede crear bloqueos personales
  verDetallesClinicos: boolean
  configurarHorariosDoctor: boolean
  configurarHorariosSede: boolean
  gestionarDiasFestivos: boolean     // Solo admin (Parte 2)
  gestionarDoctoresAusentes: boolean // Solo admin (Parte 2)
}

export const PERMISOS_AGENDA: Record<string, PermisosAgendaConfig> = {
  admin: {
    verTodasCitas: true,
    verColumnaPropia: true,
    crearCitas: true,
    editarCitas: true,
    editarCitasEsterilizacion: true,
    cancelarCitas: true,
    dragAndDrop: true,
    crearBloqueos: true,
    verDetallesClinicos: true,
    configurarHorariosDoctor: true,
    configurarHorariosSede: true,
    gestionarDiasFestivos: true,
    gestionarDoctoresAusentes: true,
  },
  dentista: {
    verTodasCitas: true, // Configurable por admin (Parte 2)
    verColumnaPropia: true,
    crearCitas: true,
    editarCitas: true,
    editarCitasPropias: true, // SOLO sus citas
    editarCitasEsterilizacion: false, // BP05 §09: dentista NO edita esterilización
    cancelarCitas: true,
    cancelarCitasPropias: true, // SOLO sus citas
    dragAndDrop: true,
    dragAndDropPropio: true, // SOLO sus citas
    crearBloqueos: true,
    crearBloqueosPersonales: true, // SOLO bloqueos personales
    verDetallesClinicos: true,
    configurarHorariosDoctor: true, // Solo propios
    configurarHorariosSede: false,
    gestionarDiasFestivos: false,
    gestionarDoctoresAusentes: false,
  },
  asistente: {
    verTodasCitas: true, // Solo lectura
    verColumnaPropia: false,
    crearCitas: false,
    editarCitas: false,
    editarCitasEsterilizacion: true, // BP05 §09: asistente SÍ edita esterilización
    cancelarCitas: false,
    dragAndDrop: false,
    crearBloqueos: true,
    crearBloqueosPersonales: false, // Puede crear mantenimientos de equipo
    verDetallesClinicos: false,
    configurarHorariosDoctor: false,
    configurarHorariosSede: false,
    gestionarDiasFestivos: false,
    gestionarDoctoresAusentes: false,
  },
  recepcion: {
    verTodasCitas: true,
    verColumnaPropia: false,
    crearCitas: true,
    editarCitas: true,
    editarCitasEsterilizacion: false,
    // Recepcionista depende del permiso del admin (configurable en Parte 2)
    // Por defecto true, pero admin puede desactivarlo
    cancelarCitas: true,
    dragAndDrop: true,
    crearBloqueos: false,
    verDetallesClinicos: false,
    configurarHorariosDoctor: false,
    configurarHorariosSede: false,
    gestionarDiasFestivos: false,
    gestionarDoctoresAusentes: false,
  }
}

export interface UserProfileAgendaRef {
  id?: string
  nombreCompleto?: string
  nombre?: string
  email?: string
  rol?: string
}

/**
 * Normaliza un string para comparación (lowercase + trim)
 */
const normalizar = (s: string | undefined | null): string => {
  if (!s) return ''
  return String(s).trim().toLowerCase()
}

/**
 * Elimina prefijos comunes de título honorífico (Dr., Dra., Dr, Dra)
 */
const limpiarPrefijoTitulo = (s: string): string => {
  return s.replace(/^(dr\.|dra\.|dr|dra)\s+/i, '').trim()
}

/**
 * Determina si el usuario actual es el "dueño" de una cita
 * comparando por NOMBRE (cita.doctor guarda nombres, no userIds).
 * 
 * @param citaDoctor - Nombre del doctor asignado a la cita (ej: "Dr. Miguel Díaz")
 * @param userProfile - Perfil del usuario logueado
 */
const esUsuarioPropietarioDeCita = (
  citaDoctor: string | undefined,
  userProfile: UserProfileAgendaRef | null | undefined
): boolean => {
  if (!citaDoctor || !userProfile) return false
  
  const citaNorm = normalizar(citaDoctor)
  const citaSinTitulo = limpiarPrefijoTitulo(citaNorm)
  
  // Comparar con nombre completo
  if (userProfile.nombreCompleto) {
    const ncNorm = normalizar(userProfile.nombreCompleto)
    if (ncNorm === citaNorm || limpiarPrefijoTitulo(ncNorm) === citaSinTitulo) return true
  }
  
  // Comparar con nombre
  if (userProfile.nombre) {
    const nNorm = normalizar(userProfile.nombre)
    if (nNorm === citaNorm || limpiarPrefijoTitulo(nNorm) === citaSinTitulo) return true
  }
  
  // Comparar con "Dr. [nombre]" o "Dra. [nombre]" (citas que guardan con prefijo)
  const nombre = userProfile.nombre || userProfile.nombreCompleto || ''
  if (nombre) {
    const nombreNorm = normalizar(nombre)
    if (citaNorm === `dr. ${nombreNorm}` || citaNorm === `dra. ${nombreNorm}`) return true
    if (citaNorm === `dr ${nombreNorm}` || citaNorm === `dra ${nombreNorm}`) return true
  }
  
  // Fallback: comparar por userId (por si la cita sí guarda ID en algunos casos)
  if (userProfile.id && String(citaDoctor) === String(userProfile.id)) return true
  
  return false
}

const normalizarUserProfile = (
  userProfileOrId?: UserProfileAgendaRef | string | null,
  doctorActualId?: string
): UserProfileAgendaRef | null | undefined => {
  if (typeof userProfileOrId === 'string') {
    return {
      id: userProfileOrId,
      nombreCompleto: doctorActualId || userProfileOrId,
      nombre: doctorActualId || userProfileOrId
    }
  }
  return userProfileOrId
}

export const obtenerPermisosAgenda = (rol?: string): PermisosAgendaConfig => {
  const rolNorm = normalizar(rol)
  
  // Mapear variantes comunes a roles canónicos
  if (rolNorm === 'admin' || rolNorm === 'administrador' || rolNorm === 'dueño' || rolNorm === 'dueno' || rolNorm === 'owner') {
    return PERMISOS_AGENDA.admin
  }
  if (rolNorm === 'dentista' || rolNorm === 'dentist' || rolNorm === 'doctor' || rolNorm === 'odontologo' || rolNorm === 'odontólogo') {
    return PERMISOS_AGENDA.dentista
  }
  if (rolNorm === 'asistente' || rolNorm === 'assistant' || rolNorm === 'auxiliar') {
    return PERMISOS_AGENDA.asistente
  }
  if (rolNorm === 'recepcion' || rolNorm === 'recepción' || rolNorm === 'reception' || rolNorm === 'recepcionista') {
    return PERMISOS_AGENDA.recepcion
  }
  
  // Fallback: si no hay rol definido, tratar como recepcionista (más permisivo para operar)
  return PERMISOS_AGENDA.recepcion
}

export const usePermisosAgenda = (): PermisosAgendaConfig => {
  const userProfile = useSesionStore((state: { userProfile?: { rol?: string } | null }) => state.userProfile)
  return obtenerPermisosAgenda(userProfile?.rol)
}

/**
 * BP05 §09: Helper corregido.
 * Compara cita.doctor (nombre) con userProfile.nombreCompleto/nombre.
 * Admin y Recepcionista: pueden editar TODO.
 * Dentista: solo sus propias citas (match por nombre).
 * Asistente: solo esterilización.
 */
export const puedeEditarCita = (
  permisos: PermisosAgendaConfig,
  cita: { doctor?: string; motivoBloqueo?: string; esBloqueo?: boolean },
  userProfileOrId?: UserProfileAgendaRef | string | null,
  doctorActualId?: string
): boolean => {
  // Si es bloqueo de esterilización, usar permiso específico
  if ((cita.esBloqueo || cita.motivoBloqueo) && cita.motivoBloqueo?.toLowerCase().includes('esteriliz')) {
    return permisos.editarCitasEsterilizacion
  }
  
  // Si NO tiene permiso base de editar citas
  if (!permisos.editarCitas) return false
  
  // Admin y Recepcionista: pueden editar TODAS las citas (editarCitasPropias es undefined)
  if (!permisos.editarCitasPropias) return true
  
  // Dentista: solo puede editar SUS propias citas (match por NOMBRE)
  const profile = normalizarUserProfile(userProfileOrId, doctorActualId)
  return esUsuarioPropietarioDeCita(cita.doctor, profile)
}

export const puedeCancelarCita = (
  permisos: PermisosAgendaConfig,
  cita: { doctor?: string },
  userProfileOrId?: UserProfileAgendaRef | string | null,
  doctorActualId?: string
): boolean => {
  if (!permisos.cancelarCitas) return false
  if (!permisos.cancelarCitasPropias) return true // Admin y Recepcionista
  
  // Dentista: solo sus propias (match por nombre)
  const profile = normalizarUserProfile(userProfileOrId, doctorActualId)
  return esUsuarioPropietarioDeCita(cita.doctor, profile)
}

export const puedeArrastrarCita = (
  permisos: PermisosAgendaConfig,
  cita: { doctor?: string },
  userProfileOrId?: UserProfileAgendaRef | string | null,
  doctorActualId?: string
): boolean => {
  if (!permisos.dragAndDrop) return false
  if (!permisos.dragAndDropPropio) return true // Admin y Recepcionista
  
  // Dentista: solo sus propias (match por nombre)
  const profile = normalizarUserProfile(userProfileOrId, doctorActualId)
  return esUsuarioPropietarioDeCita(cita.doctor, profile)
}

export const puedeCrearBloqueo = (
  permisos: PermisosAgendaConfig,
  tipoBloqueo?: string
): boolean => {
  if (!permisos.crearBloqueos) return false
  
  // Asistente: solo mantenimientos
  if (tipoBloqueo?.toLowerCase().includes('mantenimiento')) return true
  
  return true
}
