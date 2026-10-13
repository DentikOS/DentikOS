import React, { useState } from 'react'
import { User, UserCheck, UserX, ShieldAlert } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { timelineService } from '../../services/timelineService'
import { pacientesStorageService } from '../../services/pacientesStorageService'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../../../app/stores/sesionStore'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import type { Paciente } from '../../schemas/pacienteSchema'

type EstadoPaciente = NonNullable<Paciente['estado']>

const ESTADOS_DISPONIBLES: { valor: EstadoPaciente; label: string; icon: React.ElementType; color: string }[] = [
  { valor: 'nuevo', label: 'Nuevo', icon: User, color: 'text-blue-600' },
  { valor: 'activo', label: 'Activo', icon: UserCheck, color: 'text-green-600' },
  { valor: 'inactivo', label: 'Inactivo', icon: UserX, color: 'text-gray-500' },
  { valor: 'bloqueado', label: 'Bloqueado', icon: ShieldAlert, color: 'text-rose-600' },
]

interface Props {
  paciente: Paciente
}

export const SelectorEstadoPaciente: React.FC<Props> = ({ paciente }) => {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [estadoPendiente, setEstadoPendiente] = useState<EstadoPaciente | null>(null)
  const [motivo, setMotivo] = useState('')
  const userProfile = useSesionStore((s) => s.userProfile)
  const setPacientes = usePacientesStore((s) => s.setPacientes)

  const esAdmin = userProfile?.rol === 'admin'
  const estadoActual = (usePacientesStore((s) =>
    s.pacientes.find((p) => String(p.id) === String(paciente.id))?.estado
  ) || paciente.estado || 'nuevo') as EstadoPaciente
  const puedeCambiarEstado = esAdmin || estadoActual === 'nuevo' || estadoActual === 'activo'

  const handleCambiarEstado = async (nuevoEstado: EstadoPaciente, motivoConfirmado?: string) => {
    if (!esAdmin && nuevoEstado === 'bloqueado') {
      notificationService.mostrar('Solo admin puede cambiar este estado', { tipo: 'error' })
      return
    }

    if ((nuevoEstado === 'bloqueado' || nuevoEstado === 'desactivado') && !motivoConfirmado && !motivo.trim()) {
      setEstadoPendiente(nuevoEstado)
      setModalAbierto(true)
      return
    }

    const motivoFinal = motivoConfirmado || motivo
    const estadoAnterior = estadoActual || 'nuevo'

    setPacientes((prev) =>
      prev.map((p) =>
        String(p.id) === String(paciente.id)
          ? {
              ...p,
              estado: nuevoEstado,
              ...(nuevoEstado === 'bloqueado' ? { bloqueado: true, motivoBloqueo: motivoFinal } : {}),
            }
          : p
      )
    )

    await pacientesStorageService.actualizarPaciente(paciente.id, {
      estado: nuevoEstado,
      ...(nuevoEstado === 'bloqueado' ? { bloqueado: true, motivoBloqueo: motivoFinal } : {}),
    })

    await timelineService.agregarEvento(paciente.id, {
      tipo: 'cambio_estado',
      fecha: new Date().toISOString(),
      titulo: `Estado cambiado de ${estadoAnterior} a ${nuevoEstado}`,
      detalles: motivoFinal ? `Motivo: ${motivoFinal}` : undefined,
      usuario: String(userProfile?.nombreCompleto || userProfile?.nombre || 'Sistema'),
    })

    notificationService.mostrar(`Estado actualizado a ${nuevoEstado}`, { tipo: 'success' })
    setMotivo('')
    setEstadoPendiente(null)
    setModalAbierto(false)
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap" data-testid="selector-estado-paciente">
        {ESTADOS_DISPONIBLES.map(({ valor, label, icon: Icon, color }) => {
          const activo = estadoActual === valor
          const deshabilitado = (!esAdmin && valor === 'bloqueado') || (!puedeCambiarEstado && valor !== estadoActual)
          return (
            <button
              key={valor}
              type="button"
              data-testid={`btn-estado-${valor}`}
              onClick={() => handleCambiarEstado(valor)}
              disabled={deshabilitado}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activo
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-graphite-600 dark:text-graphite-400 hover:bg-surface'
              } ${deshabilitado ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className={`w-3.5 h-3.5 ${activo ? 'text-white' : color}`} />
              {label}
            </button>
          )
        })}
      </div>

      <Modal isOpen={modalAbierto} onClose={() => { setModalAbierto(false); setEstadoPendiente(null); }} size="sm">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-graphite-900 dark:text-graphite-50">
            Motivo del cambio de estado
          </h3>
          <textarea
            data-testid="textarea-motivo-bloqueo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo obligatorio para estados administrativos..."
            className="w-full px-3 py-2 text-xs border border-surface rounded-lg resize-none"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setModalAbierto(false); setEstadoPendiente(null); }}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!motivo.trim()}
              data-testid="btn-confirmar-bloqueo"
              onClick={() => handleCambiarEstado(estadoPendiente || 'bloqueado', motivo)}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
