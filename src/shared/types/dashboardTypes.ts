export type WidgetType =
  | 'agenda'
  | 'pacientes_recientes'
  | 'sala_espera'
  | 'alertas_clinicas'
  | 'esterilizacion'
  | 'inventario_critico'
  | 'pagos_pendientes'
  | 'comunicaciones'
  | 'quick_resume'

export interface WidgetConfig {
  id: string
  tipo: WidgetType
  visible: boolean
  orden: number
  titulo?: string
}

export interface MorningBriefLine {
  id: string
  icono: string
  texto: string
  seccion: string
  severidad?: 'info' | 'alerta' | 'exito' | 'advertencia'
}

export interface MorningBriefData {
  lineas: MorningBriefLine[]
  fechaActualizacion: string
}

export interface QuickResumeData {
  pacienteId: string | number
  pacienteNombre: string
  tabActiva: string
  timestamp: number
}

export interface ContextualData {
  mensaje: string | null
  contexto?: string
  recomendaciones?: string[]
}
