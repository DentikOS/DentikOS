import React from 'react'
import { DollarSign, ArrowUpRight, TrendingUp } from 'lucide-react'
import { WidgetBase } from './WidgetBase'

export interface WidgetPagosPendientesProps {
  porCobrarHoy?: number
  pagosVencidos?: number
  recaudadoHoy?: number
  onIrPagos?: () => void
  dragHandle?: React.ReactNode
}

export const WidgetPagosPendientes: React.FC<WidgetPagosPendientesProps> = ({
  porCobrarHoy = 180000,
  pagosVencidos = 240000,
  recaudadoHoy = 350000,
  onIrPagos,
  dragHandle
}) => {
  return (
    <WidgetBase
      titulo="Pagos & Flujo de Caja"
      icono={<DollarSign className="w-4 h-4 text-emerald-600" />}
      borderColor="#059669"
      dragHandle={dragHandle}
      headerAction={
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Admin exclusivo
        </span>
      }
      footer={
        <button
          type="button"
          onClick={onIrPagos}
          className="w-full flex items-center justify-center gap-1 font-semibold text-emerald-600 hover:underline cursor-pointer"
        >
          Ver Detalle de Pagos y Caja →
        </button>
      }
    >
      <div
        onClick={onIrPagos}
        className="space-y-3 cursor-pointer group"
      >
        <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50">
          <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 mb-1">
            <span className="font-medium">Recaudado Hoy</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
            ${recaudadoHoy.toLocaleString('es-CL')} CLP
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-surface-muted/50 border border-surface-border">
            <p className="text-[11px] text-slate-500 font-medium">Por cobrar hoy</p>
            <p className="text-sm font-bold text-[#0F172A] dark:text-white mt-0.5">
              ${porCobrarHoy.toLocaleString('es-CL')}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-muted/50 border border-surface-border">
            <p className="text-[11px] text-slate-500 font-medium">Saldos vencidos</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              ${pagosVencidos.toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 group-hover:text-emerald-600 transition-colors">
          <span>Conciliación de caja al cierre</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </WidgetBase>
  )
}
