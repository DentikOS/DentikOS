import React from 'react'
import { Building2, User, Check } from 'lucide-react'
import type { TipoActividad } from '../types/bootstrapClinica'

export interface PasoTipoActividadProps {
  tipoActividad: TipoActividad
  setTipoActividad: (tipo: TipoActividad) => void
}

export const PasoTipoActividad: React.FC<PasoTipoActividadProps> = ({
  tipoActividad,
  setTipoActividad,
}) => {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm leading-relaxed text-graphite-600 dark:text-graphite-300">
        Selecciona el modelo de tu actividad profesional:
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <button
          type="button"
          aria-pressed={tipoActividad === 'individual'}
          onClick={() => setTipoActividad('individual')}
          className={`group relative flex min-h-36 flex-col items-start rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-satin focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5 ${
            tipoActividad === 'individual'
              ? 'border-gold-solid bg-champagne-50 shadow-sm ring-1 ring-gold-solid/20 dark:border-gold-satin dark:bg-gold-satin/10 dark:ring-gold-satin/20'
              : 'border-graphite-200 bg-white hover:border-champagne-300 hover:bg-graphite-50/60 hover:shadow-sm dark:border-graphite-800 dark:bg-graphite-900 dark:hover:border-graphite-700 dark:hover:bg-graphite-800/70'
          }`}
        >
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-champagne-100 text-champagne-700 dark:bg-graphite-800 dark:text-gold-satin">
            <User size={20} aria-hidden="true" />
          </span>
          {tipoActividad === 'individual' && <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-gold-solid text-white dark:bg-gold-satin dark:text-graphite-950"><Check size={14} aria-hidden="true" /></span>}
          <h3 className="text-sm font-semibold tracking-tight text-graphite-900 dark:text-white">Consulta individual</h3>
          <p className="mt-1 text-xs leading-relaxed text-graphite-600 dark:text-graphite-400">
            Dentista independiente con su propio box o consulta privada.
          </p>
        </button>
        <button
          type="button"
          aria-pressed={tipoActividad === 'clinica'}
          onClick={() => setTipoActividad('clinica')}
          className={`group relative flex min-h-36 flex-col items-start rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-satin focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5 ${
            tipoActividad === 'clinica'
              ? 'border-gold-solid bg-champagne-50 shadow-sm ring-1 ring-gold-solid/20 dark:border-gold-satin dark:bg-gold-satin/10 dark:ring-gold-satin/20'
              : 'border-graphite-200 bg-white hover:border-champagne-300 hover:bg-graphite-50/60 hover:shadow-sm dark:border-graphite-800 dark:bg-graphite-900 dark:hover:border-graphite-700 dark:hover:bg-graphite-800/70'
          }`}
        >
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-champagne-100 text-champagne-700 dark:bg-graphite-800 dark:text-gold-satin">
            <Building2 size={20} aria-hidden="true" />
          </span>
          {tipoActividad === 'clinica' && <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-gold-solid text-white dark:bg-gold-satin dark:text-graphite-950"><Check size={14} aria-hidden="true" /></span>}
          <h3 className="text-sm font-semibold tracking-tight text-graphite-900 dark:text-white">Clínica dental</h3>
          <p className="mt-1 text-xs leading-relaxed text-graphite-600 dark:text-graphite-400">
            Centro con equipo multidisciplinario y una o más sedes operativas.
          </p>
        </button>
      </div>
    </div>
  )
}
