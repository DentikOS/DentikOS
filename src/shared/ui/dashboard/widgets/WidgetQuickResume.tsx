import React from 'react'
import { PlayCircle, Clock, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'
import type { QuickResumeData } from '../../../types/dashboardTypes'

export interface WidgetQuickResumeProps {
  data?: QuickResumeData | null
  onRetomar?: (data: QuickResumeData) => void
  dragHandle?: React.ReactNode
}

export const WidgetQuickResume: React.FC<WidgetQuickResumeProps> = ({
  data,
  onRetomar,
  dragHandle
}) => {
  if (!data) return null

  const minutos = Math.max(1, Math.round((Date.now() - (data.timestamp || Date.now())) / 60000))
  if (minutos > 30) return null

  return (
    <WidgetBase
      titulo="Quick Resume"
      icono={<PlayCircle className="w-4 h-4 text-[#B88E3A]" />}
      borderColor="#B88E3A"
      dragHandle={dragHandle}
      headerAction={
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#B88E3A]/10 text-[#B88E3A]">
          Ficha reciente
        </span>
      }
      footer={
        <button
          type="button"
          onClick={() => onRetomar?.(data)}
          className="w-full flex items-center justify-center gap-1.5 font-bold text-[#B88E3A] hover:underline cursor-pointer"
        >
          <span>Retomar atención</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      }
    >
      <div
        onClick={() => onRetomar?.(data)}
        className="p-3 rounded-xl bg-[#B88E3A]/5 hover:bg-[#B88E3A]/10 border border-[#B88E3A]/30 transition-all cursor-pointer group"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Continuar donde lo dejaste:</p>
            <p className="text-sm font-bold text-[#0F172A] dark:text-white group-hover:text-[#B88E3A] transition-colors mt-0.5">
              {data.pacienteNombre}
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-surface-border text-slate-600 dark:text-slate-300">
            {data.tabActiva || 'Ficha General'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
          <Clock className="w-3.5 h-3.5 text-[#B88E3A]" />
          <span>Editado hace {minutos} min</span>
        </div>
      </div>
    </WidgetBase>
  )
}
