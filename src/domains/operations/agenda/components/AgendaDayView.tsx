import React, { useMemo, useState, useRef, useEffect } from 'react'
import { Plus, AlertTriangle, Calendar } from 'lucide-react'
import { DndContext, type DragEndEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Cita } from '../schemas/citaSchema'
import { AppointmentCard } from './AppointmentCard'
import { ModalConfirmacionMovimiento } from './ModalConfirmacionMovimiento'
import { validarSlotDisponible, obtenerColorBordeSlot } from '../utils/validarSlotDisponible'
import { sonidoAgendaService } from '../services/sonidoAgendaService'
import { registrarCambioEstado } from '../utils/auditoriaCita'
import { usePermisosAgenda, puedeArrastrarCita } from '../utils/permisosAgenda'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { TIPOS_BLOQUEO } from '../constants/agendaConstants'

const getColorBloqueo = (b: Cita): string => b.colorBloqueo || Object.values(TIPOS_BLOQUEO).find((t) => t.label === b.motivoBloqueo || t.id === b.tipoBloqueoId)?.color || '#94A3B8'
const getIconBloqueo = (b: Cita) => Object.values(TIPOS_BLOQUEO).find((t) => t.label === b.motivoBloqueo || t.id === b.tipoBloqueoId)?.icon || Calendar

const calcularHoraFin = (hInicio: string, dur: number): string => {
  const [h, m] = hInicio.split(':').map(Number); const total = (h || 0) * 60 + (m || 0) + (dur || 30)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export interface MovePayload { horaInicio: string; fecha?: string; doctor?: string; box?: string }

export interface AgendaDayViewProps {
  appointments: Cita[]
  doctors?: { id: string | number; nombre: string; colorIdentidad?: string; [key: string]: unknown }[]
  boxes?: { id: string | number; nombre: string; [key: string]: unknown }[]
  selectedDoctor?: string; selectedBox?: string; currentDateIso: string
  onAppointmentClick?: (appointment: Cita) => void
  onSlotClick?: (dateIso: string, time: string, doctor?: string, box?: string) => void
  onAppointmentMove?: (citaId: string | number, payload: MovePayload) => void
  onWhatsAppClick?: (cita: Cita) => void; onLlamarSiguiente?: (cita: Cita) => void
  onAbrirCambiarEstado?: (cita: Cita) => void
  onEstadoChange?: (citaId: string | number, nuevoEstado: string) => void
  onReasignar?: (cita: Cita) => void; onEditar?: (cita: Cita) => void
}

const HORAS_JORNADA = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00']

import { DroppableSlot } from './DroppableSlot'

const DraggableCard: React.FC<{
  appointment: Cita; onClick?: () => void; onWhatsAppClick?: (e: React.MouseEvent) => void
  onLlamarSiguiente?: (cita: Cita) => void; onAbrirCambiarEstado?: (cita: Cita) => void
  onReasignar?: (cita: Cita) => void; onEditar?: (cita: Cita) => void; draggable?: boolean
  slotHora?: string; slotColumnaId?: string
}> = ({ appointment, onClick, onWhatsAppClick, onLlamarSiguiente, onAbrirCambiarEstado, onReasignar, onEditar, draggable = true, slotHora, slotColumnaId }) => {
  const permisos = usePermisosAgenda()
  const userProfile = useSesionStore((s) => s.userProfile)
  const puedeArrastrar = puedeArrastrarCita(permisos, appointment, userProfile)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(appointment.id), disabled: !puedeArrastrar || !draggable,
    data: { hora: slotHora, columnaId: slotColumnaId, appointment },
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      <AppointmentCard
        appointment={appointment} onClick={onClick} draggable={puedeArrastrar && draggable}
        dragHandleProps={puedeArrastrar ? { ...attributes, ...listeners } : undefined}
        onWhatsAppClick={onWhatsAppClick} onLlamarSiguiente={onLlamarSiguiente}
        onSerieClick={onClick ? () => onClick() : undefined}
        onAbrirCambiarEstado={onAbrirCambiarEstado}
        onReasignar={onReasignar ? () => onReasignar(appointment) : undefined}
        onEditar={onEditar}
      />
    </div>
  )
}

