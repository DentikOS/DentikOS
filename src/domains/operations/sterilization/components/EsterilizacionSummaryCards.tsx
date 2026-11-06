import React, { memo } from 'react'
import { Flame, CheckCircle2, Hourglass, Activity, AlertTriangle } from 'lucide-react'
import type { ResumenEsterilizacion } from '../utils/esterilizacionCalculations'

export interface EsterilizacionSummaryCardsProps {
  resumen: ResumenEsterilizacion
}

export const EsterilizacionSummaryCards = memo<EsterilizacionSummaryCardsProps>(({ resumen }) => {
  return (
    <div className="metric-grid text-xs">
      <div className="relative overflow-hidden p-4 sm:p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9]/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-graphite-400 mb-1">
          <Flame size={13} className="text-clinical-info" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Ciclos registrados hoy</span>
        </div>
        <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50  block tabular-nums tracking-tight">
          {resumen.cargasHoy} <span className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">Ciclos</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-4 sm:p-5 bg-emerald-50/70 dark:bg-emerald-950/20  backdrop-blur-md border border-emerald-200/80 dark:border-emerald-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 mb-1">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Ciclos liberados</span>
        </div>
        <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200  block tabular-nums tracking-tight">
          {resumen.conformes} <span className="text-xs font-semibold">Liberados</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-4 sm:p-5 bg-amber-50/70 dark:bg-amber-950/20  backdrop-blur-md border border-amber-200/80 dark:border-amber-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-amber-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 mb-1">
          <Hourglass size={13} />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Pruebas biológicas pendientes</span>
        </div>
        <span className="text-2xl font-black text-amber-900 dark:text-amber-200  block tabular-nums tracking-tight">
          {resumen.biologicosPendientes} <span className="text-xs font-semibold">En Espera</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-4 sm:p-5 bg-sky-50/70 dark:bg-sky-950/20  backdrop-blur-md border border-sky-200/80 dark:border-sky-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9]/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 mb-1">
          <Activity size={13} className="text-clinical-info" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Autoclaves con Bowie-Dick aprobado hoy</span>
        </div>
        <span className={`text-2xl font-black block tabular-nums tracking-tight ${resumen.testBowieDickHoy ? 'text-emerald-700 dark:text-emerald-300 ' : 'text-rose-600 dark:text-rose-400 '}`}>
          <span className="inline-flex items-center gap-1.5">
            {resumen.testBowieDickHoy > 0
              ? <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-300" />
              : <AlertTriangle size={16} className="text-amber-600 dark:text-amber-300" />}
            {resumen.testBowieDickHoy}
          </span>
        </span>
      </div>
    </div>
  )
})

EsterilizacionSummaryCards.displayName = 'EsterilizacionSummaryCards'
