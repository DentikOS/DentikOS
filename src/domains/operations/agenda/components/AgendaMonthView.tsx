import React, { useMemo, useState } from 'react'
import { DndContext, type DragEndEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Cita } from '../schemas/citaSchema'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { DroppableSlot } from './DroppableSlot'
import type { MovePayload } from './AgendaDayView'

export interface AgendaMonthViewProps {
  appointments: Cita[]
  currentDateIso: string
  onDayClick?: (dateIso: string) => void
  onAppointmentClick?: (appointment: Cita) => void
  onAppointmentMove?: (citaId: string | number, payload: MovePayload) => void
}

const DIAS_CABECERA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const DraggableMonthChip: React.FC<{ cita: Cita; onClick?: () => void }> = ({ cita, onClick }) => {
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
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      className="text-[10px] font-medium px-1 py-0.5 rounded bg-surface border border-surface-border truncate cursor-grab active:cursor-grabbing hover:border-[#B88E3A]/60"
      title={`${cita.horaInicio} - ${cita.pacienteNombre}`}
    >
      <span className="font-bold text-[#B88E3A] mr-1">{String(cita.horaInicio).slice(0, 5)}</span>
      <span>{cita.pacienteNombre || 'Paciente'}</span>
    </div>
  )
}

export const AgendaMonthView: React.FC<AgendaMonthViewProps> = ({
  appointments,
  currentDateIso,
  onDayClick,
  onAppointmentClick,
  onAppointmentMove,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const citaActiva = useMemo(() => (activeDragId ? appointments.find((c) => String(c.id) === String(activeDragId)) : null), [activeDragId, appointments])

  const { celdas, mesNombre, anio } = useMemo(() => {
    const fecha = new Date(currentDateIso + 'T00:00:00')
    const anio = fecha.getFullYear()
    const mes = fecha.getMonth()
    const mesNombre = fecha.toLocaleDateString('es-CL', { month: 'long' })
    const primerDiaMes = new Date(anio, mes, 1)
    const ultimoDiaMes = new Date(anio, mes + 1, 0)
    const primerDiaSemana = primerDiaMes.getDay() === 0 ? 7 : primerDiaMes.getDay()
    const diasEnMes = ultimoDiaMes.getDate()
    const celdas = []

    for (let i = 1; i < primerDiaSemana; i++) {
      celdas.push({ dia: null, iso: null, esMesActual: false })
    }
    for (let d = 1; d <= diasEnMes; d++) {
      const dObj = new Date(anio, mes, d)
      const iso = obtenerFechaLocalISO(dObj)
      celdas.push({
        dia: d,
        iso,
        esMesActual: true,
        esHoy: iso === obtenerFechaLocalISO()
      })
    }
    return { celdas, mesNombre, anio }
  }, [currentDateIso])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id || !onAppointmentMove) return
    const targetData = over.data?.current as { fecha?: string } | undefined
    if (!targetData?.fecha) return
    const cita = appointments.find((c) => String(c.id) === String(active.id))
    if (!cita) return
    onAppointmentMove(String(cita.id), {
      horaInicio: cita.horaInicio,
      fecha: targetData.fecha,
      doctor: cita.doctor,
      box: cita.boxAsignado,
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveDragId(String(e.active.id))} onDragEnd={handleDragEnd}>
      <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xs flex flex-col" role="region" aria-label="Calendario mensual">
        <div className="p-3 border-b border-surface-border bg-surface-muted/30 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#0F172A] dark:text-white capitalize">
            {mesNombre} {anio}
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {appointments.length} citas registradas
          </span>
        </div>

        <div className="grid grid-cols-7 border-b border-surface-border bg-surface-muted/50 text-center text-xs font-bold text-slate-500 py-2">
          {DIAS_CABECERA.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-surface-border border-b border-surface-border">
          {celdas.map((celda, idx) => {
            if (!celda.esMesActual || !celda.iso) {
              return <div key={`empty-${idx}`} className="min-h-[96px] bg-surface-muted/10 p-2 opacity-30 select-none" />
            }

            const citasDia = appointments.filter((c) => c.fecha === celda.iso)
            const confirmadas = citasDia.filter((c) => c.estado === 'Confirmada' || c.estado === 'Confirmado').length
            const pendientes = citasDia.filter((c) => c.estado === 'Pendiente' || c.estado === 'Agendado').length
            const canceladas = citasDia.filter((c) => c.estado === 'Cancelada' || c.estado === 'Anulado').length

            return (
              <DroppableSlot
                key={celda.iso}
                slotId={`day__${celda.iso}`}
                data={{ fecha: celda.iso }}
                className={`min-h-[96px] p-2 flex flex-col justify-between hover:bg-surface-muted/30 cursor-pointer transition-colors ${
                  celda.esHoy ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                }`}
                onClick={() => onDayClick?.(celda.iso!)}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${celda.esHoy ? 'w-6 h-6 rounded-full bg-[#B88E3A] text-white flex items-center justify-center' : 'text-slate-700 dark:text-slate-200'}`}>
                    {celda.dia}
                  </span>
                  {citasDia.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {citasDia.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 my-1">
                  {citasDia.slice(0, 2).map((cita) => (
                    <DraggableMonthChip key={cita.id} cita={cita} onClick={() => onAppointmentClick?.(cita)} />
                  ))}
                  {citasDia.length > 2 && (
                    <span className="text-[9px] text-slate-400 font-semibold block">+{citasDia.length - 2} más</span>
                  )}
                </div>

                {citasDia.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {confirmadas > 0 && <span className="w-2 h-2 rounded-full bg-teal-500" title={`${confirmadas} confirmadas`} />}
                    {pendientes > 0 && <span className="w-2 h-2 rounded-full bg-amber-500" title={`${pendientes} pendientes`} />}
                    {canceladas > 0 && <span className="w-2 h-2 rounded-full bg-rose-500" title={`${canceladas} canceladas`} />}
                  </div>
                )}
              </DroppableSlot>
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {citaActiva ? (
          <div className="p-1.5 rounded-lg border border-[#B88E3A] bg-surface shadow-xl rotate-2 w-36 text-[10px] font-bold truncate">
            {citaActiva.pacienteNombre || 'Paciente'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
