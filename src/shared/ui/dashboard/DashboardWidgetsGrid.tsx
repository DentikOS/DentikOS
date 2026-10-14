import React from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { WidgetConfig, QuickResumeData } from '../../types/dashboardTypes'
import type { Cita } from '../../../domains/operations/agenda/schemas/citaSchema'
import type { Paciente } from '../../../domains/clinical/patient/schemas/pacienteSchema'
import { WidgetAgenda } from './widgets/WidgetAgenda'
import { WidgetPacientesRecientes } from './widgets/WidgetPacientesRecientes'
import { WidgetSalaEspera } from './widgets/WidgetSalaEspera'
import { WidgetAlertasClinicas } from './widgets/WidgetAlertasClinicas'
import { WidgetEsterilizacion } from './widgets/WidgetEsterilizacion'
import { WidgetInventarioCritico } from './widgets/WidgetInventarioCritico'
import { WidgetPagosPendientes } from './widgets/WidgetPagosPendientes'
import { WidgetComunicaciones } from './widgets/WidgetComunicaciones'
import { WidgetQuickResume } from './widgets/WidgetQuickResume'
import { obtenerMetricasPagosDashboard, obtenerAlertasClinicasDashboard } from '../../../application/analytics/dashboardQueries'
import { comunicacionesStorageService } from '../../../domains/operations/communications/services/comunicacionesStorageService'
import { esterilizacionStorageService } from '../../../domains/operations/sterilization/services/esterilizacionStorageService'
import { inventarioStorageService } from '../../../domains/operations/inventory/services/inventarioStorageService'

export interface DashboardWidgetsGridProps {
  widgets: WidgetConfig[]
  widgetOrder: string[]
  citas?: Cita[]
  pacientes?: Paciente[]
  quickResumeData?: QuickResumeData | null
  onVerFichaPaciente?: (paciente: Paciente) => void
  onNavegarSeccion?: (seccion: string) => void
  onReorderWidgets?: (nuevoOrden: string[]) => void
}

const SortableItem: React.FC<{ id: string; children: (dragHandle: React.ReactNode) => React.ReactNode }> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 30 : 1
  }

  const dragHandle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing"
      title="Arrastrar para reordenar"
      aria-label="Arrastrar widget"
    >
      <GripVertical className="w-3.5 h-3.5" />
    </button>
  )

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      {children(dragHandle)}
    </div>
  )
}

export const DashboardWidgetsGrid: React.FC<DashboardWidgetsGridProps> = ({
  widgets,
  widgetOrder,
  citas = [],
  pacientes = [],
  quickResumeData,
  onVerFichaPaciente,
  onNavegarSeccion,
  onReorderWidgets
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const widgetsVisibles = widgets
    .filter((w) => w.visible)
    .sort((a, b) => {
      const idxA = widgetOrder.indexOf(a.id)
      const idxB = widgetOrder.indexOf(b.id)
      return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999)
    })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderWidgets) return

    const oldIndex = widgetOrder.indexOf(String(active.id))
    const newIndex = widgetOrder.indexOf(String(over.id))
    if (oldIndex !== -1 && newIndex !== -1) {
      const nuevo = [...widgetOrder]
      const [removido] = nuevo.splice(oldIndex, 1)
      nuevo.splice(newIndex, 0, removido)
      onReorderWidgets(nuevo)
    }
  }

  const renderWidget = (tipo: string, dragHandle: React.ReactNode) => {
    switch (tipo) {
      case 'agenda':
        return <WidgetAgenda citas={citas} pacientes={pacientes} onVerFichaPaciente={onVerFichaPaciente} onVerAgendaCompleta={() => onNavegarSeccion?.('Agenda')} dragHandle={dragHandle} />
      case 'pacientes_recientes':
        return <WidgetPacientesRecientes pacientes={pacientes} onVerFichaPaciente={onVerFichaPaciente} onVerTodos={() => onNavegarSeccion?.('Pacientes')} dragHandle={dragHandle} />
      case 'sala_espera':
        return <WidgetSalaEspera enEspera={citas.filter((c) => c.estado === 'En Espera')} pacientes={pacientes} onVerFichaPaciente={onVerFichaPaciente} dragHandle={dragHandle} />
      case 'alertas_clinicas': {
        const alertasClinicas = obtenerAlertasClinicasDashboard(pacientes)
        return (
          <WidgetAlertasClinicas
            alertas={alertasClinicas}
            onVerAlerta={(alerta) => {
              const paciente = pacientes.find((p) => String(p.id) === String(alerta.pacienteId))
              if (paciente) onVerFichaPaciente?.(paciente)
            }}
            dragHandle={dragHandle}
          />
        )
      }
      case 'esterilizacion': {
        const infoEsterilizacion = esterilizacionStorageService.obtenerInfoEsterilizacionDashboard()
        return (
          <WidgetEsterilizacion
            info={infoEsterilizacion}
            onIrEsterilizacion={() => onNavegarSeccion?.('Esterilización')}
            dragHandle={dragHandle}
          />
        )
      }
      case 'inventario_critico': {
        const itemsCriticos = inventarioStorageService.obtenerItemsInventarioCriticoDashboard()
        return (
          <WidgetInventarioCritico
            items={itemsCriticos}
            onIrInventario={() => onNavegarSeccion?.('Inventario')}
            dragHandle={dragHandle}
          />
        )
      }
      case 'pagos_pendientes': {
        const metricasPagos = obtenerMetricasPagosDashboard(pacientes)
        return (
          <WidgetPagosPendientes
            porCobrarHoy={metricasPagos.porCobrarHoy}
            pagosVencidos={metricasPagos.pagosVencidos}
            recaudadoHoy={metricasPagos.recaudadoHoy}
            onIrPagos={() => onNavegarSeccion?.('Pagos')}
            dragHandle={dragHandle}
          />
        )
      }
      case 'comunicaciones': {
        const metricasComunicaciones = comunicacionesStorageService.obtenerMetricasComunicacionesDashboard()
        return (
          <WidgetComunicaciones
            sinLeerWhatsapp={metricasComunicaciones.sinLeerWhatsapp}
            porConfirmar={metricasComunicaciones.porConfirmar}
            onIrComunicaciones={() => onNavegarSeccion?.('Comunicaciones')}
            dragHandle={dragHandle}
          />
        )
      }
      case 'quick_resume':
        return <WidgetQuickResume data={quickResumeData} onRetomar={() => onNavegarSeccion?.('Pacientes')} dragHandle={dragHandle} />
      default:
        return null
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={widgetsVisibles.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {widgetsVisibles.map((widget) => (
            <SortableItem key={widget.id} id={widget.id}>
              {(dragHandle) => renderWidget(widget.tipo, dragHandle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
