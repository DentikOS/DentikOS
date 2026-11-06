import React, { memo } from 'react'
import { Boxes, AlertTriangle, CalendarX, Coins } from 'lucide-react'
import type { ResumenInventario } from '../hooks/useInventario'

export interface StockSummaryCardsProps {
  resumen: ResumenInventario
}

export const StockSummaryCards: React.FC<StockSummaryCardsProps> = memo(({ resumen }) => {
  return (
    <div className="metric-grid text-xs">
      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9]/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-graphite-400 mb-1">
          <Boxes size={13} className="text-clinical-info" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Total Insumos</span>
        </div>
        <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50  block tabular-nums tracking-tight">
          {resumen.totalInsumos} <span className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">Ítems</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-amber-50/70 dark:bg-amber-950/20  backdrop-blur-md border border-amber-200/80 dark:border-amber-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-amber-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 mb-1">
          <AlertTriangle size={13} className="text-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Stock bajo · crítico · agotado</span>
        </div>
        <span className="text-2xl font-black text-amber-900 dark:text-amber-200 block tabular-nums tracking-tight">
          {resumen.stockBajoCount ?? 0} / {resumen.stockCriticoCount} / {resumen.agotadosCount ?? 0}
          <span className="ml-2 text-[10px] font-semibold text-gray-600 dark:text-graphite-400">bajo / crítico / agotado</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-rose-50/70 dark:bg-rose-950/20  backdrop-blur-md border border-rose-200/80 dark:border-rose-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-rose-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 mb-1">
          <CalendarX size={13} className="text-rose-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Por Vencer / Vencidos</span>
        </div>
        <span className="text-2xl font-black text-rose-900 dark:text-rose-200  block tabular-nums tracking-tight">
          {resumen.porVencerCount} <span className="text-xs font-semibold">Productos</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-amber-50/70 dark:bg-amber-950/20  backdrop-blur-md border border-amber-200/80 dark:border-amber-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A] before:to-transparent">
        <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 mb-1">
          <Coins size={13} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Valor Estimado en Stock</span>
        </div>
        <span className="text-2xl font-black text-amber-900 dark:text-amber-200  block tabular-nums tracking-tight">
          ${resumen.valorTotalInventario.toLocaleString('es-CL')} <span className="text-xs font-semibold">CLP</span>
        </span>
      </div>
    </div>
  )
})

StockSummaryCards.displayName = 'StockSummaryCards'
