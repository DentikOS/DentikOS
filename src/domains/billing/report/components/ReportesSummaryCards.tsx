import React, { memo } from 'react'
import type { MetricasReportes } from '../hooks/useReportes'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'

export interface ReportesSummaryCardsProps {
  metricas: MetricasReportes
  moneda?: string
}

export const ReportesSummaryCards: React.FC<ReportesSummaryCardsProps> = memo(({ metricas, moneda = 'CLP' }) => {
  return (
    <div className="metric-grid text-xs">
      <div className="p-4 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-gray-500 dark:text-graphite-400 uppercase tracking-wider block">
          Recaudación Real Efectiva
        </span>
        <span className="text-2xl font-black text-gray-900 dark:text-graphite-50 mt-1 block">
          {formatearImporteDocumento(metricas.totalRecaudado, moneda)}
        </span>
      </div>

      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
          Tasa Conversión Presupuestos
        </span>
        <span className="text-2xl font-black text-emerald-900 mt-1 block">
          {metricas.tasaConversionPresupuestos}% Aprobados
        </span>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
          Ticket Promedio / Paciente
        </span>
        <span className="text-2xl font-black text-blue-900 mt-1 block">
          {formatearImporteDocumento(metricas.ticketPromedio, moneda)}
        </span>
      </div>

      <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl shadow-xs">
        <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
          Tratamientos Prescritos
        </span>
        <span className="text-2xl font-black text-purple-900 mt-1 block">
          {metricas.totalProcedimientos} Procedimientos
        </span>
      </div>
    </div>
  )
})

ReportesSummaryCards.displayName = 'ReportesSummaryCards'
