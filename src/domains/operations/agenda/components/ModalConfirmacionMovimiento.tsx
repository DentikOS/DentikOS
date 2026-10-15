import React, { useState } from 'react'
import { Move, MessageCircle, Clock, AlertTriangle } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import type { Cita } from '../schemas/citaSchema'

export interface ModalConfirmacionMovimientoProps {
  isOpen: boolean
  cita: Cita | null
  nuevoHorario: {
    fecha: string
    horaInicio: string
    horaFin?: string
    doctor?: string
    box?: string
  } | null
  hayConflicto?: boolean
  citasEnConflicto?: Cita[]
  alCerrar: () => void
  alConfirmar: (notificarWhatsApp: boolean) => void
}

export const ModalConfirmacionMovimiento: React.FC<ModalConfirmacionMovimientoProps> = ({
  isOpen,
  cita,
  nuevoHorario,
  hayConflicto = false,
  citasEnConflicto = [],
  alCerrar,
  alConfirmar,
}) => {
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(true)

  if (!cita || !nuevoHorario) return null

  const fechaFormateada = (fecha: string) => {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={alCerrar} title="Mover cita" size="md">
      <div className="space-y-4 p-1">
        {/* Info de la cita */}
        <div className="p-4 rounded-xl bg-surface-muted/50 border border-surface-border">
          <h3 className="font-bold text-sm text-[#0F172A] dark:text-white mb-2">
            ¿Mover cita de {cita.pacienteNombre || 'paciente'}?
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-12">De:</span>
              <span className="text-[#0F172A] dark:text-white flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#B88E3A]" />
                {fechaFormateada(cita.fecha)} · {cita.horaInicio}
                {cita.horaFin && ` - ${cita.horaFin}`}
              </span>
            </div>
            <div className="pl-14 text-slate-500 dark:text-slate-400">
              {cita.boxAsignado || 'Sin box'} · {cita.doctor || 'Sin profesional'}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400 w-12">A:</span>
              <span className="text-[#0F172A] dark:text-white flex items-center gap-1 font-bold">
                <Clock className="w-3 h-3 text-[#B88E3A]" />
                {fechaFormateada(nuevoHorario.fecha)} · {nuevoHorario.horaInicio}
                {nuevoHorario.horaFin && ` - ${nuevoHorario.horaFin}`}
              </span>
            </div>
            <div className="pl-14 text-slate-500 dark:text-slate-400">
              {nuevoHorario.box || cita.boxAsignado || 'Sin box'} · {nuevoHorario.doctor || cita.doctor || 'Sin profesional'}
            </div>
          </div>
        </div>

        {/* Alerta de conflicto */}
        {hayConflicto && citasEnConflicto.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Sobrecupo detectado
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  Ya hay {citasEnConflicto.length} cita{citasEnConflicto.length > 1 ? 's' : ''} en este horario.
                  Se aplicará sobrecupo con alerta visual.
                </p>
                <ul className="text-[10px] text-amber-800 dark:text-amber-300 mt-1 space-y-0.5">
                  {citasEnConflicto.slice(0, 3).map((c) => (
                    <li key={String(c.id)}>
                      • {c.pacienteNombre || 'Paciente'} ({c.horaInicio})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Checkbox de notificacion WhatsApp */}
        <label className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-surface-border hover:bg-surface-muted/50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={notificarWhatsApp}
            onChange={(e) => setNotificarWhatsApp(e.target.checked)}
            className="w-4 h-4 rounded text-[#B88E3A] border-surface-border focus:ring-[#B88E3A]"
          />
          <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
              Notificar al paciente por WhatsApp
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Se enviará mensaje con la nueva fecha/hora
            </p>
          </div>
        </label>

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
          <Button type="button" onClick={alCerrar} variant="ghost" size="sm">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => alConfirmar(notificarWhatsApp)}
            variant="primary"
            size="sm"
            icon={Move}
          >
            Confirmar movimiento
          </Button>
        </div>
      </div>
    </Modal>
  )
}
