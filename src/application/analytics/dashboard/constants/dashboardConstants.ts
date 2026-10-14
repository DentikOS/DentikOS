/**
 * Constantes para el Panel de Control Dashboard (BP04 100% Completeness)
 */
import type { WidgetType, WidgetConfig } from '../../../../shared/types/dashboardTypes'

export interface AccesoRapido {
  id: string
  nombre: string
  seccion: string
  color: string
}


export const ACCESOS_RAPIDOS: readonly AccesoRapido[] = [
  { id: 'agenda', nombre: 'Agendar Cita', seccion: 'Agenda', color: 'bg-blue-50 text-blue-900 border-blue-200' },
  { id: 'paciente', nombre: 'Nuevo Paciente', seccion: 'Pacientes', color: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  { id: 'cobro', nombre: 'Registrar Pago', seccion: 'Pagos', color: 'bg-purple-50 text-purple-900 border-purple-200' },
  { id: 'presupuesto', nombre: 'Emitir Presupuesto', seccion: 'Presupuestos', color: 'bg-amber-50 text-amber-900 border-amber-200' }
]

export const WIDGETS_POR_ROL: Record<string, WidgetType[]> = {
  admin: [
    'agenda',
    'pacientes_recientes',
    'alertas_clinicas',
    'esterilizacion',
    'inventario_critico',
    'pagos_pendientes',
    'comunicaciones',
    'quick_resume'
  ],
  dentista: [
    'agenda',
    'pacientes_recientes',
    'alertas_clinicas',
    'comunicaciones',
    'quick_resume'
  ],
  asistente: [
    'agenda',
    'pacientes_recientes',
    'esterilizacion',
    'inventario_critico',
    'comunicaciones'
  ],
  recepcion: [
    'agenda',
    'sala_espera',
    'comunicaciones'
  ]
}

export const WIDGET_CONFIG: Record<WidgetType, WidgetConfig> = {
  agenda: { id: 'agenda', tipo: 'agenda', visible: true, orden: 1, titulo: 'Agenda de Citas' },
  pacientes_recientes: { id: 'pacientes_recientes', tipo: 'pacientes_recientes', visible: true, orden: 2, titulo: 'Pacientes Recientes' },
  sala_espera: { id: 'sala_espera', tipo: 'sala_espera', visible: true, orden: 3, titulo: 'Sala de Espera Virtual' },
  alertas_clinicas: { id: 'alertas_clinicas', tipo: 'alertas_clinicas', visible: true, orden: 4, titulo: 'Alertas Clínicas' },
  esterilizacion: { id: 'esterilizacion', tipo: 'esterilizacion', visible: true, orden: 5, titulo: 'Control de Esterilización' },
  inventario_critico: { id: 'inventario_critico', tipo: 'inventario_critico', visible: true, orden: 6, titulo: 'Inventario Crítico' },
  pagos_pendientes: { id: 'pagos_pendientes', tipo: 'pagos_pendientes', visible: true, orden: 7, titulo: 'Pagos y Flujo de Caja' },
  comunicaciones: { id: 'comunicaciones', tipo: 'comunicaciones', visible: true, orden: 8, titulo: 'Comunicaciones y Recordatorios' },
  quick_resume: { id: 'quick_resume', tipo: 'quick_resume', visible: true, orden: 9, titulo: 'Retomar Atención' }
}


