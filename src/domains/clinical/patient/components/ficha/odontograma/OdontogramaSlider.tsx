import React from 'react'
import { Clock, History, ArrowRight } from 'lucide-react'

interface OdontogramaSliderProps {
  modoVista: 'inicial' | 'evolucion' | 'comparativo'
  onCambiarModo: (modo: 'inicial' | 'evolucion' | 'comparativo') => void
  progresoTemporal?: number
  onProgresoChange?: (progreso: number) => void
}

export const OdontogramaSlider: React.FC<OdontogramaSliderProps> = ({
  modoVista,
  onCambiarModo,
  progresoTemporal = 100,
  onProgresoChange,
}) => {
  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-surface/80 border border-surface rounded-2xl mb-4"
      data-testid="odontograma-slider-temporal"
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-graphite-800 dark:text-graphite-200">
          Línea de Tiempo Clínica
        </span>
      </div>

      {/* Selector de Modo */}
      <div className="flex items-center p-1 bg-surface-hover rounded-xl text-xs">
        <button
          type="button"
          onClick={() => onCambiarModo('inicial')}
          className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
            modoVista === 'inicial'
              ? 'bg-primary text-white shadow-xs'
              : 'text-graphite-600 hover:text-graphite-900 dark:text-graphite-400'
          }`}
        >
          Estado Inicial
        </button>
        <button
          type="button"
          onClick={() => onCambiarModo('evolucion')}
          className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
            modoVista === 'evolucion'
              ? 'bg-primary text-white shadow-xs'
              : 'text-graphite-600 hover:text-graphite-900 dark:text-graphite-400'
          }`}
        >
          Evolución Actual
        </button>
        <button
          type="button"
          onClick={() => onCambiarModo('comparativo')}
          className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1 ${
            modoVista === 'comparativo'
              ? 'bg-primary text-white shadow-xs'
              : 'text-graphite-600 hover:text-graphite-900 dark:text-graphite-400'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Comparativa
        </button>
      </div>

      {/* Slider Interactivo Antes/Después */}
      {modoVista === 'comparativo' && onProgresoChange && (
        <div className="flex items-center gap-2 w-full sm:w-64">
          <span className="text-[11px] text-graphite-500 font-medium">Inicial</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progresoTemporal}
            onChange={(e) => onProgresoChange(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
            aria-label="Deslizador temporal antes/después"
          />
          <span className="text-[11px] text-primary font-semibold flex items-center gap-0.5">
            Evolución <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </div>
  )
}
