import React, { memo, useState } from 'react'
import { TRAMOS_DURACION, PARAMETROS_AGENDA_DEFAULT, type ParametrosAgendaConfig } from '../constants/agendaConstants'
import { Calendar } from 'lucide-react'

export interface ParametrosAgendaFormProps {
  parametrosAgenda?: ParametrosAgendaConfig | null
  alGuardar?: (parametros: ParametrosAgendaConfig) => void
}

export const ParametrosAgendaForm: React.FC<ParametrosAgendaFormProps> = memo(({ parametrosAgenda, alGuardar }) => {
  const [duracion, setDuracion] = useState<number | string>(parametrosAgenda?.duracionBloqueMinutos || 30)
  const [horaInicio, setHoraInicio] = useState<string>(parametrosAgenda?.horaInicio || '08:30')
  const [horaFin, setHoraFin] = useState<string>(parametrosAgenda?.horaFin || '19:30')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (alGuardar) {
      alGuardar({
        diasLaborales: parametrosAgenda?.diasLaborales ?? PARAMETROS_AGENDA_DEFAULT.diasLaborales,
        ...parametrosAgenda,
        duracionBloqueMinutos: parseInt(String(duracion), 10) || 30,
        horaInicio,
        horaFin
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-surface rounded-2xl p-6 shadow-xs space-y-4 text-xs">
      <div className="border-b border-surface pb-3">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50  uppercase tracking-wider inline-flex items-center gap-2"><Calendar size={14} />Parámetros de Agenda & Tramos Horarios</h3>
        <p className="text-gray-500 dark:text-graphite-400 text-[11px]">Duración predeterminada de los bloques de atención y ventana de horarios.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300  mb-1">Duración Bloque Cita</label>
          <select
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-50  font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {TRAMOS_DURACION.map(d => (
              <option key={d} value={d}>{d} Minutos por atención</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300  mb-1">Hora Inicio Jornada</label>
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-50  font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300  mb-1">Hora Fin Jornada</label>
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-50  font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-surface">
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary-dark transition cursor-pointer"
        >
          Guardar Parámetros Agenda
        </button>
      </div>
    </form>
  )
})

ParametrosAgendaForm.displayName = 'ParametrosAgendaForm'
