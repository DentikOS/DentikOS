import type { DoctorAgenda } from '../services/agendaConfigService'

/**
 * Colores de identidad para doctores (BP05 §03).
 * Permiten identificar visualmente la columna de cada doctor en Vista Día.
 * Paleta accesible (alto contraste) coherente con Brand Manual §4.2.
 */
export const COLORES_DOCTOR: readonly string[] = [
  '#B88E3A', // brand-gold (doctor actual / principal)
  '#0D9488', // teal
  '#7C3AED', // purple
  '#0284C7', // sky
  '#EA580C', // orange
  '#E11D48', // rose
  '#16A34A', // green
  '#9333EA', // violet
]

/**
 * Días de la semana para configuración de horarios.
 */
export const DIAS_SEMANA: readonly { value: number; label: string; labelCorto: string }[] = [
  { value: 1, label: 'Lunes', labelCorto: 'Lun' },
  { value: 2, label: 'Martes', labelCorto: 'Mar' },
  { value: 3, label: 'Miércoles', labelCorto: 'Mié' },
  { value: 4, label: 'Jueves', labelCorto: 'Jue' },
  { value: 5, label: 'Viernes', labelCorto: 'Vie' },
  { value: 6, label: 'Sábado', labelCorto: 'Sáb' },
  { value: 0, label: 'Domingo', labelCorto: 'Dom' },
]

/**
 * Opciones de filtro por doctor (BP05 §03).
 */
export const FILTROS_DOCTOR = {
  TODOS: 'Todos',
  SOLO_YO: '__SOLO_YO__', // Valor especial para "Solo yo"
} as const

/**
 * DOCTORES_DEMO eliminado: El sistema NO debe mostrar doctores inventados.
 * Todos los doctores deben venir de Supabase (miembros_clinica + perfiles).
 * Si no hay doctores configurados, mostrar estado vacío con mensaje:
 * "Configura los doctores de tu clínica en Administración → Equipo"
 */

/**
 * Calcula si un doctor está disponible en una fecha/hora específica
 * según su configuración de horarios.
 */
export const doctorDisponibleEnHorario = (
  doctor: Partial<DoctorAgenda> & { activo?: boolean; sedes?: any[] },
  fechaIso: string,
  hora: string,
  sedeId?: string
): boolean => {
  if (doctor.activo === false) return false
  
  const fecha = new Date(fechaIso + 'T00:00:00')
  const diaSemana = fecha.getDay()
  
  const horarios = doctor.horarios || (
    doctor.sedes && doctor.sedes.length > 0
      ? (sedeId ? doctor.sedes.find(s => String(s.sedeId) === String(sedeId)) : doctor.sedes[0])?.horarios
      : undefined
  )
  
  if (!horarios || horarios.length === 0) return true
  
  const horarioDia = horarios.find((h: any) => h.diaSemana === diaSemana)
  if (!horarioDia) return false
  
  return hora >= horarioDia.horaInicio && hora < horarioDia.horaFin
}
