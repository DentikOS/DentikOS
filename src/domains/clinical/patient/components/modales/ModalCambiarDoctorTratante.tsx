import React, { useState } from 'react'
import { UserCheck, X } from 'lucide-react'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../../../app/stores/sesionStore'
import { DOCTORES_CLINICA_DEFAULT } from '../../utils/formatearDoctor'
import { timelineService } from '../../services/timelineService'
import type { Paciente } from '../../schemas/pacienteSchema'

interface ModalCambiarDoctorTratanteProps {
  paciente: Paciente
  isOpen: boolean
  onClose: () => void
}

export const ModalCambiarDoctorTratante: React.FC<ModalCambiarDoctorTratanteProps> = ({
  paciente,
  isOpen,
  onClose,
}) => {
  const actualizarPaciente = usePacientesStore((s) => s.actualizarPaciente)
  const userProfile = useSesionStore((s) => s.userProfile)
  const [doctorSeleccionadoId, setDoctorSeleccionadoId] = useState<string>(
    paciente.doctorTratanteId || DOCTORES_CLINICA_DEFAULT[0].id
  )
  const [motivo, setMotivo] = useState('')

  if (!isOpen) return null

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    const docEncontrado = DOCTORES_CLINICA_DEFAULT.find((d) => d.id === doctorSeleccionadoId)
    const nombreDoctor = docEncontrado?.nombre || 'Doctor Asignado'
    const usuarioActual = userProfile?.nombreCompleto || userProfile?.email || 'Administrador'

    // 1. Actualizar estado y persistencia de inmediato
    actualizarPaciente(paciente.id, {
      doctorTratanteId: doctorSeleccionadoId,
      doctorTratante: nombreDoctor,
    })

    // 2. Registrar en Timeline
    const descripcionTimeline = motivo.trim()
      ? `Motivo: ${motivo.trim()}`
      : 'Reasignación directa desde el listado'
    timelineService.agregarEvento(paciente.id, {
      tipo: 'administrativo',
      titulo: `Paciente reasignado a ${nombreDoctor} por ${usuarioActual}`,
      descripcion: descripcionTimeline,
      profesional: usuarioActual,
    })

    notificationService.mostrar(
      `Doctor tratante actualizado a ${nombreDoctor}`,
      { tipo: 'exito' }
    )
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <form onSubmit={handleGuardar} className="space-y-4 p-1" data-testid={`modal-cambiar-doctor-${paciente.id}`}>
        <div className="flex items-center justify-between pb-2 border-b border-surface">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Cambiar Doctor Tratante
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-graphite-400 hover:text-graphite-600"
            aria-label="Cerrar modal cambiar doctor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-graphite-600 dark:text-graphite-300">
          Paciente: <strong>{paciente.nombre || paciente.nombreCompleto}</strong>
        </p>

        <div>
          <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300 mb-1">
            Doctor Tratante de la Clínica
          </label>
          <select
            value={doctorSeleccionadoId}
            onChange={(e) => setDoctorSeleccionadoId(e.target.value)}
            className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary"
          >
            {DOCTORES_CLINICA_DEFAULT.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.nombre} {doc.especialidad ? `(${doc.especialidad})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300 mb-1">
            Motivo del cambio (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ej. Derivación interna a ortodoncista, solicitud de paciente..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full p-2 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-surface">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Confirmar Reasignación
          </Button>
        </div>
      </form>
    </Modal>
  )
}
