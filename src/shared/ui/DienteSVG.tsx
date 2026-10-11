import React from 'react'
import { X } from 'lucide-react'

const ESTADOS_COLORES: Record<string, string> = {
  sano: 'fill-white dark:fill-graphite-900 stroke-gray-400 dark:stroke-graphite-600',
  caries: 'fill-[var(--chart-caries)] stroke-[var(--chart-caries)]',
  restauracion: 'fill-[var(--chart-sound)] stroke-[var(--chart-sound)]',
  incrustacion: 'fill-orange-400 stroke-orange-600',
  sellante: 'fill-emerald-400 stroke-emerald-600',
  corona: 'fill-amber-400 stroke-amber-600',
  endodoncia: 'fill-[var(--chart-endo)] stroke-[var(--chart-endo)]',
}

export type CaraDiente = 'vestibular' | 'distal' | 'palatino' | 'mesial' | 'oclusal'

export interface EstadosPiezaDental {
  general?: string
  caras?: Record<string, string | undefined>
  [key: string]: unknown
}

export interface DienteSVGProps {
  numero: number | string
  estadosPieza?: EstadosPiezaDental | null
  modoSeleccionado?: string
  alHacerClicCara?: (numero: number | string, cara: CaraDiente, modo?: string) => void
  alSeleccionarPieza?: (numero: number | string) => void
  piezaActiva?: number | string | null
}

export const DienteSVG: React.FC<DienteSVGProps> = ({
  numero,
  estadosPieza,
  modoSeleccionado,
  alHacerClicCara,
  alSeleccionarPieza,
  piezaActiva,
}) => {
  const esActivo = piezaActiva === numero
  const estadoGeneral = estadosPieza?.general || 'sano'

  const obtenerColorCara = (cara: CaraDiente): string => {
    if (estadoGeneral !== 'sano') return ESTADOS_COLORES[estadoGeneral] || 'fill-gray-100 stroke-gray-300'
    const estadoCara = estadosPieza?.caras?.[cara] || 'sano'
    return ESTADOS_COLORES[estadoCara] || 'fill-white dark:fill-graphite-900 stroke-gray-400 dark:stroke-graphite-600'
  }

  return (
    <div
      onClick={() => alSeleccionarPieza?.(numero)}
      className={`flex flex-col items-center cursor-pointer p-1.5 rounded-xl transition-all ${
        esActivo ? 'bg-blue-50 dark:bg-graphite-800 border-2 border-[var(--chart-sound)] shadow-md scale-105' : 'hover:bg-gray-100 dark:hover:bg-graphite-700 border border-transparent'
      }`}
    >
      <span className="text-[11px] font-extrabold text-gray-800 dark:text-graphite-100 mb-1">{numero}</span>
      <div className="relative">
        {estadoGeneral === 'ausente' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 text-[var(--chart-missing)] font-black text-xl select-none bg-white/60 dark:bg-graphite-800/60 rounded-lg"><X className="w-6 h-6" /></div>
        )}
        {estadoGeneral === 'indicacion_exodoncia' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 text-[var(--chart-caries)] font-black text-xl select-none bg-white/60 dark:bg-graphite-800/60 rounded-lg"><X className="w-6 h-6" /></div>
        )}
        {estadoGeneral === 'implante' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 text-[var(--chart-implant)] dark:text-graphite-100 font-extrabold text-[9px] bg-slate-200/90 dark:bg-slate-800/90 rounded px-1 border border-[var(--chart-implant)]">IMP</div>
        )}

        {/* SVG Ampliado de 30px a 44px x 44px para máxima comodidad al hacer clic */}
        <svg width="44" height="44" viewBox="0 0 100 100" className="drop-shadow-xs">
          <polygon
            points="15,15 85,15 70,30 30,30"
            className={`${obtenerColorCara('vestibular')} transition-colors cursor-pointer hover:opacity-75 stroke-2`}
            onClick={(e) => { e.stopPropagation(); alHacerClicCara?.(numero, 'vestibular', modoSeleccionado) }}
          />
          <polygon
            points="85,15 85,85 70,70 70,30"
            className={`${obtenerColorCara('distal')} transition-colors cursor-pointer hover:opacity-75 stroke-2`}
            onClick={(e) => { e.stopPropagation(); alHacerClicCara?.(numero, 'distal', modoSeleccionado) }}
          />
          <polygon
            points="15,85 85,85 70,70 30,70"
            className={`${obtenerColorCara('palatino')} transition-colors cursor-pointer hover:opacity-75 stroke-2`}
            onClick={(e) => { e.stopPropagation(); alHacerClicCara?.(numero, 'palatino', modoSeleccionado) }}
          />
          <polygon
            points="15,15 15,85 30,70 30,30"
            className={`${obtenerColorCara('mesial')} transition-colors cursor-pointer hover:opacity-75 stroke-2`}
            onClick={(e) => { e.stopPropagation(); alHacerClicCara?.(numero, 'mesial', modoSeleccionado) }}
          />
          <polygon
            points="30,30 70,30 70,70 30,70"
            className={`${obtenerColorCara('oclusal')} transition-colors cursor-pointer hover:opacity-75 stroke-2`}
            onClick={(e) => { e.stopPropagation(); alHacerClicCara?.(numero, 'oclusal', modoSeleccionado) }}
          />
        </svg>
      </div>
    </div>
  )
}

DienteSVG.displayName = 'DienteSVG'
