export interface SillonDental {
  id: string
  nombre: string
  especialidad: string
}

export interface TipoBloqueoAgenda {
  id: string
  label: string
  color: string
}

export interface EstadoCitaConfig {
  id: string
  label: string
  color: string
}

export const SILLONES_DENTALES: readonly SillonDental[] = [
  { id: 'sillon_1', nombre: 'Sillón 1 - Odontología General', especialidad: 'Evaluación y Restauraciones' },
  { id: 'sillon_2', nombre: 'Sillón 2 - Higiene & Ortodoncia', especialidad: 'Limpieza, Profilaxis y Frenillos' },
  { id: 'box_3', nombre: 'Box 3 - Quirúrgico & Implantes', especialidad: 'Cirugías y Periodoncia' }
]

export const BOXES_DENTALES = SILLONES_DENTALES

export const TIPOS_BLOQUEO_AGENDA: readonly TipoBloqueoAgenda[] = [
  { id: 'almuerzo', label: 'Horario de Almuerzo', color: 'bg-gray-200 text-gray-800' },
  { id: 'reunion', label: 'Reunión Clínica / Administrativa', color: 'bg-amber-100 text-amber-900' },
  { id: 'mantenimiento', label: 'Mantenimiento de Sillón / Box', color: 'bg-red-100 text-red-900' },
  { id: 'urgencia_reserva', label: 'Reserva Exclusiva Urgencias', color: 'bg-purple-100 text-purple-900' }
]

export const ESTADOS_CITA: Record<string, EstadoCitaConfig> = {
  // 8 Estados oficiales BP05
  PENDIENTE: { id: 'Pendiente', label: 'Pendiente', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  CONFIRMADA: { id: 'Confirmada', label: 'Confirmada', color: 'bg-teal-100 text-teal-900 border-teal-400' },
  EN_SALA_ESPERA: { id: 'En sala de espera', label: 'En sala de espera', color: 'bg-sky-100 text-sky-900 border-sky-400' },
  EN_ATENCION: { id: 'En atención', label: 'En atención', color: 'bg-purple-100 text-purple-900 border-purple-400' },
  COMPLETADA: { id: 'Completada', label: 'Completada', color: 'bg-emerald-100 text-emerald-900 border-emerald-400' },
  CANCELADA: { id: 'Cancelada', label: 'Cancelada', color: 'bg-rose-100 text-rose-900 border-rose-400' },
  NO_SHOW: { id: 'No-show', label: 'No-show', color: 'bg-slate-100 text-slate-800 border-slate-400' },
  REAGENDADA: { id: 'Reagendada', label: 'Reagendada', color: 'bg-orange-100 text-orange-900 border-orange-400' },

  // Retrocompatibilidad con estados anteriores
  AGENDADO: { id: 'Agendado', label: 'Agendado', color: 'bg-blue-100 text-blue-800' },
  CONFIRMADO: { id: 'Confirmado', label: 'Confirmado', color: 'bg-emerald-100 text-emerald-800' },
  SALA_ESPERA: { id: 'En Espera', label: 'En Sala de Espera', color: 'bg-amber-100 text-amber-900' },
  EN_SILLON: { id: 'En Sillón', label: 'En Sillón', color: 'bg-purple-100 text-purple-900' },
  ATENDIDO: { id: 'Atendido', label: 'Atendido', color: 'bg-gray-100 text-gray-700' },
  ANULADO: { id: 'Anulado', label: 'Anulado', color: 'bg-red-100 text-red-800' }
}

export const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Pendiente: { bg: '#FEF3C7', text: '#92400E', border: '#D97706' },
  Confirmada: { bg: '#D1FAE5', text: '#065F46', border: '#0D9488' },
  'En sala de espera': { bg: '#DBEAFE', text: '#1E40AF', border: '#0284C7' },
  'En atención': { bg: '#EDE9FE', text: '#6D28D9', border: '#7C3AED' },
  Completada: { bg: '#D1FAE5', text: '#065F46', border: '#0D9488' },
  Cancelada: { bg: '#FEE2E2', text: '#991B1B', border: '#E11D48' },
  'No-show': { bg: '#E2E8F0', text: '#334155', border: '#475569' },
  Reagendada: { bg: '#FFEDD5', text: '#9A3412', border: '#EA580C' }
}

export const ESTADOS_CITA_GOLD: readonly EstadoCitaConfig[] = [
  ESTADOS_CITA.AGENDADO,
  ESTADOS_CITA.CONFIRMADO,
  ESTADOS_CITA.SALA_ESPERA,
  ESTADOS_CITA.EN_SILLON,
  ESTADOS_CITA.ATENDIDO,
  ESTADOS_CITA.ANULADO
]

export const ESTADOS_CITA_CORE: readonly EstadoCitaConfig[] = [
  ESTADOS_CITA.PENDIENTE,
  ESTADOS_CITA.CONFIRMADA,
  ESTADOS_CITA.EN_SALA_ESPERA,
  ESTADOS_CITA.EN_ATENCION,
  ESTADOS_CITA.COMPLETADA,
  ESTADOS_CITA.CANCELADA,
  ESTADOS_CITA.NO_SHOW,
  ESTADOS_CITA.REAGENDADA
]
export const ESTADOS_CITA_WORLD_CLASS = ESTADOS_CITA_CORE

export const TRATAMIENTOS_RAPIDOS: readonly string[] = [
  'Evaluación / Diagnóstico Inicial',
  'Limpieza / Destartraje Higiene',
  'Obturación / Tapadura Resina',
  'Exodoncia / Extracción Simple',
  'Exodoncia Tercer Molar (Muela Juicio)',
  'Tratamiento de Conducto (Endodoncia)',
  'Control de Ortodoncia / Frenillos',
  'Instalación / Blanqueamiento Dental',
  'Control / Urgencia Dental'
]

export interface ParametrosAgendaConfig {
  duracionBloqueMinutos: number
  horaInicio: string
  horaFin: string
  diasLaborales: string[]
}

export const PARAMETROS_AGENDA_DEFAULT: ParametrosAgendaConfig = {
  duracionBloqueMinutos: 30,
  horaInicio: '08:30',
  horaFin: '19:30',
  diasLaborales: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
}

export const TRAMOS_DURACION: readonly number[] = [15, 20, 30, 45, 60]
