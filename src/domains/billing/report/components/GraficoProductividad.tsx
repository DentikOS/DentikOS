import React, { memo } from 'react'
import { ESPECIALIDADES_COLOR } from '../constants/reportesConstants'
import { BarChart3 } from 'lucide-react'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'

export interface GraficoProductividadProps {
  desgloseEspecialidad?: Record<string, number>
  moneda?: string
}

export const GraficoProductividad: React.FC<GraficoProductividadProps> = memo(({
  desgloseEspecialidad = {},
  moneda = 'CLP',
}) => {
  const entradas = Object.entries(desgloseEspecialidad)
  const montoMaximo = Math.max(...entradas.map(([, v]) => v), 1)

  return (
    <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-5 shadow-xs text-xs space-y-4">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-graphite-700 pb-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase tracking-wider inline-flex items-center gap-2">
          <BarChart3 size={16} />
          Distribución por Especialidad Odontológica
        </h3>
        <span className="text-[10px] text-gray-500 dark:text-graphite-400 font-semibold">
          Proporción de Ingresos
        </span>
      </div>

      {entradas.length === 0 ? (
        <p className="text-gray-400 dark:text-graphite-500 text-center py-8">
          No hay registros de especialidades asignadas.
        </p>
      ) : (
        <div className="space-y-3">
          {entradas.map(([esp, monto]) => {
            const porcentaje = Math.round((monto / montoMaximo) * 100)
            const colorBarra = ESPECIALIDADES_COLOR[esp] || 'bg-black'

            return (
              <div key={esp} className="space-y-1">
                <div className="flex justify-between font-semibold text-gray-800 dark:text-graphite-100 text-[11px]">
                  <span>{esp}</span>
                  <span className="font-extrabold text-emerald-900">
                    {formatearImporteDocumento(monto, moneda)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-graphite-800 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${colorBarra} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

GraficoProductividad.displayName = 'GraficoProductividad'
