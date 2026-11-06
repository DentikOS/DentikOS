import React, { memo } from 'react'
import { formatearImporteDocumento, type IdiomaDocumento, type MonedaDocumento } from '../../../../shared/utils/formatoDocumento'
import type { ResumenArancel } from '../utils/prestacionesCalculations'

export interface PrestacionesSummaryCardsProps {
  resumen: ResumenArancel
  moneda?: MonedaDocumento
  idioma?: IdiomaDocumento
}

export const PrestacionesSummaryCards: React.FC<PrestacionesSummaryCardsProps> = memo(({ resumen, moneda = 'CLP', idioma = 'es-CL' }) => {
  return (
    <div className="metric-grid text-xs">
      <div className="p-4 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-gray-500 dark:text-graphite-400 uppercase tracking-wider block">
          Total Procedimientos
        </span>
        <span className="text-2xl font-black text-gray-900 dark:text-graphite-50 mt-1 block">
          {resumen.totalProcedimientos} Ítems
        </span>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
          Valor Promedio Particular
        </span>
        <span className="text-2xl font-black text-blue-900 mt-1 block">
          {formatearImporteDocumento(resumen.precioPromedio, moneda, idioma)}
        </span>
      </div>

      <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
          Especialidad Predominante
        </span>
        <span
          className="text-lg font-black text-purple-900 mt-1 block truncate"
          title={resumen.especialidadMasFrecuente}
        >
          {resumen.especialidadMasFrecuente}
        </span>
      </div>

      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
          Arancel Máximo
        </span>
        <span className="text-2xl font-black text-emerald-900 mt-1 block">
          {formatearImporteDocumento(resumen.precioMaximo, moneda, idioma)}
        </span>
      </div>
    </div>
  )
})

PrestacionesSummaryCards.displayName = 'PrestacionesSummaryCards'
