import React from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'

export interface AlertaClinicaItem {
  id: string | number
  pacienteId?: string | number
  pacienteNombre: string
  tipo: 'alergia' | 'contraindicacion' | 'precaucion'
  mensaje: string
  severidad?: 'critica' | 'precaucion'
}

export interface WidgetAlertasClinicasProps {
  alertas?: AlertaClinicaItem[]
  onVerAlerta?: (alerta: AlertaClinicaItem) => void
  dragHandle?: React.ReactNode
}

export const WidgetAlertasClinicas: React.FC<WidgetAlertasClinicasProps> = ({
  alertas = [],
  onVerAlerta,
  dragHandle
}) => {
  const tieneCriticas = alertas.some((a) => a.severidad === 'critica')

  return (
    <WidgetBase
      titulo="Alertas Clínicas del Día"
      icono={<AlertTriangle className={`w-4 h-4 ${tieneCriticas ? 'text-[#E11D48]' : 'text-[#D97706]'}`} />}
      borderColor={tieneCriticas ? '#E11D48' : '#D97706'}
      dragHandle={dragHandle}
      headerAction={
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            tieneCriticas
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          }`}
        >
          {alertas.length} alertas
        </span>
      }
    >
      {alertas.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No hay alertas clínicas registradas para hoy</p>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => {
            const esCritica = alerta.severidad === 'critica'
            return (
              <div
                key={alerta.id}
                onClick={() => onVerAlerta?.(alerta)}
                className={`flex items-start justify-between p-2.5 rounded-xl border transition-all cursor-pointer group ${
                  esCritica
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 hover:border-rose-400'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 hover:border-amber-400'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                      {alerta.pacienteNombre}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                        esCritica ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {alerta.tipo}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                    {alerta.mensaje}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 shrink-0 mt-1" />
              </div>
            )
          })}
        </div>
      )}
    </WidgetBase>
  )
}
