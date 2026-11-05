import React, { memo } from 'react'
import { Ban, Clock, Armchair, Trash2, Stethoscope, Folder, MessageCircle } from 'lucide-react'
import { Icon } from '../../../../shared/ui/Icon'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { stripEmojis } from '../../../../shared/utils/stringUtils'
import { Badge } from '../../../../shared/ui/ui/Badge'
import type { Cita } from '../schemas/citaSchema'

const ESTADO_BADGE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'error'> = {
  'Agendado': 'info',
  'Confirmado': 'success',
  'En Espera': 'warning',
  'En Sillón': 'neutral',
  'Atendido': 'neutral',
  'Anulado': 'error',
}

export interface CitaCardProps {
  cita: Cita
  alHacerClic?: (cita: Cita) => void
  alCambiarEstado?: (id: string | number, estado: string) => void
  alEnviarWhatsApp?: (cita: Cita) => void
  alVerFicha?: (pacienteId?: string | number) => void
  alEliminar?: (id: string | number) => void
}

export const CitaCard: React.FC<CitaCardProps> = memo(({
  cita,
  alHacerClic,
  alCambiarEstado,
  alEnviarWhatsApp,
  alVerFicha,
  alEliminar
}) => {
  const { confirm } = useAppDialog()
  const esBloqueo = Boolean(cita.esBloqueo)

  if (esBloqueo) {
    return (
      <div className="p-3 rounded-lg border border-dashed border-red-300 dark:border-red-700 bg-red-50/60 dark:bg-red-900/20 text-red-900 dark:text-red-200 text-xs flex justify-between items-center my-1.5 group">
        <div className="space-y-0.5">
          <span className="font-semibold text-[11px] flex items-center gap-1.5">
            <Icon icon={Ban} size="xs" />
            {stripEmojis(cita.motivoBloqueo) || 'Bloqueo Horario'}
          </span>
          <p className="text-[10px] font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
            <Icon icon={Clock} size="xs" />
            {cita.horaInicio} - {cita.horaFin} hrs
            <span className="mx-1">|</span>
            <Icon icon={Armchair} size="xs" />
            {cita.boxAsignado || 'Todos los Boxes'}
          </p>
        </div>

        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation()
            const ok = await confirm({
              title: 'Quitar bloqueo de agenda',
              description: '¿Deseas quitar este bloqueo de la agenda?',
              variant: 'danger',
              confirmText: 'Quitar'
            })
            if (ok) {
              alEliminar?.(cita.id)
            }
          }}
          className="text-red-500 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          title="Eliminar bloqueo"
          aria-label="Eliminar bloqueo"
        >
          <Icon icon={Trash2} size="xs" />
        </button>
      </div>
    )
  }

  const estado = cita.estado || 'Agendado'
  const badgeVariant = ESTADO_BADGE_VARIANT[estado] || 'neutral'

  return (
    <div
      onClick={() => alHacerClic?.(cita)}
      className={`p-3.5 rounded-lg border transition-all cursor-pointer space-y-2.5 bg-white dark:bg-graphite-800 surgical:bg-white hover:shadow-md ${
        estado === 'En Sillón'
          ? 'border-purple-500 ring-2 ring-purple-400/30 bg-purple-50/20 dark:bg-purple-900/20'
          : estado === 'Confirmado'
          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/10 dark:bg-emerald-900/10'
          : 'border-surface hover:border-graphite-900 dark:hover:border-graphite-100'
      }`}
    >
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-graphite-900 dark:text-graphite-50 surgical:text-black text-[11px] flex items-center gap-1">
          <Icon icon={Clock} size="xs" />
          {cita.horaInicio} - {cita.horaFin} ({cita.duracionMinutos || 30} min)
        </span>
        
        <div className="flex items-center gap-1">
          <select
            value={estado}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => alCambiarEstado?.(cita.id, e.target.value)}
            className="text-[10px] font-semibold rounded-lg px-2 py-0.5 border border-surface bg-white dark:bg-surface surgical:bg-white focus:outline-none cursor-pointer text-graphite-900 dark:text-graphite-100 surgical:text-black"
          >
            <option value="Agendado">Agendado</option>
            <option value="Confirmado">Confirmado</option>
            <option value="En Espera">En Sala de Espera</option>
            <option value="En Sillón">En Sillón</option>
            <option value="Atendido">Atendido</option>
            <option value="Anulado">Anulado</option>
          </select>

          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation()
              const ok = await confirm({
                title: 'Eliminar cita',
                description: `¿Eliminar la cita de "${cita.pacienteNombre}"?`,
                variant: 'danger',
                confirmText: 'Eliminar'
              })
              if (ok) {
                alEliminar?.(cita.id)
              }
            }}
            className="text-graphite-400 dark:text-graphite-500 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors"
            title="Eliminar cita"
            aria-label="Eliminar cita"
          >
            <Icon icon={Trash2} size="xs" />
          </button>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm text-graphite-900 dark:text-graphite-50 leading-tight flex items-center justify-between">
          <span>{cita.pacienteNombre}</span>
          <Badge size="sm" variant={badgeVariant} dot>
            {estado}
          </Badge>
        </h4>
        <p className="text-[11px] font-medium text-graphite-500 dark:text-graphite-400 flex justify-between pt-0.5">
          <span className="flex items-center gap-1">
            <Icon icon={Stethoscope} size="xs" />
            {cita.trataMiento || cita.motivo || 'Consulta Clínica'}
          </span>
          <span className="font-semibold text-graphite-700 dark:text-graphite-300 bg-graphite-100 dark:bg-graphite-700 px-1.5 py-0.5 rounded text-[10px]">
            <span className="mr-1 text-amber-700 dark:text-amber-300">
              {cita.sedeId ? `${cita.sedeNombre || 'Sucursal'} ·` : 'Sin sucursal ·'}
            </span>
            {cita.boxAsignado || 'Sillón 1'}
          </span>
        </p>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-graphite-100 dark:border-graphite-700 text-[10px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (alVerFicha) alVerFicha(cita.pacienteId)
          }}
          className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
        >
          <Icon icon={Folder} size="xs" />
          Ver Ficha Clínica
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (alEnviarWhatsApp) alEnviarWhatsApp(cita)
          }}
          className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1"
        >
          <Icon icon={MessageCircle} size="xs" />
          Confirmar WhatsApp
        </button>
      </div>
    </div>
  )
})

CitaCard.displayName = 'CitaCard'
