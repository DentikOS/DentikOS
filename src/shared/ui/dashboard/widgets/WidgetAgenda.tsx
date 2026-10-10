import React from 'react'
import { Calendar, Clock, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'
import type { Cita } from '../../../../domains/operations/agenda/schemas/citaSchema'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface WidgetAgendaProps {
  citas?: Cita[]
  pacientes?: Paciente[]
  onVerFichaPaciente?: (paciente: Paciente) => void
  onVerAgendaCompleta?: () => void
  dragHandle?: React.ReactNode
}

export const WidgetAgenda: React.FC<WidgetAgendaProps> = ({
  citas = [],
  pacientes = [],
  onVerFichaPaciente,
  onVerAgendaCompleta,
  dragHandle
}) => {
  const proximasCitas = citas.slice(0, 5)

  const handleCitaClick = (cita: Cita) => {
    if (!onVerFichaPaciente) return
    const paciente = pacientes.find((p) => String(p.id) === String(cita.pacienteId))
    if (paciente) {
      onVerFichaPaciente(paciente)
    } else {
      onVerFichaPaciente({
        id: cita.pacienteId || cita.id,
        nombre: cita.pacienteNombre || 'Paciente'
      } as Paciente)
    }
  }

  return (
    <WidgetBase
      titulo="Próximas Citas"
      icono={<Calendar className="w-4 h-4 text-[#B88E3A]" />}
      borderColor="#B88E3A"
      dragHandle={dragHandle}
      headerAction={
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#B88E3A]/10 text-[#B88E3A]">
          {citas.length} hoy
        </span>
      }
      footer={
        <button
          type="button"
          onClick={onVerAgendaCompleta}
          className="w-full flex items-center justify-center gap-1 font-semibold text-[#B88E3A] hover:underline cursor-pointer"
        >
          Ver agenda completa →
        </button>
      }
    >
      {proximasCitas.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No hay citas programadas para hoy</p>
      ) : (
        <div className="space-y-2">
          {proximasCitas.map((cita) => {
            const estado = cita.estado || 'Agendado'
            const esEnSillon = estado === 'En Sillón' || estado === 'En Atención'
            return (
              <div
                key={cita.id}
                onClick={() => handleCitaClick(cita)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/40 hover:bg-surface-muted border border-transparent hover:border-[#B88E3A]/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface border border-surface-border text-xs font-bold text-[#0F172A] dark:text-white shrink-0">
                    <Clock className="w-3.5 h-3.5 mr-0.5 text-[#B88E3A]" />
                    <span>{String(cita.horaInicio || (cita as { hora?: string }).hora || '--:--')}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate group-hover:text-[#B88E3A] transition-colors">
                      {cita.pacienteNombre || 'Paciente'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {cita.motivo || 'Consulta'} {cita.box ? `· ${cita.box}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      esEnSillon
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {estado}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#B88E3A] transition-colors" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </WidgetBase>
  )
}
