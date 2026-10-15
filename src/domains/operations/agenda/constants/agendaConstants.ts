import {
  Utensils,
  Clock,
  TreePine,
  Wrench,
  GraduationCap,
  Calendar,
  type LucideIcon,
} from 'lucide-react'

export interface SillonDental {
  id: string
  nombre: string
  especialidad: string
}

export interface TipoBloqueoConfig {
  id: string
  label: string
  color: string
  icon: LucideIcon
  permiteRecurrencia: boolean
  requiereMotivo: boolean
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

export const TIPOS_BLOQUEO: Record<string, TipoBloqueoConfig> = {
  ALMUERZO: {
    id: 'almuerzo',
    label: 'Horario de Almuerzo',
    color: '#64748B',
    icon: Utensils,
    permiteRecurrencia: true,
    requiereMotivo: false,
  },
  PROCEDIMIENTO_LARGO: {
    id: 'procedimiento_largo',
    label: 'Procedimiento Largo',
    color: '#7C3AED',
    icon: Clock,
    permiteRecurrencia: false,
    requiereMotivo: true,
  },
  VACACIONES: {
    id: 'vacaciones',
    label: 'Vacaciones / Ausencia',
    color: '#0284C7',
    icon: TreePine,
    permiteRecurrencia: false,
    requiereMotivo: false,
  },
  MANTENIMIENTO: {
    id: 'mantenimiento',
    label: 'Mantenimiento',
    color: '#D97706',
    icon: Wrench,
    permiteRecurrencia: false,
    requiereMotivo: true,
  },
  CAPACITACION: {
    id: 'capacitacion',
    label: 'Capacitación',
    color: '#0D9488',
    icon: GraduationCap,
    permiteRecurrencia: true,
    requiereMotivo: true,
  },
  PERSONALIZADO: {
    id: 'personalizado',
    label: 'Personalizado',
    color: '#94A3B8',
    icon: Calendar,
    permiteRecurrencia: true,
    requiereMotivo: true,
  },
} as const

export const ESTADOS_CITA: Record<string, EstadoCitaConfig> = {
  // 8 Estados oficiales BP05
  PENDIENTE: { id: 'Pendiente', label: 'Pendiente', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  CONFIRMADA: { id: 'Confirmada', label: 'Confirmada', color: 'bg-teal-100 text-teal-900 border-teal-400' },
  EN_SALA_ESPERA: { id: 'En sala de espera', label: 'En sala de espera', color: 'bg-sky-100 text-sky-900 border-sky-400' },
  EN_ATENCION: { id: 'En atención', label: 'En atención', color: 'bg-purple-100 text-purple-900 border-purple-400' },
  COMPLETADA: { id: 'Completada', label: 'Completada', color: 'bg-emerald-100 text-emerald-900 border-emerald-400' },
  CANCELADA: { id: 'Cancelada', label: 'Cancelada', color: 'bg-rose-100 text-rose-900 border-rose-400' },
  NO_SHOW: { id: 'No-show', label: 'No-show', color: 'bg-slate-100 text-slate-800 border-slate-400' },
  REAGENDADA: { id: 'Reagendada', label: 'Reagendada', color: 'bg-orange-100 text-orange-900 border-orange-400' }
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

/**
 * Tramos de duración BP05 §02: incrementos de 15 min, rango 15-120 min.
 */
export const TRAMOS_DURACION: readonly number[] = [15, 30, 45, 60, 90, 120]

/**
 * Duraciones por defecto según tipo de prestación (BP05 §02 - Duración inteligente).
 * Fallback si el catálogo de prestaciones no tiene `duracionEstimada` explícita.
 * Coherente con catálogo típico de clínicas dentales chilenas.
 */
export const DURACIONES_POR_PRESTACION_DEFAULT: Record<string, number> = {
  // Evaluación y diagnóstico
  'evaluacion': 30,
  'diagnostico': 30,
  'consulta_inicial': 30,
  
  // Higiene y prevención
  'limpieza': 30,
  'destartraje': 30,
  'profilaxis': 30,
  'higiene': 30,
  'fluor': 20,
  
  // Restauraciones
  'obturacion': 45,
  'restauracion': 45,
  'tapadura': 30,
  'composite': 45,
  
  // Endodoncia
  'endodoncia': 90,
  'conducto': 90,
  'tratamiento_conducto': 90,
  
  // Cirugía
  'exodoncia': 30,
  'extraccion': 30,
  'tercer_molar': 60,
  'muela_juicio': 60,
  'cirugia': 60,
  'implante': 90,
  
  // Ortodoncia
  'ortodoncia': 30,
  'control_ortodoncia': 30,
  'frenillos': 30,
  
  // Periodoncia
  'periodoncia': 45,
  'curetaj': 45,
  
  // Urgencias
  'urgencia': 30,
  'dolor_agudo': 30,
  
  // Otros
  'blanqueamiento': 60,
  'instalacion': 60,
  'control': 15,
  'seguimiento': 15,
  
  // Default
  'default': 30,
}

/**
 * Calcula la duración recomendada para una prestación (BP05 §02).
 * Prioridad: duracionEstimada del catálogo > match por palabra clave > default 30 min.
 * Siempre retorna un valor dentro de TRAMOS_DURACION.
 */
export const calcularDuracionRecomendada = (prestacion: { duracionEstimada?: number; nombre?: string } | null | undefined): number => {
  if (!prestacion) return 30
  
  // 1. Si tiene duración explícita válida, usarla
  if (prestacion.duracionEstimada && TRAMOS_DURACION.includes(prestacion.duracionEstimada)) {
    return prestacion.duracionEstimada
  }
  
  // 2. Buscar por palabras clave en el nombre (normalizando acentos)
  if (prestacion.nombre) {
    const nombreNorm = prestacion.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    for (const [keyword, duracion] of Object.entries(DURACIONES_POR_PRESTACION_DEFAULT)) {
      const keywordNorm = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ')
      if (keyword !== 'default' && nombreNorm.includes(keywordNorm)) {
        return duracion
      }
    }
  }
  
  // 3. Default
  return DURACIONES_POR_PRESTACION_DEFAULT.default
}

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
