import React, { memo } from 'react'
import { exportService } from '../services/exportService'
import { FileSpreadsheet, Trophy } from 'lucide-react'
import type { TopPrestacion } from '../utils/reportesCalculations'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'

export interface RankingPrestacionesTableProps {
  topPrestaciones?: TopPrestacion[]
  moneda?: string
}

export const RankingPrestacionesTable: React.FC<RankingPrestacionesTableProps> = memo(({
  topPrestaciones = [],
  moneda = 'CLP',
}) => {
  if (topPrestaciones.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-gray-400 dark:text-graphite-500 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl">
        Sin datos suficientes para generar el ranking de procedimientos.
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-5 shadow-xs text-xs space-y-3">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-graphite-700 pb-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase tracking-wider inline-flex items-center gap-2">
          <Trophy size={14} />
          Top Procedimientos más Rentables
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-gray-100 dark:bg-graphite-800 text-gray-700 dark:text-graphite-300 px-2 py-0.5 rounded font-bold">
            Por Ingreso Generado
          </span>
          <button
            onClick={() => exportService.exportarRankingExcel(topPrestaciones, moneda)}
            className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded font-bold hover:bg-emerald-700 transition-colors"
            aria-label="Exportar ranking de prestaciones a Excel"
            title="Descargar Excel con ranking de prestaciones"
          >
            <span className="inline-flex items-center gap-1">
              <FileSpreadsheet size={14} />
              Excel
            </span>
          </button>
        </div>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-graphite-800 border-b border-gray-200 dark:border-graphite-700 text-gray-700 dark:text-graphite-300 font-bold uppercase text-[10px]">
            <th className="p-2.5">Procedimiento</th>
            <th className="p-2.5 text-center">N° Cantidad</th>
            <th className="p-2.5 text-right">Monto Acumulado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-graphite-800">
          {topPrestaciones.map((item, index) => (
            <tr
              key={index}
              className="hover:bg-gray-50 dark:hover:bg-graphite-700 transition-colors"
            >
              <td className="p-2.5 font-bold text-gray-900 dark:text-graphite-50">
                <span className="text-gray-400 dark:text-graphite-500 font-mono mr-1.5">
                  #{index + 1}
                </span>
                {item.nombre}
              </td>
              <td className="p-2.5 text-center font-semibold text-gray-700 dark:text-graphite-300">
                <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded-lg border border-blue-200 font-bold">
                  {item.cantidad} u.
                </span>
              </td>
              <td className="p-2.5 text-right font-black text-emerald-900">
                {formatearImporteDocumento(item.montoTotal, moneda)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

RankingPrestacionesTable.displayName = 'RankingPrestacionesTable'
