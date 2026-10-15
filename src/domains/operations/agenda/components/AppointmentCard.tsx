import React, { useState, useEffect } from 'react'
import { Clock, GripVertical, MessageCircle, AlertTriangle, Repeat, Megaphone, Edit3, RefreshCw } from 'lucide-react'
import type { Cita } from '../schemas/citaSchema'
import { obtenerPosicionEnSerie } from '../services/recurrenciaService'
import { usePermisosAgenda, puedeEditarCita, puedeCancelarCita, puedeArrastrarCita } from '../utils/permisosAgenda'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { ESTADOS_CITA_CORE } from '../constants/agendaConstants'
import { validarTransicion } from '../utils/validarTransicionEstado'
import { normalizarEstado } from '../utils/normalizarCita'

export interface AppointmentCardProps {
  appointment: Cita
  onClick?: () => void
  draggable?: boolean
  dragHandleProps?: Record<string, unknown>
  onWhatsAppClick?: (e: React.MouseEvent) => void
  onLlamarSiguiente?: (appointment: Cita) => void
  onSerieClick?: (appointment: Cita) => void
  onAbrirCambiarEstado?: (appointment: Cita) => void
  onReasignar?: (appointment: Cita) => void
  onEditar?: (appointment: Cita) => void
}

/**
 * Estados oficiales BP05 §02 con mapeo de legacy → core para retrocompat.
 * Las citas antiguas con estado legacy se renderizan con el color del estado core equivalente.
 */
