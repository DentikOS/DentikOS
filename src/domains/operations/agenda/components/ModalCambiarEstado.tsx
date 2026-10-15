import React from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { ESTADOS_CITA_CORE } from '../constants/agendaConstants'
import { validarTransicion } from '../utils/validarTransicionEstado'
import { normalizarEstado } from '../utils/normalizarCita'
import type { Cita } from '../schemas/citaSchema'

export interface ModalCambiarEstadoProps {
  isOpen: boolean
  cita: Cita | null
  alCerrar: () => void
  alCambiar: (citaId: string | number, nuevoEstado: string) => void
}

export const ModalCambiarEstado: React.FC<ModalCambiarEstadoProps> = ({
  isOpen,
  cita,
  alCerrar,
  alCambiar,
}) => {
  if (!cita) return null
  const estadoActual = normalizarEstado(cita.estado)
  const configActual = ESTADOS_CITA_CORE.find((e) => e.id === estadoActual)
  const opciones = ESTADOS_CITA_CORE.map((op) => ({
    ...op,
    permitida: op.id !== estadoActual && validarTransicion(estadoActual, op.id),
  }))

  return (
    <Modal isOpen={isOpen} onClose={alCerrar} title="Cambiar estado de la cita" size="sm">
      <div className="space-y-4 p-1">
        <div className="p-3 rounded-xl bg-surface-muted/50 border border-surface-border">
          <p className="text-sm font-bold text-[#0F172A] dark:text-white">
            {cita.pacienteNombre || 'Paciente'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {cita.fecha} · {cita.horaInicio} · Estado actual:{' '}
            <span className="font-bold">{configActual?.label || estadoActual}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {opciones.map((op) => (
            <button
              key={op.id}
              type="button"
              disabled={!op.permitida}
              title={op.permitida ? `Cambiar a ${op.label}` : `Transición no permitida desde ${estadoActual}`}
              onClick={() => {
                alCambiar(cita.id, op.id)
                alCerrar()
              }}
              className={`p-3 rounded-xl border-2 font-bold text-xs transition-all duration-100 ${
                op.permitida
                  ? `${op.color || 'bg-surface border-surface-border'} hover:opacity-80 active:scale-95 cursor-pointer`
                  : 'bg-surface-muted/40 text-slate-400 border-surface-border opacity-50 cursor-not-allowed'
              }`}
            >
              {op.id === estadoActual ? `● ${op.label}` : op.permitida ? `→ ${op.label}` : op.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">
          Los estados habilitados son las transiciones válidas desde &quot;{estadoActual}&quot; según el flujo clínico.
        </p>

        <div className="flex justify-end pt-2 border-t border-surface-border">
          <Button size="sm" variant="ghost" onClick={alCerrar}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
