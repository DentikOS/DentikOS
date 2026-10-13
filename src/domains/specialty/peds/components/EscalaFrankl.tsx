import React, { memo } from 'react'
import { Baby } from 'lucide-react'
import { Icon } from '../../../../shared/ui/Icon'
import { ESCALA_FRANKL } from '../constants/pediatriaConstants'

export interface EscalaFranklProps {
  gradoSeleccionado: number
  onCambiarGrado: (grado: number) => void
  observacion?: string
  onCambiarObservacion: (campo: string, valor: unknown) => void
}

export const EscalaFrankl = memo<EscalaFranklProps>(({
  gradoSeleccionado,
  onCambiarGrado,
  observacion,
  onCambiarObservacion
}) => {
  return (
    <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-6 shadow-xs space-y-4">
      <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 border-b pb-2 uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><Icon icon={Baby} size="sm" />Escala de Conducta de Frankl (Evaluación Comportamental)</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ESCALA_FRANKL.map(item => (
          <button
            key={item.grado}
            type="button"
            onClick={() => onCambiarGrado(item.grado)}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              gradoSeleccionado === item.grado
                ? `${item.color} border-2 font-bold shadow-xs`
                : 'bg-gray-50 dark:bg-graphite-800 text-gray-700 dark:text-graphite-300 border-gray-200 dark:border-graphite-700 hover:bg-gray-100 dark:hover:bg-graphite-700'
            }`}
          >
            <div>
              <span className="text-xs font-black block">{item.titulo}</span>
              <p className="text-[10px] mt-1 leading-snug">{item.desc}</p>
            </div>
            {gradoSeleccionado === item.grado && (
              <span className="text-[10px] font-black uppercase mt-2 block text-right">Seleccionado</span>
            )}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-gray-600 dark:text-graphite-400 font-bold mb-1 uppercase text-xs">Observaciones del Comportamiento en Sillón</label>
        <input
          type="text"
          value={observacion || ''}
          onChange={(e) => onCambiarObservacion('observacionConducta', e.target.value)}
          placeholder="Ej: Niño acude acompañado por la madre, adaptación progresiva con decir-mostrar-hacer."
          className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-graphite-800 text-xs"
        />
      </div>
    </div>
  )
})

EscalaFrankl.displayName = 'EscalaFrankl'
