import React from 'react'
import { Clock, GripVertical, MessageCircle, AlertTriangle, Repeat } from 'lucide-react'
import type { Cita } from '../schemas/citaSchema'

export interface AppointmentCardProps {
  appointment: Cita
  onClick?: () => void
  draggable?: boolean
  dragHandleProps?: Record<string, unknown>
  onWhatsAppClick?: (e: React.MouseEvent) => void
}

const ESTADO_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  Pendiente: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300', label: 'Pendiente' },
  Agendado: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300', label: 'Pendiente' },
  Confirmada: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-800 dark:text-teal-200', border: 'border-teal-400', label: 'Confirmada' },
  Confirmado: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-800 dark:text-teal-200', border: 'border-teal-400', label: 'Confirmada' },
  'En sala de espera': { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-800 dark:text-sky-200', border: 'border-sky-400', label: 'En Espera' },
  'En Espera': { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-800 dark:text-sky-200', border: 'border-sky-400', label: 'En Espera' },
  'En atención': { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-400', label: 'En Atención' },
  'En Sillón': { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-400', label: 'En Atención' },
  Completada: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-400', label: 'Completada' },
  Atendido: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-400', label: 'Completada' },
  Cancelada: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-400', label: 'Cancelada' },
  Anulado: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-400', label: 'Cancelada' },
  'No-show': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-400', label: 'No-show' },
  Reagendada: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-400', label: 'Reagendada' }
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onClick,
  draggable = false,
  dragHandleProps,
  onWhatsAppClick
}) => {
  const estadoConfig = ESTADO_BADGES[appointment.estado] || ESTADO_BADGES.Pendiente
  const esUrgencia = Boolean(appointment.motivo?.toLowerCase().includes('urgencia') || appointment.trataMiento?.toLowerCase().includes('urgencia'))
  const esRecurrente = Boolean(appointment.recurrencia && appointment.recurrencia !== 'ninguna')

  return (
    <div
      onClick={onClick}
      className={`group relative p-2.5 rounded-xl border bg-surface hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${estadoConfig.border} border-l-4`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${estadoConfig.bg} ${estadoConfig.text} ${estadoConfig.border}`}>
              {estadoConfig.label}
            </span>
            {esUrgencia && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                Urgencia
              </span>
            )}
            {esRecurrente && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-surface-muted text-slate-600 dark:text-slate-300 border border-surface-border flex items-center gap-0.5">
                <Repeat className="w-2.5 h-2.5 text-[#B88E3A]" />
                Recurrente
              </span>
            )}
          </div>
          <p className="font-bold text-xs text-[#0F172A] dark:text-white truncate mt-1 group-hover:text-[#B88E3A] transition-colors">
            {appointment.pacienteNombre || 'Paciente'}
          </p>
        </div>

        {draggable && (
          <div {...dragHandleProps} className="p-0.5 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" title="Arrastrar cita" aria-label="Arrastrar cita">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-surface-border/60">
        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
          <Clock className="w-3 h-3 text-[#B88E3A]" />
          <span>{appointment.horaInicio}{appointment.horaFin ? ` - ${appointment.horaFin}` : ''}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="truncate max-w-[90px] text-slate-500">{appointment.boxAsignado || 'Box 1'}</span>
          {onWhatsAppClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onWhatsAppClick(e)
              }}
              className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              title="Confirmar por WhatsApp"
              aria-label="Confirmar por WhatsApp"
            >
              <MessageCircle className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