const ESTADO_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  // 8 Estados oficiales BP05 §02
  'Pendiente': { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300', label: 'Pendiente' },
  'Confirmada': { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-800 dark:text-teal-200', border: 'border-teal-400', label: 'Confirmada' },
  'En sala de espera': { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-800 dark:text-sky-200', border: 'border-sky-400', label: 'En sala de espera' },
  'En atención': { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-400', label: 'En atención' },
  'Completada': { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-400', label: 'Completada' },
  'Cancelada': { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-400', label: 'Cancelada' },
  'No-show': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-400', label: 'No-show' },
  'Reagendada': { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-400', label: 'Reagendada' },
  
  // Retrocompat: legacy → core (citas antiguas se muestran con colores oficiales)
  'Agendado': { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300', label: 'Pendiente' },
  'Confirmado': { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-800 dark:text-teal-200', border: 'border-teal-400', label: 'Confirmada' },
  'En Espera': { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-800 dark:text-sky-200', border: 'border-sky-400', label: 'En sala de espera' },
  'En Sillón': { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-400', label: 'En atención' },
  'Atendido': { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-400', label: 'Completada' },
  'Anulado': { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-400', label: 'Cancelada' },
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onClick,
  draggable = false,
  dragHandleProps,
  onWhatsAppClick,
  onLlamarSiguiente,
  onSerieClick,
  onAbrirCambiarEstado,
  onReasignar,
  onEditar,
}) => {
  const [posicionSerie, setPosicionSerie] = useState<{ actual: number; total: number } | null>(null)

  useEffect(() => {
    if (appointment.recurrence_group_id) {
      obtenerPosicionEnSerie(appointment.id).then(setPosicionSerie)
    }
  }, [appointment.id, appointment.recurrence_group_id])

  const permisos = usePermisosAgenda()
  const userProfile = useSesionStore((s) => s.userProfile)

  const puedeEditar = puedeEditarCita(permisos, appointment, userProfile)
  const puedeCancelar = puedeCancelarCita(permisos, appointment, userProfile)
  const puedeArrastrar = puedeArrastrarCita(permisos, appointment, userProfile)

  const estadoConfig = ESTADO_BADGES[appointment.estado] || ESTADO_BADGES.Pendiente
  const esUrgencia = Boolean(appointment.esUrgencia || appointment.motivo?.toLowerCase().includes('urgencia') || appointment.trataMiento?.toLowerCase().includes('urgencia'))
  const esRecurrente = Boolean((appointment.recurrencia && appointment.recurrencia !== 'ninguna') || appointment.recurrence_group_id)

  const estadoNormalizado = normalizarEstado(appointment.estado)
  const transicionesValidas = onAbrirCambiarEstado
    ? ESTADOS_CITA_CORE.filter(
        (e) => e.id !== estadoNormalizado && validarTransicion(estadoNormalizado, e.id)
      )
    : []

  return (
    <div
      onClick={onClick}
      className={`group relative p-2.5 rounded-xl border bg-surface hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${esUrgencia ? 'border-l-[#E11D48]' : estadoConfig.border} border-l-4`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {onAbrirCambiarEstado && transicionesValidas.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAbrirCambiarEstado(appointment)
                }}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border cursor-pointer ${estadoConfig.bg} ${estadoConfig.text} ${estadoConfig.border} hover:opacity-80 transition-opacity`}
                title="Cambiar estado"
                aria-label={`Cambiar estado de ${appointment.pacienteNombre || 'paciente'}`}
              >
                {estadoConfig.label} ▾
              </button>
            ) : (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${estadoConfig.bg} ${estadoConfig.text} ${estadoConfig.border}`}>
                {estadoConfig.label}
              </span>
            )}
            {esUrgencia && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                Urgencia
              </span>
            )}
            {esRecurrente && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onSerieClick) {
                    onSerieClick(appointment)
                  }
                }}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-surface-muted text-slate-600 dark:text-slate-300 border border-surface-border flex items-center gap-0.5 hover:bg-[#B88E3A]/10 hover:border-[#B88E3A]/30 hover:text-[#B88E3A] transition-colors cursor-pointer"
                title="Ver timeline de la serie"
                aria-label={`Cita ${posicionSerie?.actual || '?'} de ${posicionSerie?.total || '?'}`}
              >
                <Repeat className="w-2.5 h-2.5 text-[#B88E3A]" />
                {posicionSerie ? (
                  <span>Cita {posicionSerie.actual} de {posicionSerie.total}</span>
                ) : (
                  <span>Serie</span>
                )}
              </button>
            )}
          </div>
          <p className="font-bold text-xs text-[#0F172A] dark:text-white truncate mt-1 group-hover:text-[#B88E3A] transition-colors">
            {appointment.pacienteNombre || 'Paciente'}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {puedeEditar && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditar?.(appointment)
              }}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Editar cita"
              aria-label="Editar cita"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
          {draggable && puedeArrastrar && (
            <div {...dragHandleProps} className="p-0.5 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" title="Arrastrar cita" aria-label="Arrastrar cita">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-surface-border/60">
        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
          <Clock className="w-3 h-3 text-[#B88E3A]" />
          <span>{String(appointment.horaInicio).slice(0, 5)}{appointment.horaFin ? ` - ${String(appointment.horaFin).slice(0, 5)}` : ''}</span>
        </div>
        <span className="truncate max-w-[90px] text-slate-500">{appointment.boxAsignado || 'Box 1'}</span>
      </div>

      {/* Acciones rápidas - Botones visibles */}
      <div className="flex items-center gap-1.5 pt-1 flex-wrap">
        {onWhatsAppClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onWhatsAppClick(e)
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 transition-all duration-100 active:scale-95 text-[10px] font-bold"
            title="Confirmar por WhatsApp"
            aria-label="Confirmar por WhatsApp"
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </button>
        )}

        {onReasignar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onReasignar(appointment)
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800 transition-all duration-100 active:scale-95 text-[10px] font-bold"
            title="Reasignar cita"
            aria-label="Reasignar cita"
          >
            <RefreshCw className="w-3 h-3" />
            Reasignar
          </button>
        )}

        {onLlamarSiguiente && (appointment.estado === 'En sala de espera' || appointment.estado === 'En Espera') && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onLlamarSiguiente(appointment)
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/60 border border-sky-200 dark:border-sky-800 transition-all duration-100 active:scale-95 text-[10px] font-bold"
            title="Llamar al box"
            aria-label="Llamar paciente al box"
          >
            <Megaphone className="w-3 h-3" />
            Llamar
          </button>
        )}
      </div>
    </div>
  )
}
