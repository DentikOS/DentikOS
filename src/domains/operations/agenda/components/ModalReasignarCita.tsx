import React, { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { SILLONES_DENTALES } from '../constants/agendaConstants'
import type { Cita } from '../schemas/citaSchema'
import type { DoctorAgenda } from '../services/agendaConfigService'

export interface ModalReasignarCitaProps {
  isOpen: boolean
  cita: Cita | null
  doctores: DoctorAgenda[]
  alCerrar: () => void
  alReasignar: (citaId: string | number, nuevoDoctor?: string, nuevoBox?: string) => void
}

export const ModalReasignarCita: React.FC<ModalReasignarCitaProps> = ({
  isOpen,
  cita,
  doctores,
  alCerrar,
  alReasignar,
}) => {
  const [nuevoDoctor, setNuevoDoctor] = useState<string>('')
  const [nuevoBox, setNuevoBox] = useState<string>('')

  useEffect(() => {
    if (cita) {
      setNuevoDoctor(cita.doctor || '')
      setNuevoBox(cita.boxAsignado || '')
    }
  }, [cita])

  if (!cita) return null

  const handleReasignar = () => {
    alReasignar(cita.id, nuevoDoctor || cita.doctor, nuevoBox || cita.boxAsignado)
    alCerrar()
  }

  const tieneCambios = nuevoDoctor !== (cita.doctor || '') || nuevoBox !== (cita.boxAsignado || '')

  return (
    <Modal isOpen={isOpen} onClose={alCerrar} title="Reasignar cita" size="md">
      <div className="space-y-4 p-1">
        {/* Info de la cita */}
        <div className="p-4 rounded-xl bg-surface-muted/50 border border-surface-border">
          <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">
            {cita.pacienteNombre || 'Paciente'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {cita.fecha} · {cita.horaInicio}
            {cita.horaFin ? ` - ${cita.horaFin}` : ''}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {cita.trataMiento || cita.motivo || 'Sin motivo'}
          </p>
          {cita.doctor && (
            <p className="text-xs text-primary font-medium mt-1">
              Doctor actual: {cita.doctor}
            </p>
          )}
        </div>

        {/* Selector de nuevo doctor */}
        <div>
          <label htmlFor="nuevo-profesional-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            Nuevo profesional
          </label>
          <select
            id="nuevo-profesional-select"
            aria-label="Nuevo profesional"
            value={nuevoDoctor}
            onChange={(e) => setNuevoDoctor(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-surface-border bg-surface text-xs font-semibold cursor-pointer"
          >
            <option value="">Sin asignar</option>
            {doctores.map(d => (
              <option key={d.userId} value={d.nombreCompleto}>
                {d.nombreCompleto} {d.especialidad ? `— ${d.especialidad}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de nuevo box */}
        <div>
          <label htmlFor="nuevo-box-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            Nuevo box
          </label>
          <select
            id="nuevo-box-select"
            aria-label="Nuevo box"
            value={nuevoBox}
            onChange={(e) => setNuevoBox(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-surface-border bg-surface text-xs font-semibold cursor-pointer"
          >
            <option value="">Sin asignar</option>
            {SILLONES_DENTALES.map(b => (
              <option key={b.id} value={b.nombre}>{b.nombre}</option>
            ))}
          </select>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
          <Button size="sm" variant="ghost" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleReasignar}
            icon={RefreshCw}
            disabled={!tieneCambios}
          >
            Confirmar reasignación
          </Button>
        </div>
      </div>
    </Modal>
  )
}
