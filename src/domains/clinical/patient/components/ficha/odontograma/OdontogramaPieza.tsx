import React from 'react'

export type CaraDental = 'vestibular' | 'lingual' | 'mesial' | 'distal' | 'oclusal'

export interface EstadoCara {
  cara: CaraDental
  estado: string
  color?: string
}

interface OdontogramaPiezaProps {
  numero: string | number
  esTemporal?: boolean
  caras: Record<CaraDental, string>
  estadoGeneral?: string
  caraSeleccionada?: CaraDental | null
  onSeleccionarCara: (numero: string | number, cara: CaraDental) => void
  onSeleccionarPieza: (numero: string | number) => void
}

const COLOR_ESTADOS: Record<string, string> = {
  sano: '#FFFFFF',
  caries: '#EF4444', // Rojo
  obturacion_resina: '#3B82F6', // Azul
  obturacion_amalgama: '#64748B', // Grafito metálico
  corona: '#EAB308', // Dorado
  endodoncia: '#8B5CF6', // Violeta
  implante: '#10B981', // Verde esmeralda
  ausente: '#000000',
  sellante: '#06B6D4',
  fractura: '#F97316',
}

export const OdontogramaPieza: React.FC<OdontogramaPiezaProps> = ({
  numero,
  esTemporal = false,
  caras,
  estadoGeneral,
  onSeleccionarCara,
  onSeleccionarPieza,
}) => {
  const getColor = (cara: CaraDental) => {
    const estado = caras[cara] || 'sano'
    return COLOR_ESTADOS[estado] || '#FFFFFF'
  }

  const esAusente = estadoGeneral === 'ausente'

  return (
    <div
      className={`inline-flex flex-col items-center p-1.5 rounded-xl transition-all ${
        esTemporal ? 'scale-90 opacity-90' : ''
      }`}
      data-testid={`pieza-dental-${numero}`}
    >
      {/* Etiqueta número de pieza */}
      <button
        type="button"
        onClick={() => onSeleccionarPieza(numero)}
        className="text-[11px] font-bold font-mono text-graphite-700 dark:text-graphite-300 hover:text-primary mb-1 cursor-pointer"
        title={`Pieza ${numero}`}
      >
        {numero}
      </button>

      {/* Representación SVG 5 Caras Dental */}
      <div className="relative w-11 h-11">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs">
          {/* Vestibular (Superior) */}
          <polygon
            points="0,0 100,0 75,25 25,25"
            fill={getColor('vestibular')}
            stroke="#94A3B8"
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onSeleccionarCara(numero, 'vestibular')}
          />
          {/* Lingual / Palatino (Inferior) */}
          <polygon
            points="25,75 75,75 100,100 0,100"
            fill={getColor('lingual')}
            stroke="#94A3B8"
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onSeleccionarCara(numero, 'lingual')}
          />
          {/* Mesial (Izquierda) */}
          <polygon
            points="0,0 25,25 25,75 0,100"
            fill={getColor('mesial')}
            stroke="#94A3B8"
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onSeleccionarCara(numero, 'mesial')}
          />
          {/* Distal (Derecha) */}
          <polygon
            points="100,0 100,100 75,75 75,25"
            fill={getColor('distal')}
            stroke="#94A3B8"
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onSeleccionarCara(numero, 'distal')}
          />
          {/* Oclusal (Centro) */}
          <polygon
            points="25,25 75,25 75,75 25,75"
            fill={getColor('oclusal')}
            stroke="#94A3B8"
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onSeleccionarCara(numero, 'oclusal')}
          />
        </svg>

        {/* Indicador de diente ausente / exodoncia */}
        {esAusente && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-rose-600 rotate-45" />
            <div className="w-full h-0.5 bg-rose-600 -rotate-45 absolute" />
          </div>
        )}
      </div>
    </div>
  )
}
