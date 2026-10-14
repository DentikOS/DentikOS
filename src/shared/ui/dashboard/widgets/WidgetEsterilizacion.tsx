import React from 'react'
import { Sparkles, Thermometer, Clock, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'

export interface AutoclaveInfo {
  equipo: string
  ciclo: number
  temperatura: string
  tiempoRestante: string
  estado: 'en_curso' | 'validado' | 'espera'
}

export interface WidgetEsterilizacionProps {
  info?: AutoclaveInfo | null
  onIrEsterilizacion?: () => void
  dragHandle?: React.ReactNode
}

export const WidgetEsterilizacion: React.FC<WidgetEsterilizacionProps> = ({
  info = null,
  onIrEsterilizacion,
  dragHandle
}) => {
  if (!info) {
    return (
      <WidgetBase
        titulo="Control de Esterilización"
        icono={<Sparkles className="w-4 h-4 text-teal-600" />}
        borderColor="#0D9488"
        dragHandle={dragHandle}
        headerAction={
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            Sin ciclos activos
          </span>
        }
        footer={
          <button
            type="button"
            onClick={onIrEsterilizacion}
            className="w-full flex items-center justify-center gap-1 font-semibold text-teal-600 hover:underline cursor-pointer"
          >
            Abrir Módulo de Esterilización →
          </button>
        }
      >
        <p className="text-xs text-slate-400 text-center py-6">
          No hay ciclos de esterilización activos
        </p>
      </WidgetBase>
    )
  }

  const esValidado = info.estado === 'validado'
  const colorBorde = esValidado ? '#0D9488' : '#D97706'

  return (
    <WidgetBase
      titulo="Control de Esterilización"
      icono={<Sparkles className="w-4 h-4 text-teal-600" />}
      borderColor={colorBorde}
      dragHandle={dragHandle}
      headerAction={
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            esValidado
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          }`}
        >
          {esValidado ? 'Validado' : 'Ciclo en Curso'}
        </span>
      }
      footer={
        <button
          type="button"
          onClick={onIrEsterilizacion}
          className="w-full flex items-center justify-center gap-1 font-semibold text-teal-600 hover:underline cursor-pointer"
        >
          Abrir Módulo de Esterilización →
        </button>
      }
    >
      <div
        onClick={onIrEsterilizacion}
        className="p-3 rounded-xl bg-surface-muted/40 hover:bg-surface-muted border border-surface-border transition-all cursor-pointer group space-y-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#0F172A] dark:text-white group-hover:text-teal-600 transition-colors">
            {info.equipo}
          </p>
          <span className="text-xs font-semibold text-slate-500">Ciclo #{info.ciclo}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-surface border border-surface-border">
            <Thermometer className="w-3.5 h-3.5 text-rose-500" />
            <div>
              <p className="text-[10px] text-slate-400">Temperatura</p>
              <p className="font-bold text-[#0F172A] dark:text-white">{info.temperatura}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-surface border border-surface-border">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <div>
              <p className="text-[10px] text-slate-400">Restante</p>
              <p className="font-bold text-[#0F172A] dark:text-white">{info.tiempoRestante}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Trazabilidad SEREMI al día</span>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-teal-600" />
        </div>
      </div>
    </WidgetBase>
  )
}
