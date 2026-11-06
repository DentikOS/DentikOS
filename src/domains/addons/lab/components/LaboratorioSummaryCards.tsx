import React, { memo } from 'react'
import { FlaskConical, CheckCircle2, RotateCcw } from 'lucide-react'
import type { ResumenLaboratorio } from '../utils/laboratorioCalculations'

export interface LaboratorioSummaryCardsProps {
  resumen: ResumenLaboratorio
}

export const LaboratorioSummaryCards: React.FC<LaboratorioSummaryCardsProps> = memo(({ resumen }) => {
  return (
    <div className="metric-grid text-xs">
      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9]/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-graphite-400 mb-1">
          <FlaskConical size={13} className="text-clinical-info" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Trabajos Activos</span>
        </div>
        <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50  block tabular-nums tracking-tight">
          {resumen.enProcesoCount} <span className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">En Proceso</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-emerald-50/70 dark:bg-emerald-950/20  backdrop-blur-md border border-emerald-200/80 dark:border-emerald-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 mb-1">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Listos para Instalar</span>
        </div>
        <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200  block tabular-nums tracking-tight">
          {resumen.listosInstalarCount} <span className="text-xs font-semibold">Recibidos</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-rose-50/70 dark:bg-rose-950/20  backdrop-blur-md border border-rose-200/80 dark:border-rose-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-rose-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 mb-1">
          <RotateCcw size={13} className="text-rose-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Órdenes en ajustes</span>
        </div>
        <span className="text-2xl font-black text-rose-900 dark:text-rose-200  block tabular-nums tracking-tight">
          {resumen.repeticionesCount} <span className="text-xs font-semibold">En revisión</span>
        </span>
      </div>
    </div>
  )
})

LaboratorioSummaryCards.displayName = 'LaboratorioSummaryCards'
