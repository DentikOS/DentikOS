import React from 'react'
import { Edit3, Trash2, Calendar } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import type { Cita } from '../schemas/citaSchema'

export interface ModalEdicionSerieProps {
  isOpen: boolean
  cita: Cita | null
  alCerrar: () => void
  alEditar: (alcance: 'solo_esta' | 'esta_y_futuras' | 'toda_la_serie') => void
  alCancelar: (alcance: 'solo_esta' | 'esta_y_futuras' | 'toda_la_serie') => void
}

export const ModalEdicionSerie: React.FC<ModalEdicionSerieProps> = ({
  isOpen,
  cita,
  alCerrar,
  alEditar,
  alCancelar,
}) => {
  if (!cita) return null

  return (
    <Modal isOpen={isOpen} onClose={alCerrar} title="Editar cita recurrente" size="md">
      <div className="space-y-4 p-1">
        {/* Informacion de la cita */}
        <div className="p-4 rounded-xl bg-surface-muted/50 border border-surface-border">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-[#B88E3A] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">
                {cita.pacienteNombre || 'Paciente'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {cita.fecha} · {cita.horaInicio}
                {cita.horaFin ? ` - ${cita.horaFin}` : ''}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {cita.doctor || 'Sin profesional'} · {cita.boxAsignado || 'Sin box'}
              </p>
            </div>
          </div>
        </div>

        {/* Opciones de edicion */}
        <div className="border-t border-surface-border pt-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
            ¿Qué deseas editar?
          </p>
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => alEditar('solo_esta')}
              className="w-full justify-start"
              icon={Edit3}
            >
              <div className="text-left">
                <p className="font-bold">Solo esta cita</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Edita solo esta cita y la desvincula de la serie
                </p>
              </div>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => alEditar('esta_y_futuras')}
              className="w-full justify-start"
              icon={Edit3}
            >
              <div className="text-left">
                <p className="font-bold">Esta y todas las futuras</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Edita esta cita y todas las citas futuras de la serie
                </p>
              </div>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => alEditar('toda_la_serie')}
              className="w-full justify-start"
              icon={Edit3}
            >
              <div className="text-left">
                <p className="font-bold">Toda la serie</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Edita todas las citas de la serie (pasadas y futuras)
                </p>
              </div>
            </Button>
          </div>
        </div>

        {/* Opciones de cancelacion */}
        <div className="border-t border-surface-border pt-3">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-3">
            ¿Deseas cancelar?
          </p>
          <div className="space-y-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => alCancelar('solo_esta')}
              className="w-full justify-start"
              icon={Trash2}
            >
              <div className="text-left">
                <p className="font-bold">Cancelar solo esta cita</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Solo esta cita se cancela, las demás continúan
                </p>
              </div>
            </Button>

            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => alCancelar('esta_y_futuras')}
              className="w-full justify-start"
              icon={Trash2}
            >
              <div className="text-left">
                <p className="font-bold">Cancelar esta y todas las futuras</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Cancela esta cita y todas las futuras de la serie
                </p>
              </div>
            </Button>

            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => alCancelar('toda_la_serie')}
              className="w-full justify-start"
              icon={Trash2}
            >
              <div className="text-left">
                <p className="font-bold">Cancelar toda la serie</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Cancela todas las citas de la serie
                </p>
              </div>
            </Button>
          </div>
        </div>

        {/* Aviso de aislamiento de instancias */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
          <Calendar className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Nota:</strong> Las citas de una serie son independientes. Una cita cancelada no afecta a las demás.
          </p>
        </div>
      </div>
    </Modal>
  )
}
