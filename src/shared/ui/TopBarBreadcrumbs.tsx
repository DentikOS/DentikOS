/**
 * TopBarBreadcrumbs — Ruta de navegación con separador · (punto medio), timer e isDirty
 * Blueprint 03
 */
import React, { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useTopBarStore, type BreadcrumbItem } from '../../app/stores/useTopBarStore'
import { playSound } from '../utils/soundEffects'

import { useGuardadoState } from '../hooks/useGuardadoState'

/**
 * Trunca texto a máximo N caracteres con "..." al INICIO
 * Especificación BP03 §02 — Decisión del CEO
 * Ej: "María José González Rodríguez" (29 chars, max 20) → "...González Rodríguez"
 */
const truncateStart = (text: string, maxLength: number = 20): string => {
  if (!text || text.length <= maxLength) return text
  return '…' + text.slice(-(maxLength - 1))
}

export interface TopBarBreadcrumbsProps {
  items: BreadcrumbItem[]
  pacienteId?: string | null
}

export const TopBarBreadcrumbs: React.FC<TopBarBreadcrumbsProps> = ({ items, pacienteId }) => {
  const guardadoStatus = useGuardadoState()
  const timerStart = useTopBarStore((s) => s.timerStart)
  const [elapsed, setElapsed] = useState(0)

  // BP03 §02: Máximo 3 niveles
  const visibleItems = items.slice(0, 3)

  useEffect(() => {
    if (!pacienteId || !timerStart) {
      setElapsed(0)
      return
    }
    const interval = setInterval(() => {
      setElapsed(Date.now() - timerStart)
    }, 1000)
    return () => clearInterval(interval)
  }, [pacienteId, timerStart])

  const formatTimer = (ms: number): string => {
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const timerColor =
    elapsed > 30 * 60 * 1000
      ? 'text-rose-500 font-bold'
      : elapsed > 15 * 60 * 1000
      ? 'text-amber-500 font-semibold'
      : 'text-graphite-400'

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-[13px]">
        <ol className="flex items-center gap-1.5">
          {visibleItems.map((item, idx) => {
            const isLast = idx === visibleItems.length - 1
            const truncatedLabel = truncateStart(item.label, 20)

            return (
              <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
                {idx > 0 && (
                  <span
                    className="text-[#CBD5E1] dark:text-[#CBD5E1] surgical:text-[#475569] font-normal select-none"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                )}
                {isLast ? (
                  <span
                    className="text-[13px] font-semibold text-[#B88E3A] dark:text-[#E5C378] surgical:text-[#B88E3A] truncate max-w-[180px] leading-tight"
                    aria-current="page"
                    title={item.label}
                  >
                    {truncatedLabel}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      playSound('breadcrumbClick')
                      item.onClick?.()
                    }}
                    className="text-[13px] font-normal text-[#64748B] dark:text-[#94A3B8] surgical:text-[#334155] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] surgical:hover:text-[#000000] transition-colors duration-100 truncate max-w-[140px] hover:underline cursor-pointer leading-tight"
                    title={item.label}
                  >
                    {truncatedLabel}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Timer de atención cuando hay paciente activo */}
      {pacienteId && timerStart && (
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded bg-graphite-100 dark:bg-graphite-800 shrink-0 ${timerColor}`}
          title="Tiempo transcurrido en ficha del paciente"
        >
          ⏱ {formatTimer(elapsed)}
        </span>
      )}

      {/* Estado derivado de guardado (BP03 §08 Feature 3) */}
      {guardadoStatus === 'dirty' && (
        <div data-testid="topbar-dirty-indicator" className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 shrink-0">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="hidden lg:inline">Cambios sin guardar</span>
        </div>
      )}

      {guardadoStatus === 'saved' && (
        <div data-testid="topbar-saved-indicator" className="flex items-center gap-1 text-[11px] text-[#0D9488] dark:text-teal-400 shrink-0 transition-opacity duration-300">
          <Check size={12} className="text-[#0D9488]" />
          <span className="hidden lg:inline">Guardado</span>
        </div>
      )}
    </div>
  )
}
