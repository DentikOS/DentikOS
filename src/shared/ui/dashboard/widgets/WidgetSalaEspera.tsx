import React, { useState } from 'react'
import { UserCheck, Bell, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'
import type { Cita } from '../../../../domains/operations/agenda/schemas/citaSchema'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface WidgetSalaEsperaProps {
  enEspera?: Cita[]
  pacientes?: Paciente[]
  onVerFichaPaciente?: (paciente: Paciente) => void
  onLlamarPaciente?: (cita: Cita) => void
  dragHandle?: React.ReactNode
}

export const WidgetSalaEspera: React.FC<WidgetSalaEsperaProps> = ({
  enEspera = [],
  pacientes = [],
  onVerFichaPaciente,
  onLlamarPaciente,
  dragHandle
}) => {
  const [llamadoId, setLlamadoId] = useState<string | number | null>(null)

  const handleLlamar = (cita: Cita, e: React.MouseEvent) => {
    e.stopPropagation()
    setLlamadoId(cita.id)
    onLlamarPaciente?.(cita)
    setTimeout(() => setLlamadoId(null), 3000)
  }

  const handleSelect = (cita: Cita) => {
    if (!onVerFichaPaciente) return
    const p = pacientes.find((item) => String(item.id) === String(cita.pacienteId))
    if (p) onVerFichaPaciente(p)
  }

  return (
    <WidgetBase
      titulo="Sala de Espera Virtual"
      icono={<UserCheck className="w-4 h-4 text-blue-600" />}
      borderColor="#2563EB"
      dragHandle={dragHandle}
      headerAction={
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {enEspera.length} en espera
        </span>
      }
    >
      {enEspera.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No hay pacientes en sala de espera</p>
      ) : (
        <div className="space-y-2">
          {enEspera.map((cita) => {
            const esLlamado = llamadoId === cita.id
            return (
              <div
                key={cita.id}
                onClick={() => handleSelect(cita)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/40 hover:bg-surface-muted border border-transparent hover:border-blue-500/40 transition-all cursor-pointer group"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate group-hover:text-blue-600 transition-colors">
                    {cita.pacienteNombre || 'Paciente'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Llegada: {String((cita as { horaLlegadaEspera?: string }).horaLlegadaEspera || cita.horaInicio || '10:00')} · Box: {String(cita.boxAsignado || (cita as { box?: string }).box || '01')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleLlamar(cita, e)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      esLlamado
                        ? 'bg-emerald-600 text-white animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                    }`}
                  >
                    <Bell className="w-3 h-3" />
                    <span>{esLlamado ? '¡Llamado!' : 'Llamar'}</span>
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </WidgetBase>
  )
}
