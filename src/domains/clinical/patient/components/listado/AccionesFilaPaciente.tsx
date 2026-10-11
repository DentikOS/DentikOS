import React, { useState, useRef } from 'react'
import { FileText, Calendar, MoreVertical, TriangleAlert } from 'lucide-react'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { BotonLlamarPopover } from './BotonLlamarPopover'
import { MenuContextualPaciente } from './MenuContextualPaciente'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
import { ModalEditarPaciente } from '../modales/ModalEditarPaciente'
import { ModalAsignarEtiqueta } from '../modales/ModalAsignarEtiqueta'
import { ModalCambiarDoctorTratante } from '../modales/ModalCambiarDoctorTratante'
import { FichaDerivacionModal } from '../ficha/plan-tratamiento/FichaDerivacionModal'
import { fichaResumenPDFService } from '../../services/fichaResumenPDFService'
import { timelineService } from '../../services/timelineService'
import type { Paciente } from '../../schemas/pacienteSchema'

export interface AccionesFilaPacienteProps {
  paciente: Paciente
  alSeleccionarPaciente: (p: Paciente) => void
  onAgendarCita?: (p: Paciente) => void
  onEditar?: (p: Paciente) => void
  onDesactivar?: (p: Paciente) => void
  onBloquear?: (p: Paciente) => void
}

