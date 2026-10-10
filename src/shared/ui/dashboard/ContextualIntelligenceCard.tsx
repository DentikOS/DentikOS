import React from 'react'
import { Sparkles, Calendar, AlertCircle } from 'lucide-react'

export interface ContextualIntelligenceCardProps {
  mensajeContextual?: string | null
  onAccion?: (tipo: string) => void
}

export const ContextualIntelligenceCard: React.FC<ContextualIntelligenceCardProps> = ({
  mensajeContextual,
  onAccion
}) => {
  const diaSemana = new Date().getDay() // 0 = Domingo, 1 = Lunes, 5 = Viernes, 6 = Sábado

  let bannerEspecial = null
  if (diaSemana === 1) {
    bannerEspecial = {
      titulo: 'Weekly Digest',
      descripcion: 'Comienza la semana: revisa la ocupación de boxes y las citas programadas.',
      icono: <Calendar className="w-4 h-4 text-blue-600" />,
      color: 'border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200'
    }
  } else if (diaSemana === 5) {
    bannerEspecial = {
      titulo: 'Cierre de Semana',
      descripcion: 'Recuerda cuadrar caja y revisar presupuestos pendientes de confirmación para el lunes.',
      icono: <Sparkles className="w-4 h-4 text-amber-600" />,
      color: 'border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
    }
  } else if (diaSemana === 0 || diaSemana === 6) {
    bannerEspecial = {
      titulo: 'Fin de Semana — Protocolo de Guardia',
      descripcion: 'Atención prioritaria para urgencias odontológicas y seguimiento post-quirúrgico.',
      icono: <AlertCircle className="w-4 h-4 text-rose-600" />,
      color: 'border-rose-500/40 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
    }
  }

  if (!bannerEspecial && !mensajeContextual) return null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface border border-surface-border shadow-2xs">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#B88E3A]/10 text-[#B88E3A] flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          {bannerEspecial && (
            <p className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <span>{bannerEspecial.titulo}</span>
              <span className="text-[10px] font-normal text-slate-400">· Inteligencia Clínica</span>
            </p>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {mensajeContextual || bannerEspecial?.descripcion}
          </p>
        </div>
      </div>

      {bannerEspecial && (
        <button
          type="button"
          onClick={() => onAccion?.('digest')}
          className="self-end sm:self-center px-3 py-1.5 rounded-lg text-xs font-semibold text-[#B88E3A] bg-[#B88E3A]/10 hover:bg-[#B88E3A]/20 transition-colors cursor-pointer shrink-0"
        >
          Ver detalles →
        </button>
      )}
    </div>
  )
}
