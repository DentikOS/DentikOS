import React, { memo } from 'react'
import { Cigarette, Stethoscope, Trophy } from 'lucide-react'
import type { IndicesPeriodontalesResultado } from '../utils/periodontalCalculations'

export interface FactoresRiesgoState {
  fumador: boolean
  diabetes: boolean
}

export interface ClasificacionAAPCardProps {
  indices: Partial<IndicesPeriodontalesResultado>
  factoresRiesgo: FactoresRiesgoState
  setFactoresRiesgo: React.Dispatch<React.SetStateAction<FactoresRiesgoState>>
}

export const ClasificacionAAPCard = memo<ClasificacionAAPCardProps>(({ indices, factoresRiesgo, setFactoresRiesgo }) => {
  return (
    <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-5 shadow-xs space-y-4 text-xs mb-6 print:hidden">
      <div className="flex justify-between items-center border-b pb-2 flex-wrap gap-2">
        <h4 className="font-extrabold text-gray-900 dark:text-graphite-50 uppercase tracking-wider text-[11px] flex items-center gap-2">
          <Trophy size={14} className="inline" /> Diagnóstico Periodontal Estándar AAP/EFP (Chicago 2017)
        </h4>

        {/* Factores Moduladores de Riesgo */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-graphite-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-graphite-700">
          <span className="font-bold text-gray-600 dark:text-graphite-400 text-[10px]">Factores Moduladores de Riesgo:</span>
          <label className="flex items-center gap-1 font-bold text-gray-800 dark:text-graphite-100 cursor-pointer">
            <input
              type="checkbox"
              checked={factoresRiesgo.fumador}
              onChange={(e) => setFactoresRiesgo(prev => ({ ...prev, fumador: e.target.checked }))}
              className="rounded text-black dark:text-graphite-50 focus:ring-0"
            />
            <span className="inline-flex items-center gap-1"><Cigarette size={14} />Tabaquismo</span>
          </label>
          <label className="flex items-center gap-1 font-bold text-gray-800 dark:text-graphite-100 cursor-pointer">
            <input
              type="checkbox"
              checked={factoresRiesgo.diabetes}
              onChange={(e) => setFactoresRiesgo(prev => ({ ...prev, diabetes: e.target.checked }))}
              className="rounded text-black dark:text-graphite-50 focus:ring-0"
            />
            <span className="inline-flex items-center gap-1"><Stethoscope size={14} />Diabetes</span>
          </label>
        </div>
      </div>

      {indices.diagnosticoConcluyente === false && (
        <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-900 text-[11px] font-semibold">
          Sondaje incompleto: {indices.sitiosSinRegistrar} de {indices.sitiosTotales} sitios sin registrar.
          El diagnóstico AAP no se calcula hasta completar al menos el 80% del sondaje de las piezas presentes.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border ${indices.colorEtapa || 'border-gray-200'} space-y-1`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">Estadificación (Severidad / Extensión)</span>
          <span className="text-base font-black block">{indices.diagnosticoSugerido}</span>
          <span className="text-[10px] block opacity-80">Calculado en base a sondaje máximo ({indices.maxSondaje}mm) y porcentaje BOP ({indices.porcentajeSangrado}%).</span>
        </div>

        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider block text-purple-800">Gradación (Tasa de Progresión)</span>
          <span className="text-base font-black block">{indices.gradoAAP}</span>
          <span className="text-[10px] text-purple-700 block">Basado en factores modificadores del hospedero e inflamación activa.</span>
        </div>
      </div>
    </div>
  )
})

ClasificacionAAPCard.displayName = 'ClasificacionAAPCard'
