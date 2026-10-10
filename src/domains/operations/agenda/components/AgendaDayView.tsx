import React, { useMemo, useState } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { DndContext, type DragEndEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Cita } from '../schemas/citaSchema'
import { AppointmentCard } from './AppointmentCard'
import { usePermisosAgenda } from '../utils/permisosAgenda'

export interface AgendaDayViewProps {
  appointments: Cita[]
  doctors?: { id: string; nombre: string }[]
  boxes?: { id: string; nombre: string }[]
  selectedDoctor?: string
  selectedBox?: string
  currentDateIso: string
  onAppointmentClick?: (appointment: Cita) => void
  onSlotClick?: (dateIso: string, time: string, doctor?: string, box?: string) => void
  onAppointmentMove?: (appointmentId: string | number, newTime: string, newDoctor?: string, newBox?: string) => void
  onWhatsAppClick?: (cita: Cita) => void
}

const HORAS_JORNADA = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
]

const DraggableCard: React.FC<{
  appointment: Cita
  onClick?: () => void
  onWhatsAppClick?: (e: React.MouseEvent) => void
  draggable?: boolean
}> = ({ appointment, onClick, onWhatsAppClick, draggable = true }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(appointment.id),
    disabled: !draggable
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <div ref={setNodeRef} style={style}>
      <AppointmentCard
        appointment={appointment}
        onClick={onClick}
        draggable={draggable}
        dragHandleProps={draggable ? { ...attributes, ...listeners } : undefined}
        onWhatsAppClick={onWhatsAppClick}
      />
    </div>
  )
}

