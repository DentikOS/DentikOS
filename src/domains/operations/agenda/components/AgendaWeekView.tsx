import React, { useMemo, useState } from 'react'
import { Plus, Clock } from 'lucide-react'
import { DndContext, type DragEndEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Cita } from '../schemas/citaSchema'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { DroppableSlot } from './DroppableSlot'
import type { MovePayload } from './AgendaDayView'

export interface AgendaWeekViewProps {
  appointments: Cita[]
  currentDateIso: string
  onAppointmentClick?: (appointment: Cita) => void
  onDayClick?: (dateIso: string) => void
  onNewAppointment?: (dateIso: string) => void
  onAppointmentMove?: (citaId: string | number, payload: MovePayload) => void
  onSlotClick?: (dateIso: string, time: string) => void
}

const DIAS_NOMBRE = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const DraggableWeekCard: React.FC<{ cita: Cita; onClick?: () => void }> = ({ cita, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(cita.id),
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="p-2 rounded-xl border border-surface-border bg-surface hover:border-[#B88E3A]/60 hover:shadow-xs transition-all cursor-grab active:cursor-grabbing space-y-1"
    >
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
          <Clock className="w-2.5 h-2.5 text-[#B88E3A]" />
          {String(cita.horaInicio).slice(0, 5)}
        </span>
        <span className="truncate max-w-[60px] text-[10px] text-slate-400">
          {cita.boxAsignado || 'Box 1'}
        </span>
      </div>
      <p className="font-bold text-xs text-[#0F172A] dark:text-white truncate">
        {cita.pacienteNombre || 'Paciente'}
      </p>
      <p className="text-[10px] text-slate-500 truncate">{cita.trataMiento || cita.motivo || 'Consulta'}</p>
    </div>
  )
}

export const AgendaWeekView: React.FC<AgendaWeekViewProps> = ({
  appointments,
  currentDateIso,
  onAppointmentClick,
  onDayClick,
  onNewAppointment,
  onAppointmentMove,
  onSlotClick,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const citaActiva = useMemo(() => (activeDragId ? appointments.find((c) => String(c.id) === String(activeDragId)) : null), [activeDragId, appointments])

  const diasSemana = useMemo(() => {
    const fecha = new Date(currentDateIso + 'T00:00:00')
    const diaActual = fecha.getDay()
    const diffToMonday = diaActual === 0 ? -6 : 1 - diaActual

    const lunes = new Date(fecha)
    lunes.setDate(fecha.getDate() + diffToMonday)

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      const iso = obtenerFechaLocalISO(d)
      return {
        iso,
        nombre: DIAS_NOMBRE[i],
        numero: d.getDate(),
        esHoy: iso === obtenerFechaLocalISO()
      }
    })
  }, [currentDateIso])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id || !onAppointmentMove) return
    const targetData = over.data?.current as { hora?: string; fecha?: string; columnaId?: string } | undefined
    if (!targetData?.fecha && !targetData?.hora) return
    const cita = appointments.find((c) => String(c.id) === String(active.id))
    if (!cita) return

    const nuevaFecha = targetData.fecha || cita.fecha
    const nuevaHora = targetData.hora || cita.horaInicio
    onAppointmentMove(String(cita.id), {
      horaInicio: nuevaHora,
      fecha: nuevaFecha,
      doctor: targetData.columnaId || cita.doctor,
      box: cita.boxAsignado,
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveDragId(String(e.active.id))} onDragEnd={handleDragEnd}>
      <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xs flex flex-col" role="region" aria-label="Calendario semanal">
        <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-surface-border min-h-[500px]">
          {diasSemana.map((dia) => {
            const citasDelDia = appointments
              .filter((c) => c.fecha === dia.iso)
              .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''))

            return (
              <div
                key={dia.iso}
                className={`flex flex-col flex-1 p-3 transition-colors ${
                  dia.esHoy ? 'bg-amber-50/20 dark:bg-amber-950/10' : 'hover:bg-surface-muted/20'
                }`}
              >
                <div
                  onClick={() => onDayClick?.(dia.iso)}
                  className="flex items-center justify-between pb-2 border-b border-surface-border cursor-pointer group"
                >
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase">{dia.nombre}</span>
                    <p className={`text-lg font-bold ${dia.esHoy ? 'text-[#B88E3A]' : 'text-[#0F172A] dark:text-white'} group-hover:text-[#B88E3A] transition-colors`}>
                      {dia.numero}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {citasDelDia.length}
                  </span>
                </div>

                <DroppableSlot
                  slotId={`week__${dia.iso}`}
                  data={{ fecha: dia.iso }}
                  className="flex-1 space-y-2 py-3 overflow-y-auto max-h-[550px] min-h-[140px]"
                  onClick={() => onSlotClick?.(dia.iso, '09:00')}
                >
                  {citasDelDia.map((cita) => (
                    <DraggableWeekCard key={cita.id} cita={cita} onClick={() => onAppointmentClick?.(cita)} />
                  ))}

                  {citasDelDia.length === 0 && (
                    <div
                      onClick={(e) => { e.stopPropagation(); onNewAppointment?.(dia.iso) }}
                      className="h-28 border border-dashed border-surface-border/80 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-[#B88E3A] hover:border-[#B88E3A]/40 transition-colors cursor-pointer group"
                    >
                      <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-medium">Disponible</span>
                    </div>
                  )}
                </DroppableSlot>
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {citaActiva ? (
          <div className="p-2 rounded-xl border border-[#B88E3A] bg-surface shadow-xl rotate-2 w-48">
            <p className="font-bold text-xs text-[#0F172A] dark:text-white truncate">{citaActiva.pacienteNombre || 'Paciente'}</p>
            <span className="text-[11px] text-slate-500">{String(citaActiva.horaInicio).slice(0, 5)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
