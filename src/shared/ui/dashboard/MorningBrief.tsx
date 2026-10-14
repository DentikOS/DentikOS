import React from 'react'
import {
  ArrowUpRight,
  Calendar,
  Wallet,
  AlertTriangle,
  FlaskConical,
  Package,
  Activity,
  CheckCircle2,
  Info,
  Sparkles,
} from 'lucide-react'
import type { MorningBriefData } from '../../types/dashboardTypes'

export interface MorningBriefProps {
  data: MorningBriefData
  onNavegar?: (seccion: string) => void
}

/**
 * Mapeo de strings de icono (desde useMorningBrief) a componentes Lucide.
 * Coherente con patrón usado en AccionesRapidas.tsx.
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  wallet: Wallet,
  alert: AlertTriangle,
  lab: FlaskConical,
  package: Package,
  activity: Activity,
  check: CheckCircle2,
  info: Info,
  sparkles: Sparkles,
}

/**
 * Obtiene el componente de icono Lucide correspondiente al string.
 * Fallback: Info si el icono no está mapeado.
 */
const getIconComponent = (iconName: string): React.ComponentType<{ className?: string }> => {
  return ICON_MAP[iconName] || Info
}

export const MorningBrief: React.FC<MorningBriefProps> = ({ data, onNavegar }) => {
  if (!data?.lineas || data.lineas.length === 0) return null

  return (
    <div
      className="relative rounded-2xl bg-surface border border-surface-border p-4 sm:p-5 shadow-xs overflow-hidden transition-all"
      style={{
        borderLeft: '4px solid transparent',
        borderImage: 'linear-gradient(to bottom, #E5C378, #B88E3A) 1',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
            Tu día en 30 segundos
          </h2>
        </div>
        {data.fechaActualizacion && (
          <span className="text-[11px] font-medium text-slate-400">
            Actualizado {data.fechaActualizacion}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {data.lineas.map((linea) => {
          let badgeColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          if (linea.severidad === 'alerta') {
            badgeColor = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50'
          } else if (linea.severidad === 'advertencia') {
            badgeColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50'
          }

          const IconComp = getIconComponent(linea.icono)

          return (
            <button
              key={linea.id}
              type="button"
              onClick={() => onNavegar?.(linea.seccion)}
              className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer group ${badgeColor} hover:shadow-xs hover:border-[#B88E3A]/40`}
            >
              <div className="w-7 h-7 rounded-lg bg-[#B88E3A]/10 text-[#B88E3A] flex items-center justify-center shrink-0 mt-0.5">
                <IconComp className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-snug line-clamp-2">
                  {linea.texto}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#B88E3A] mt-1 group-hover:underline">
                  Ver en {linea.seccion}
                  <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
