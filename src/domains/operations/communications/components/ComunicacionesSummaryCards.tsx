import React, { memo } from 'react'
import { MessageSquare, CheckCircle2, Send, Mail } from 'lucide-react'
import type { ResumenComunicaciones } from '../utils/comunicacionesCalculations'

export interface ComunicacionesSummaryCardsProps {
  resumen: ResumenComunicaciones
}

export const ComunicacionesSummaryCards: React.FC<ComunicacionesSummaryCardsProps> = memo(({ resumen }) => {
  return (
    <div className="metric-grid text-xs">
      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9]/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-graphite-500 dark:text-graphite-400 mb-1">
          <MessageSquare size={13} className="text-clinical-info" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Total Comunicaciones</span>
        </div>
        <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50  block tabular-nums tracking-tight">
          {resumen.totalEnviados} <span className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">Registros</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-emerald-50/70 dark:bg-emerald-950/20  backdrop-blur-md border border-emerald-200/80 dark:border-emerald-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 mb-1">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Tasa de Confirmación</span>
        </div>
        <span className="text-2xl font-black text-emerald-900 dark:text-emerald-300  block tabular-nums tracking-tight">
          {resumen.tasaConfirmacion}% <span className="text-xs font-semibold">Citas Confirmadas</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-amber-50/70 dark:bg-amber-950/20  backdrop-blur-md border border-amber-200/80 dark:border-amber-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A] before:to-transparent">
        <div className="flex items-center gap-1.5 text-primary mb-1">
          <Send size={13} />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Enviados por WhatsApp</span>
        </div>
        <span className="text-2xl font-black text-primary  block tabular-nums tracking-tight">
          {resumen.totalWhatsApp} <span className="text-xs font-semibold">Envíos</span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-indigo-50/70 dark:bg-indigo-950/20  backdrop-blur-md border border-indigo-200/80 dark:border-indigo-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-indigo-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 mb-1">
          <Mail size={13} className="text-indigo-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Correos Electrónicos</span>
        </div>
        <span className="text-2xl font-black text-indigo-900 dark:text-indigo-300  block tabular-nums tracking-tight">
          {resumen.totalEmail} <span className="text-xs font-semibold">Mails</span>
        </span>
      </div>
    </div>
  )
})

ComunicacionesSummaryCards.displayName = 'ComunicacionesSummaryCards'
