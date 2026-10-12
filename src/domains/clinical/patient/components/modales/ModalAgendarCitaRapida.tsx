import React, { useState, memo } from 'react'
import { CalendarPlus, X, CheckCircle2, TriangleAlert, Calendar } from 'lucide-react'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { useDoctoresClinica } from '../../hooks/useDoctoresClinica'
import { usePrestacionesStore } from '../../../../../app/stores/prestacionesStore'
import { useAgendaStore } from '../../../../../app/stores/useAgendaStore'
import { agendaStorageService } from '../../../../operations/agenda/services/agendaStorageService'
import { timelineService } from '../../services/timelineService'
import { BOXES_CITA_RAPIDA, PRESTACIONES_DEFAULT_RAPIDAS, obtenerFechaMananaISO, sumarMinutosHora } from './agendarCitaRapida.helpers'
import type { Paciente } from '../../schemas/pacienteSchema'
import type { Cita } from '../../../../operations/agenda/schemas/citaSchema'

export interface ModalAgendarCitaRapidaProps {
  paciente: Paciente
  doctorTratante?: string
  isOpen: boolean
  onClose: () => void
  onCitaCreada?: (cita: Cita) => void
}

export const ModalAgendarCitaRapida: React.FC<ModalAgendarCitaRapidaProps> = memo(({
  paciente, doctorTratante, isOpen, onClose, onCitaCreada,
}) => {
  const { doctores } = useDoctoresClinica(), prestaciones = usePrestacionesStore((s) => s.prestacionesArancel), citasExistentes = useAgendaStore((s) => s.citas)
  const [fecha, setFecha] = useState(obtenerFechaMananaISO), [hora, setHora] = useState('09:00')
  const [duracion, setDuracion] = useState(30), [box, setBox] = useState(BOXES_CITA_RAPIDA[0])
  const [doctorId, setDoctorId] = useState(() => paciente.doctorTratanteId || doctores[0]?.id || '')
  const [motivo, setMotivo] = useState(''), [notas, setNotas] = useState(''), [citaCreada, setCitaCreada] = useState<Cita | null>(null)

  if (!isOpen) return null
  const doc = doctores.find((d) => d.id === doctorId)
  const nombreDoctor: string = doc?.nombre || (typeof doctorTratante === 'string' ? doctorTratante : '') || (typeof paciente.doctorTratante === 'string' ? paciente.doctorTratante : '') || 'Doctor de Turno'
  const listaMotivos = prestaciones.length > 0 ? prestaciones.map((p) => p.nombre) : PRESTACIONES_DEFAULT_RAPIDAS
  const motivoFinal = motivo || listaMotivos[0]
  const conflicto = citasExistentes.some((c) => c.fecha === fecha && c.horaInicio === hora && (c.doctor === nombreDoctor || c.boxAsignado === box))

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const fechaISO = fecha.split('T')[0]
      const nuevaCita: Cita = {
        id: `cita-${Date.now()}`, fecha: fechaISO, horaInicio: hora, horaFin: sumarMinutosHora(hora, duracion),
        estado: 'Pendiente', pacienteId: paciente.id, pacienteNombre: paciente.nombre || paciente.nombreCompleto,
        pacienteRut: paciente.rut, pacienteTelefono: paciente.telefono ? String(paciente.telefono) : undefined, doctor: nombreDoctor,
        boxAsignado: box, motivo: motivoFinal, trataMiento: motivoFinal, duracionMinutos: duracion, observaciones: notas.trim() || undefined,
      }
      const actuales = useAgendaStore.getState().citas
      await agendaStorageService.guardarCitas([...actuales, nuevaCita])
      useAgendaStore.getState().addCita(nuevaCita)
      useAgendaStore.getState().setDateIso(fechaISO)
      await timelineService.agregarEvento(paciente.id, {
        id: `tl-cita-${Date.now()}`, fecha: new Date().toISOString(), tipo: 'cita',
        titulo: `Cita agendada para ${fechaISO} ${hora} con ${nombreDoctor}`, detalles: `Box: ${box} · Motivo: ${motivoFinal}`, profesional: nombreDoctor,
      })
      notificationService.mostrar('Cita agendada con éxito', { tipo: 'success' })
      setCitaCreada(nuevaCita)
      onCitaCreada?.(nuevaCita)
    } catch (error) {
      console.error('Error agendando cita:', error)
      notificationService.mostrar('Error al agendar cita', { tipo: 'error' })
    }
  }

  const handleVerEnAgenda = () => {
    useAgendaStore.getState().setDateIso(fecha)
    window.dispatchEvent(new CustomEvent('navegar_seccion', { detail: 'Agenda' }))
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      {citaCreada ? (
        <div className="space-y-4 p-2 text-center" data-testid={`modal-cita-confirmada-${paciente.id}`}>
          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Cita agendada con éxito</h3>
            <p className="text-xs text-graphite-600 dark:text-graphite-300 mt-1">{fecha} a las {hora} hrs con {nombreDoctor} ({box})</p>
          </div>
          <div className="flex justify-center gap-2 pt-2 border-t border-surface">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
            <Button type="button" variant="primary" size="sm" icon={Calendar} onClick={handleVerEnAgenda} data-testid="btn-ver-en-agenda">Ver en Agenda</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGuardar} className="space-y-3 p-1" data-testid={`modal-agendar-cita-${paciente.id}`}>
          <div className="flex items-center justify-between pb-2 border-b border-surface">
            <div className="flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-primary" /><h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Agendar Cita Rápida</h3></div>
            <button type="button" onClick={onClose} className="text-graphite-400 hover:text-graphite-600" aria-label="Cerrar modal"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-graphite-500 mb-0.5">Paciente</label>
            <input type="text" readOnly value={paciente.nombre || paciente.nombreCompleto} className="w-full p-2 bg-surface-muted/60 border border-surface rounded-xl text-xs text-graphite-600 font-medium cursor-not-allowed" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-graphite-700 dark:text-graphite-300 mb-0.5">Doctor tratante</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-xl text-xs">
                {doctores.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
                {!doctores.some((d) => d.id === doctorId) && (<option value={doctorId}>{nombreDoctor}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-graphite-700 dark:text-graphite-300 mb-0.5">Box / Sillón</label>
              <select value={box} onChange={(e) => setBox(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-xl text-xs">
                {BOXES_CITA_RAPIDA.map((b) => (<option key={b} value={b}>{b}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-graphite-700 dark:text-graphite-300 mb-0.5">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-xl text-xs" required />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-graphite-700 dark:text-graphite-300 mb-0.5">Hora</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-xl text-xs" required />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-graphite-700 dark:text-graphite-300 mb-0.5">Duración</label>
              <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className="w-full p-2 bg-surface border border-surface rounded-xl text-xs">
                <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-graphite-700 dark:text-graphite-300 mb-0.5">Motivo / Prestación</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-xl text-xs">
              {listaMotivos.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-graphite-700 dark:text-graphite-300 mb-0.5">Notas (Opcional)</label>
            <input type="text" placeholder="Ej. Paciente solicita..." value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-xl text-xs" />
          </div>
          {conflicto && (
            <div className="flex items-center gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-700 dark:text-amber-300">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0" /><span>Atención: Posible sobrecupo o cruce en este bloque.</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-surface"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" size="sm">Agendar Cita</Button></div>
        </form>
      )}
    </Modal>
  )
})

ModalAgendarCitaRapida.displayName = 'ModalAgendarCitaRapida'
