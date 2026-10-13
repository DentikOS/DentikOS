import React, { useState, useEffect } from 'react'
import { UserCheck, X, Loader2 } from 'lucide-react'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../../../app/stores/sesionStore'
import { useDoctoresClinica } from '../../hooks/useDoctoresClinica'
import { timelineService } from '../../services/timelineService'
import { pacientesStorageService } from '../../services/pacientesStorageService'
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
  const actualizarPacienteStore = usePacientesStore((s) => s.actualizarPaciente)
  const userProfile = useSesionStore((s) => s.userProfile)
  const { doctores, loading } = useDoctoresClinica()
  const [doctorSeleccionadoId, setDoctorSeleccionadoId] = useState<string>(() => {
    const match = doctores.find((d) => d.id === paciente.doctorTratanteId)
    return match ? match.id : (doctores[0]?.id ?? '')
  })
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (doctores.length > 0) {
      const match = doctores.find((d) => d.id === doctorSeleccionadoId)
      if (!match) {
        const pacienteMatch = doctores.find((d) => d.id === paciente.doctorTratanteId)
        setDoctorSeleccionadoId(pacienteMatch ? pacienteMatch.id : doctores[0].id)
      }
    }
  }, [doctores, doctorSeleccionadoId, paciente.doctorTratanteId])

  if (!isOpen) return null

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const docEncontrado = doctores.find((d) => d.id === doctorSeleccionadoId)
    const usuarioActual = userProfile?.nombreCompleto || userProfile?.email || 'Administrador'
    const motivoTexto = motivo.trim() ? `Motivo: ${motivo.trim()}` : 'Reasignación desde el listado'

    if (docEncontrado) {
      actualizarPacienteStore(paciente.id, {
        doctorTratanteId: docEncontrado.id,
        doctorTratante: docEncontrado.nombre,
      })

      await pacientesStorageService.actualizarPaciente(paciente.id, {
        doctorTratanteId: docEncontrado.id,
        doctorTratante: docEncontrado.nombre,
      })

      await timelineService.agregarEvento(paciente.id, {
        id: `tl-reprog-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: 'admin',
        titulo: `Paciente reasignado a ${docEncontrado.nombre} por ${usuarioActual}`,
        detalles: motivoTexto,
        profesional: usuarioActual,
      })

      notificationService.mostrar(
        `Doctor tratante actualizado a ${docEncontrado.nombre}`,
        { tipo: 'success' }
      )
    } else {
      actualizarPacienteStore(paciente.id, {
        doctorTratanteId: undefined,
        doctorTratante: undefined,
      })

      await pacientesStorageService.actualizarPaciente(paciente.id, {
        doctorTratanteId: undefined,
        doctorTratante: undefined,
      })

      await timelineService.agregarEvento(paciente.id, {
        id: `tl-reprog-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: 'admin',
        titulo: `Doctor tratante desasignado por ${usuarioActual}`,
        detalles: motivoTexto,
        profesional: usuarioActual,
      })

      notificationService.mostrar('Doctor tratante removido', { tipo: 'info' })
    }

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
          {loading ? (
            <div className="flex items-center gap-2 p-2.5 bg-surface border border-surface rounded-xl text-xs text-graphite-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Cargando miembros de la clínica...</span>
            </div>
          ) : (
            <select
              value={doctorSeleccionadoId}
              onChange={(e) => setDoctorSeleccionadoId(e.target.value)}
              className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="">Sin asignar</option>
              {doctores.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.nombre} {doc.rol ? `(${doc.rol})` : ''}
                </option>
              ))}
            </select>
          )}
          {!loading && doctores.length === 0 && (
            <p className="mt-1 text-[11px] text-graphite-400 italic">
              No hay doctores registrados en esta clínica. Se asignará como &quot;Sin asignar&quot;.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300 mb-1">
            Motivo del cambio (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ej. Derivación interna, solicitud de paciente..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full p-2 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-surface">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={loading && doctores.length === 0}>
            Confirmar Reasignación
          </Button>
        </div>
      </form>
    </Modal>
  )
}