export const AgendaDayView: React.FC<AgendaDayViewProps> = ({
  appointments, doctors = [], boxes = [], selectedDoctor = 'Todos', selectedBox = 'Todos',
  currentDateIso, onAppointmentClick, onSlotClick, onAppointmentMove, onWhatsAppClick, onLlamarSiguiente,
  onAbrirCambiarEstado, onReasignar, onEditar
}) => {
  const permisos = usePermisosAgenda()
  const userProfile = useSesionStore((s) => s.userProfile)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [movimientoPendiente, setMovimientoPendiente] = useState<{
    cita: Cita; nuevoHorario: { fecha: string; horaInicio: string; horaFin?: string; doctor?: string; box?: string }
    validacion: ReturnType<typeof validarSlotDisponible>
  } | null>(null)

  const citasFiltradas = useMemo(() => {
    return appointments.filter((cita) => {
      if (selectedDoctor !== 'Todos' && cita.doctor && cita.doctor !== selectedDoctor) return false
      if (selectedBox !== 'Todos' && cita.boxAsignado && cita.boxAsignado !== selectedBox) return false
      return true
    })
  }, [appointments, selectedDoctor, selectedBox])

  useEffect(() => {
    if (!timelineRef.current) return
    const ahora = new Date()
    const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:00`
    const primeraHoraCita = citasFiltradas.length > 0 ? citasFiltradas.reduce((min, c) => (c.horaInicio < min ? c.horaInicio : min), '23:00') : horaActual
    const horaObjetivo = primeraHoraCita < horaActual ? primeraHoraCita : horaActual
    const idxHora = HORAS_JORNADA.indexOf(horaObjetivo)
    if (idxHora >= 0) timelineRef.current.scrollTop = Math.max(0, (idxHora - 1) * 76)
  }, [citasFiltradas])

  const columnas = useMemo(() => {
    let cols = doctors.map((d) => ({
      id: d.nombre,
      nombre: d.nombre,
      colorIdentidad: d.colorIdentidad || '#64748B',
    }))
    if (selectedDoctor !== 'Todos') {
      cols = cols.filter((c) => c.nombre === selectedDoctor)
    }
    const sinAsignar = appointments.some((c) => !c.doctor)
    if (sinAsignar && selectedDoctor === 'Todos') {
      cols.unshift({ id: 'Sin asignar', nombre: 'Sin asignar', colorIdentidad: '#94A3B8' })
    }
    if (cols.length === 0) {
      cols = [{ id: 'Agenda General', nombre: 'Agenda General', colorIdentidad: '#64748B' }]
    }
    return cols
  }, [doctors, appointments, selectedDoctor])

  const citasDeColumna = (colId: string) =>
    citasFiltradas.filter((c) => (colId === 'Sin asignar' ? !c.doctor : c.doctor === colId))

  const citaActiva = useMemo(() => (activeDragId ? appointments.find((c) => String(c.id) === String(activeDragId)) : null), [activeDragId, appointments])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!permisos.dragAndDrop || !over || active.id === over.id || !onAppointmentMove) return
    const targetData = over.data?.current as { hora?: string; columnaId?: string } | undefined
    if (!targetData?.hora) return
    const cita = appointments.find((c) => String(c.id) === String(active.id))
    if (!cita || !puedeArrastrarCita(permisos, cita, userProfile)) return

    const nuevoDoctor = targetData.columnaId === 'Sin asignar' ? undefined : targetData.columnaId
    const nuevoHorario = {
      fecha: currentDateIso, horaInicio: targetData.hora,
      horaFin: calcularHoraFin(targetData.hora, Number(cita.duracionMinutos) || 30),
      doctor: nuevoDoctor, box: cita.boxAsignado,
    }
    const validacion = validarSlotDisponible(cita.id, nuevoHorario.fecha, nuevoHorario.horaInicio, nuevoHorario.horaFin, nuevoHorario.doctor, nuevoHorario.box, appointments, true)
    if (!validacion.disponible) return
    setMovimientoPendiente({ cita, nuevoHorario, validacion })
  }

  const handleConfirmarMovimiento = async (notificarWhatsApp: boolean) => {
    if (!movimientoPendiente) return
    const { cita, nuevoHorario } = movimientoPendiente
    onAppointmentMove?.(String(cita.id), {
      horaInicio: nuevoHorario.horaInicio,
      fecha: currentDateIso,
      doctor: nuevoHorario.doctor,
      box: nuevoHorario.box,
    })
    const uId = (userProfile as { id?: string })?.id || 'local-user'
    await registrarCambioEstado(cita.id, `Anterior: ${cita.horaInicio} ${cita.doctor || ''}`, `Nuevo: ${nuevoHorario.horaInicio} ${nuevoHorario.doctor || ''}`, uId, `Cita movida de ${cita.horaInicio} a ${nuevoHorario.horaInicio}`)
    if (notificarWhatsApp && cita.pacienteTelefono) console.log('Notificar por WhatsApp:', cita.pacienteTelefono)
    sonidoAgendaService.play('cita_movida')
    setMovimientoPendiente(null)
  }

  const gridColsStyle = { gridTemplateColumns: `80px repeat(${columnas.length}, minmax(260px, 1fr))` }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveDragId(String(e.active.id))} onDragEnd={handleDragEnd}>
      <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xs flex flex-col">
        <div className="grid border-b border-surface-border bg-surface-muted/40 text-xs font-bold text-[#0F172A] dark:text-white sticky top-0 z-10" style={gridColsStyle}>
          <div className="p-3 border-r border-surface-border flex items-center justify-center text-slate-400">Hora</div>
          {columnas.map((col) => {
            const count = citasDeColumna(col.id).length
            return (
              <div key={col.id} className="p-3 border-r border-surface-border last:border-r-0 flex items-center justify-between" style={{ borderTop: `3px solid ${col.colorIdentidad}` }}>
                <span className="truncate">{col.nombre}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {count} {count === 1 ? 'cita' : 'citas'}
                </span>
              </div>
            )
          })}
        </div>

        <div ref={timelineRef} className="divide-y divide-surface-border max-h-[700px] overflow-y-auto scroll-smooth">
          {HORAS_JORNADA.map((hora) => (
            <div key={hora} className="grid min-h-[76px] transition-colors hover:bg-surface-muted/20" style={gridColsStyle}>
              <div className="p-2 border-r border-surface-border flex items-start justify-center font-bold text-xs text-slate-400 select-none">{hora}</div>
              {columnas.map((col) => {
                const citasEnSlot = citasDeColumna(col.id).filter((c) => c.horaInicio?.startsWith(hora.slice(0, 2)))
                const haySobrecupo = citasEnSlot.length > 1
                const validacionSlot = activeDragId && citaActiva ? validarSlotDisponible(citaActiva.id, currentDateIso, hora, calcularHoraFin(hora, Number(citaActiva.duracionMinutos) || 30), col.id === 'Sin asignar' ? undefined : col.nombre, undefined, appointments, true) : null

                return (
                  <DroppableSlot
                    key={`${col.id}-${hora}`}
                    slotId={`${col.id}__${hora}`}
                    data={{ hora, columnaId: col.id }}
                    className={validacionSlot ? obtenerColorBordeSlot(validacionSlot) : ''}
                    onClick={() => permisos.crearCitas && onSlotClick?.(currentDateIso, hora, col.id === 'Sin asignar' ? undefined : col.id)}
                  >
                    {haySobrecupo && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 mb-1 w-fit" role="alert" aria-label={`Sobrecupo: ${citasEnSlot.length} pacientes`}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>{citasEnSlot.length} pacientes</span>
                      </div>
                    )}
                    {citasEnSlot.map((cita) => (
                      <div key={cita.id} onClick={(e) => e.stopPropagation()}>
                        {cita.esBloqueo ? (
                          <div onClick={() => onAppointmentClick?.(cita)} className="rounded-lg p-2 border-l-4 shadow-2xs cursor-pointer transition-all hover:brightness-95" style={{ backgroundColor: `${getColorBloqueo(cita)}20`, borderLeftColor: getColorBloqueo(cita) }}>
                            <div className="flex items-center gap-1.5">
                              {(() => { const Icon = getIconBloqueo(cita); return <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: getColorBloqueo(cita) }} /> })()}
                              <span className="text-xs font-bold truncate" style={{ color: getColorBloqueo(cita) }}>{cita.motivoBloqueo || 'Bloqueo'}</span>
                            </div>
                            {cita.observaciones && <p className="text-[10px] text-graphite-600 dark:text-graphite-400 mt-1 truncate">{cita.observaciones}</p>}
                          </div>
                        ) : (
                          <DraggableCard appointment={cita} onClick={() => onAppointmentClick?.(cita)} onWhatsAppClick={() => onWhatsAppClick?.(cita)} onLlamarSiguiente={onLlamarSiguiente} onAbrirCambiarEstado={onAbrirCambiarEstado} onReasignar={onReasignar} onEditar={onEditar} draggable={permisos.dragAndDrop} slotHora={hora} slotColumnaId={col.id} />
                        )}
                      </div>
                    ))}
                    {citasEnSlot.length === 0 && permisos.crearCitas && (
                      <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#B88E3A]"><Plus className="w-3 h-3" /> Agendar {hora}</span>
                      </div>
                    )}
                  </DroppableSlot>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <DragOverlay>{citaActiva ? <div className="w-64 shadow-2xl rotate-2"><AppointmentCard appointment={citaActiva} /></div> : null}</DragOverlay>
      <ModalConfirmacionMovimiento
        isOpen={movimientoPendiente !== null} cita={movimientoPendiente?.cita || null}
        nuevoHorario={movimientoPendiente?.nuevoHorario || null}
        hayConflicto={movimientoPendiente?.validacion.hayConflicto || false}
        citasEnConflicto={movimientoPendiente?.validacion.citasEnConflicto || []}
        alCerrar={() => setMovimientoPendiente(null)} alConfirmar={handleConfirmarMovimiento}
      />
    </DndContext>
  )
}
