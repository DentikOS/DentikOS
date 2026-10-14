/**
 * FocusModeTopBar — TopBar mínimo para Modo Foco (Blueprint 03 §09)
 *
 * Muestra solo los elementos críticos durante procedimientos clínicos:
 * - Breadcrumbs (máx 3 niveles)
 * - Timer de atención (cuenta desde apertura de ficha)
 * - Estado de guardado (●/✓) — indicador visual, no botón
 * - Botón Salir (Esc)
 *
 * Altura: 56px (igual que TopBar normal para evitar re-layout)
 * Sidebar: se oculta automáticamente vía focusMode en App.tsx
 */
import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useSidebarStore } from '../../app/stores/useSidebarStore'
import { useTopBarStore, type BreadcrumbItem } from '../../app/stores/useTopBarStore'
import { useGuardadoState } from '../hooks/useGuardadoState'
import type { Paciente } from '../../domains/clinical/patient/schemas/pacienteSchema'

export interface FocusModeTopBarProps {
  breadcrumbs: BreadcrumbItem[]
  pacienteSeleccionado?: Paciente | null
}

/**
 * Trunca texto a máximo N caracteres con "..." al INICIO
 * (Blueprint 03 §02 — Decisión del CEO)
 */
const truncateStart = (text: string, maxLength: number = 20): string => {
  if (!text || text.length <= maxLength) return text
  return '…' + text.slice(-(maxLength - 1))
}

export const FocusModeTopBar: React.FC<FocusModeTopBarProps> = ({
  breadcrumbs,
  pacienteSeleccionado,
}) => {
  const setFocusMode = useSidebarStore((s) => s.setFocusMode)
  const guardadoStatus = useGuardadoState()
  const timerStart = useTopBarStore((s) => s.timerStart)
  const [elapsed, setElapsed] = useState(0)

  // Timer de atención (actualiza cada segundo)
  useEffect(() => {
    if (!pacienteSeleccionado || !timerStart) {
      setElapsed(0)
      return
    }
    const interval = setInterval(() => {
      setElapsed(Date.now() - timerStart)
    }, 1000)
    return () => clearInterval(interval)
  }, [pacienteSeleccionado, timerStart])

  const formatTimer = (ms: number): string => {
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Color del timer según tiempo transcurrido
  const timerColor =
    elapsed > 30 * 60 * 1000
      ? 'text-rose-500 font-bold'
      : elapsed > 15 * 60 * 1000
      ? 'text-amber-500 font-semibold'
      : 'text-[#94A3B8]'

  // Handler para botón Salir
  const handleSalir = () => {
    setFocusMode(false)
  }

  const visibleItems = breadcrumbs.slice(0, 3)

  return (
    <header
      className="sticky top-0 z-40 bg-white dark:bg-[#0F172A] surgical:bg-[#F1F5F9] border-b border-surface shadow-2xs h-[56px] flex items-center justify-between px-4 sm:px-6 gap-4 transition-colors"
      role="banner"
      aria-label="Modo Foco - Barra superior mínima"
    >
      {/* IZQUIERDA: Breadcrumbs + Timer + Estado guardado */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Breadcrumbs (máx 3 niveles, igual que TopBar normal) */}
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
                      onClick={() => item.onClick?.()}
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

        {/* Timer de atención (solo si hay paciente activo) */}
        {pacienteSeleccionado && timerStart && (
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded bg-graphite-100 dark:bg-graphite-800 shrink-0 ${timerColor}`}
            title="Tiempo transcurrido en ficha del paciente"
          >
            ⏱ {formatTimer(elapsed)}
          </span>
        )}

        {/* Estado de guardado */}
        {guardadoStatus === 'dirty' && (
          <div
            data-testid="focus-dirty-indicator"
            className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-slow" />
            <span className="hidden lg:inline">Cambios sin guardar</span>
          </div>
        )}

        {guardadoStatus === 'saved' && (
          <div
            data-testid="focus-saved-indicator"
            className="flex items-center gap-1 text-[11px] text-[#0D9488] dark:text-teal-400 shrink-0 transition-opacity duration-300"
          >
            <span className="text-sm">✓</span>
            <span className="hidden lg:inline">Guardado</span>
          </div>
        )}
      </div>

      {/* DERECHA: Botón Salir */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={handleSalir}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-graphite-100 hover:bg-graphite-200 dark:bg-graphite-800 dark:hover:bg-graphite-700 text-graphite-700 dark:text-graphite-300 text-sm font-medium transition-colors cursor-pointer"
          aria-label="Salir de Modo Foco (Esc)"
          title="Salir de Modo Foco"
        >
          <X size={16} />
          <span className="hidden sm:inline">Salir</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-graphite-900 rounded border border-surface">
            Esc
          </kbd>
        </button>
      </div>
    </header>
  )
}

FocusModeTopBar.displayName = 'FocusModeTopBar'