export const AgendaDayView: React.FC<AgendaDayViewProps> = ({
  appointments,
  doctors = [],
  boxes = [],
  selectedDoctor = 'Todos',
  selectedBox = 'Todos',
  currentDateIso,
  onAppointmentClick,
  onSlotClick,
  onAppointmentMove,
  onWhatsAppClick
}) => {
  const permisos = usePermisosAgenda()
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Filtrar citas por doctor y box
  const citasFiltradas = useMemo(() => {
    return appointments.filter((cita) => {
      if (selectedDoctor !== 'Todos' && cita.doctor && cita.doctor !== selectedDoctor) return false
      if (selectedBox !== 'Todos' && cita.boxAsignado && cita.boxAsignado !== selectedBox) return false
      return true
    })
  }, [appointments, selectedDoctor, selectedBox])

  // Columnas activas: si hay doctores definidos y no está filtrado uno solo, columnas por doctor; si no, por box o global
  const columnas = useMemo(() => {
    if (doctors.length > 0 && selectedDoctor === 'Todos') {
      return doctors.map((d) => ({ id: d.id, titulo: d.nombre, tipo: 'doctor' }))
    }
    if (boxes.length > 0 && selectedBox === 'Todos') {
      return boxes.map((b) => ({ id: b.id, titulo: b.nombre, tipo: 'box' }))
    }
    return [{ id: 'col-default', titulo: selectedDoctor !== 'Todos' ? selectedDoctor : 'Agenda General', tipo: 'default' }]
  }, [doctors, boxes, selectedDoctor, selectedBox])

  const [pendingMove, setPendingMove] = useState<{ appointment: Cita; newTime: string; newCol?: string } | null>(null)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id || !onAppointmentMove) return
    const targetData = over.data?.current as { hora?: string; columnaId?: string } | undefined
    if (targetData?.hora) {
      const cita = appointments.find((c) => String(c.id) === String(active.id))
      if (cita) {
        setPendingMove({ appointment: cita, newTime: targetData.hora, newCol: targetData.columnaId })
      } else {
        onAppointmentMove(String(active.id), targetData.hora, targetData.columnaId)
      }
    }
  }

  const citaActiva = useMemo(() => {
    if (!activeDragId) return null
    return appointments.find((c) => String(c.id) === String(activeDragId))
  }, [activeDragId, appointments])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveDragId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xs flex flex-col">
        {/* Cabecera de columnas */}
        <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(240px,1fr))] border-b border-surface-border bg-surface-muted/40 text-xs font-bold text-[#0F172A] dark:text-white sticky top-0 z-10">
          <div className="p-3 border-r border-surface-border flex items-center justify-center text-slate-400">
            Hora
          </div>
          {columnas.map((col) => (
            <div key={col.id} className="p-3 border-r border-surface-border last:border-r-0 flex items-center justify-between">
              <span className="truncate">{col.titulo}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {citasFiltradas.filter((c) => (col.tipo === 'doctor' ? c.doctor === col.titulo : true)).length} citas
              </span>
            </div>
          ))}
        </div>

        {/* Timeline body */}
        <div className="divide-y divide-surface-border max-h-[700px] overflow-y-auto">
          {HORAS_JORNADA.map((hora) => {
            const horaPrefijo = hora.slice(0, 2)
            return (
              <div key={hora} className="grid grid-cols-[80px_repeat(auto-fit,minmax(240px,1fr))] min-h-[76px] transition-colors hover:bg-surface-muted/20">
                {/* Etiqueta de hora */}
                <div className="p-2 border-r border-surface-border flex items-start justify-center font-bold text-xs text-slate-400 select-none">
                  {hora}
                </div>

                {/* Slots por columna */}
                {columnas.map((col) => {
                  const citasEnSlot = citasFiltradas.filter((c) => {
                    const matchHora = c.horaInicio?.startsWith(horaPrefijo)
                    const matchCol = col.tipo === 'doctor' ? c.doctor === col.titulo : col.tipo === 'box' ? c.boxAsignado === col.titulo : true
                    return matchHora && matchCol
                  })
                  const haySobrecupo = citasEnSlot.length > 1

                  return (
                    <div
                      key={`${hora}-${col.id}`}
                      onClick={() => permisos.crearCitas && onSlotClick?.(currentDateIso, hora, col.titulo)}
                      className="p-1.5 border-r border-surface-border last:border-r-0 relative group min-h-[76px] flex flex-col gap-1.5 cursor-pointer"
                    >
                      {haySobrecupo && (
                        <div className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 w-fit">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Sobrecupo: {citasEnSlot.length} pacientes</span>
                        </div>
                      )}

                      {citasEnSlot.map((cita) => (
                        <div key={cita.id} onClick={(e) => e.stopPropagation()}>
                          <DraggableCard
                            appointment={cita}
                            onClick={() => onAppointmentClick?.(cita)}
                            onWhatsAppClick={() => onWhatsAppClick?.(cita)}
                            draggable={permisos.dragAndDrop}
                          />
                        </div>
                      ))}

                      {citasEnSlot.length === 0 && permisos.crearCitas && (
                        <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#B88E3A]">
                            <Plus className="w-3 h-3" /> Agendar {hora}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {citaActiva ? (
          <div className="w-64 shadow-2xl rotate-2">
            <AppointmentCard appointment={citaActiva} />
          </div>
        ) : null}
      </DragOverlay>

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface border border-surface-border rounded-2xl shadow-xl p-5 space-y-4">
            <h3 className="font-bold text-base text-[#0F172A] dark:text-white">Mover cita</h3>
            <p className="text-xs text-slate-500">¿Mover cita de {pendingMove.appointment.pacienteNombre || 'Paciente'}?</p>
            <div className="p-3 rounded-xl bg-surface-muted text-xs space-y-1">
              <p><strong>De:</strong> {pendingMove.appointment.horaInicio} ({pendingMove.appointment.boxAsignado || 'Box 1'})</p>
              <p><strong>A:</strong> {pendingMove.newTime} {pendingMove.newCol ? `(${pendingMove.newCol})` : ''}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-[#B88E3A]" />
              <span>Notificar al paciente por WhatsApp</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-surface-muted text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onAppointmentMove?.(pendingMove.appointment.id, pendingMove.newTime, pendingMove.newCol)
                  setPendingMove(null)
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#B88E3A] hover:bg-[#a07a30] text-white transition-colors cursor-pointer"
              >
                Confirmar movimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  )
}
