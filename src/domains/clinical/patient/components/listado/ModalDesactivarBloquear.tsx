import React, { useState } from 'react'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
import { UserX, ShieldAlert } from 'lucide-react'
import type { Paciente } from '../../schemas/pacienteSchema'

export interface ModalDesactivarBloquearProps {
  modo: 'desactivar' | 'bloquear'
  paciente: Paciente
  onConfirmar: (motivo: string) => void
  onCerrar: () => void
}

export const ModalDesactivarBloquear: React.FC<ModalDesactivarBloquearProps> = ({
  modo,
  paciente,
  onConfirmar,
  onCerrar,
}) => {
  const [motivo, setMotivo] = useState('')
  const esDesactivar = modo === 'desactivar'
  const nombre = paciente.nombre || paciente.nombreCompleto || 'el paciente'

  const handleConfirmar = () => {
    if (!motivo.trim()) return
    onConfirmar(motivo.trim())
  }

  return (
    <Modal isOpen={true} onClose={onCerrar} size="md" showCloseButton={true}>
      <div className="space-y-4" data-testid={`modal-${modo}-paciente`}>
        <div className="flex items-center gap-3 pb-3 border-b border-surface">
          <div className={`p-2.5 rounded-xl ${esDesactivar ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'}`}>
            {esDesactivar ? <UserX className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">
              {esDesactivar ? 'Desactivar Paciente' : 'Bloquear Paciente (Admin)'}
            </h3>
            <p className="text-xs text-graphite-500">
              {nombre} · RUT: {paciente.rut || 'Sin RUT'}
            </p>
          </div>
        </div>

        <div className="text-xs text-graphite-600 dark:text-graphite-300 leading-relaxed bg-surface-hover/50 p-3 rounded-xl border border-surface">
          {esDesactivar ? (
            <p>
              El paciente quedará <strong>oculto de las listas activas</strong>, pero su ficha clínica se conservará de forma íntegra conforme a la <strong>Ley 20.584</strong> (retención legal de 10 años).
            </p>
          ) : (
            <p>
              El paciente <strong>no podrá agendar nuevas citas</strong> en la clínica pero seguirá visible en las listas con estado <em>Bloqueado</em>.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
            Motivo de {esDesactivar ? 'la desactivación' : 'el bloqueo'} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={`Indica el motivo obligatorio para ${esDesactivar ? 'desactivar' : 'bloquear'}...`}
            className="w-full p-2.5 text-xs bg-surface border border-surface rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
          <Button variant="ghost" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!motivo.trim()}
            onClick={handleConfirmar}
            className={esDesactivar ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
          >
            Confirmar {esDesactivar ? 'Desactivación' : 'Bloqueo'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
