import React, { useState } from 'react'
import { FileText, Calendar, MoreVertical, AlertTriangle } from 'lucide-react'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { BotonLlamarPopover } from './BotonLlamarPopover'
import { MenuContextualPaciente } from './MenuContextualPaciente'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
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
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [alertaBloqueoAbierta, setAlertaBloqueoAbierta] = useState(false)

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

  return (
    <div className="flex items-center gap-1 relative" onClick={(e) => e.stopPropagation()}>
      {/* 1. 📋 Ver Ficha */}
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

      {/* 2. 📅 Agendar Cita (Oculto para asistente) */}
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

      {/* 3. 📞 Llamar */}
      <BotonLlamarPopover paciente={paciente} telefono={paciente.telefono} />

      {/* 4. ⋮ Más */}
      <div className="relative">
        <button
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
          onClose={() => setMenuAbierto(false)}
          onEditar={onEditar || alSeleccionarPaciente}
          onDesactivar={onDesactivar}
          onBloquear={onBloquear}
        />
      </div>

      {/* Modal Alerta BP06 §04 al intentar agendar en paciente bloqueado */}
      {alertaBloqueoAbierta && (
        <Modal
          isOpen={true}
          onClose={() => setAlertaBloqueoAbierta(false)}
          size="sm"
          showCloseButton={false}
        >
          <div className="space-y-3 p-1" data-testid={`alerta-bloqueo-${paciente.id}`}>
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>⚠️ Paciente bloqueado</span>
            </div>
            <p className="text-xs text-graphite-600 dark:text-graphite-300">
              <strong>Motivo:</strong> {String(paciente.motivoBloqueo || 'Incumplimiento')}
            </p>
            <p className="text-[11px] text-graphite-400">
              Bloqueado por: {String(paciente.bloqueadoPor || 'Admin')} · {paciente.bloqueadoAt ? new Date(String(paciente.bloqueadoAt)).toLocaleDateString('es-CL') : 'Fecha no registrada'}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAlertaBloqueoAbierta(false)}
              >
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