export const AccionesFilaPaciente: React.FC<AccionesFilaPacienteProps> = ({
  paciente,
  alSeleccionarPaciente,
  onAgendarCita,
  onEditar,
  onDesactivar,
  onBloquear,
}) => {
  const { rol } = useRBAC()
  const btnMenuRef = useRef<HTMLButtonElement>(null)

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [alertaBloqueoAbierta, setAlertaBloqueoAbierta] = useState(false)
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
  const [modalDerivacionAbierto, setModalDerivacionAbierto] = useState(false)
  const [modalEtiquetasAbierto, setModalEtiquetasAbierto] = useState(false)
  const [modalDoctorAbierto, setModalDoctorAbierto] = useState(false)

  const esBloqueado = paciente.estado === 'bloqueado' || Boolean(paciente.bloqueado)
  const puedeAgendar = rol !== 'asistente'

  const handleAgendar = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (esBloqueado) {
      setAlertaBloqueoAbierta(true)
      return
    }
    if (onAgendarCita) {
      onAgendarCita(paciente)
    } else {
      window.dispatchEvent(
        new CustomEvent('navegar_agenda', {
          detail: { pacienteId: paciente.id, doctorTratante: paciente.doctorTratante },
        })
      )
      notificationService.mostrar(
        `Agendando cita para ${paciente.nombre || paciente.nombreCompleto}`,
        { tipo: 'info' }
      )
    }
  }

  const handleImprimir = () => {
    notificationService.mostrar('Generando ficha resumen para impresión...', { tipo: 'info' })
    fichaResumenPDFService.imprimirFichaResumen(paciente)
  }

  const handleExportar = () => {
    notificationService.mostrar('Ficha clínica descargada en PDF', { tipo: 'success' })
    fichaResumenPDFService.exportarFichaCompletaPDF(paciente)
  }

  const handleVerDocumentos = () => {
    alSeleccionarPaciente(paciente)
    usePacientesStore.getState().setPestanaActiva('recetas-consentimientos')
    notificationService.mostrar('Accediendo a documentos del paciente', { tipo: 'info' })
  }

  return (
    <div className="flex items-center gap-1 relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => alSeleccionarPaciente(paciente)}
        className="p-1.5 rounded-lg text-graphite-600 hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
        title="Ver ficha"
        aria-label="Ver ficha"
        data-testid={`btn-ficha-${paciente.id}`}
      >
        <FileText className="w-4 h-4" />
      </button>

      {puedeAgendar && (
        <button
          type="button"
          onClick={handleAgendar}
          className="p-1.5 rounded-lg text-graphite-600 hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Agendar cita"
          aria-label="Agendar cita"
          data-testid={`btn-agendar-${paciente.id}`}
        >
          <Calendar className="w-4 h-4" />
        </button>
      )}

      <BotonLlamarPopover paciente={paciente} telefono={paciente.telefono} />

      <div className="relative">
        <button
          ref={btnMenuRef}
          type="button"
          onClick={() => setMenuAbierto((prev) => !prev)}
          className="p-1.5 rounded-lg text-graphite-600 hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Más opciones"
          aria-label="Más opciones"
          data-testid={`btn-menu-contextual-${paciente.id}`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <MenuContextualPaciente
          paciente={paciente}
          isOpen={menuAbierto}
          triggerRef={btnMenuRef}
          onClose={() => setMenuAbierto(false)}
          onEditar={onEditar ? () => onEditar(paciente) : () => setModalEditarAbierto(true)}
          onImprimir={handleImprimir}
          onExportar={handleExportar}
          onDerivar={() => setModalDerivacionAbierto(true)}
          onAsignarEtiqueta={() => setModalEtiquetasAbierto(true)}
          onCambiarDoctor={() => setModalDoctorAbierto(true)}
          onVerDocumentos={handleVerDocumentos}
          onDesactivar={onDesactivar}
          onBloquear={onBloquear}
        />
      </div>

      {modalEditarAbierto && (
        <ModalEditarPaciente
          paciente={paciente}
          isOpen={true}
          onClose={() => setModalEditarAbierto(false)}
        />
      )}

      {modalDerivacionAbierto && (
        <FichaDerivacionModal
          nombrePaciente={paciente.nombre || paciente.nombreCompleto || 'Paciente'}
          onCerrar={() => setModalDerivacionAbierto(false)}
          onDerivar={(d) => {
            timelineService.agregarEvento(paciente.id, {
              id: `tl-deriv-${Date.now()}`,
              fecha: new Date().toISOString(),
              tipo: 'admin',
              titulo: `Derivación emitida a ${d.especialidad}`,
              detalles: `Especialista: ${d.especialista || 'No especificado'} · Motivo: ${d.motivo}`,
            })
            notificationService.mostrar('Ficha de derivación emitida con éxito', { tipo: 'success' })
            setModalDerivacionAbierto(false)
          }}
        />
      )}

      {modalEtiquetasAbierto && (
        <ModalAsignarEtiqueta
          paciente={paciente}
          isOpen={true}
          onClose={() => setModalEtiquetasAbierto(false)}
        />
      )}

      {modalDoctorAbierto && (
        <ModalCambiarDoctorTratante
          paciente={paciente}
          isOpen={true}
          onClose={() => setModalDoctorAbierto(false)}
        />
      )}

      {alertaBloqueoAbierta && (
        <Modal isOpen={true} onClose={() => setAlertaBloqueoAbierta(false)} size="sm" showCloseButton={false}>
          <div className="space-y-3 p-1" data-testid={`alerta-bloqueo-${paciente.id}`}>
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <TriangleAlert className="w-5 h-5 shrink-0" />
              <span>Paciente bloqueado</span>
            </div>
            <p className="text-xs text-graphite-600 dark:text-graphite-300">
              <strong>Motivo:</strong> {String(paciente.motivoBloqueo || 'Incumplimiento')}
            </p>
            <p className="text-[11px] text-graphite-400">
              Bloqueado por: {String(paciente.bloqueadoPor || 'Admin')} · {paciente.bloqueadoAt ? new Date(String(paciente.bloqueadoAt)).toLocaleDateString('es-CL') : 'Fecha no registrada'}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface">
              <Button variant="ghost" size="sm" onClick={() => setAlertaBloqueoAbierta(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setAlertaBloqueoAbierta(false)
                  notificationService.mostrar('Notificación enviada al administrador', { tipo: 'info' })
                }}
              >
                Contactar Admin
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
