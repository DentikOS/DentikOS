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
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-graphite-900 dark:text-white">
          Tu día en 30 segundos
        </h2>
        {data.fechaActualizacion && (
          <span className="text-xs font-medium text-graphite-500 dark:text-graphite-300">
            Actualizado {data.fechaActualizacion}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 px-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-x-6">
        {data.lineas.map((linea) => {
          let iconColor = 'bg-graphite-100 text-graphite-600 dark:bg-graphite-800 dark:text-graphite-200'
          let textColor = 'text-graphite-700 dark:text-graphite-200'
          if (linea.severidad === 'alerta') {
            iconColor = 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            textColor = 'text-rose-800 dark:text-rose-200'
          } else if (linea.severidad === 'advertencia') {
            iconColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
            textColor = 'text-amber-900 dark:text-amber-200'
          }

          const IconComp = getIconComponent(linea.icono)

          return (
            <button
              key={linea.id}
              type="button"
              onClick={() => onNavegar?.(linea.seccion)}
              className="group flex min-w-0 items-center gap-3 border-b border-surface-border/70 py-3.5 text-left transition-colors duration-150 hover:bg-surface-muted/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-satin"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                <IconComp className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-snug ${textColor}`}>
                  {linea.texto}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-champagne-700 dark:text-gold-satin group-hover:underline group-hover:underline-offset-2">
                  {linea.seccion}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
