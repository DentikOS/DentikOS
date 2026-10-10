import React, { useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CalendarDays, List, Users } from 'lucide-react'
import { useAgendaStore, type AgendaViewType } from '../../../../app/stores/useAgendaStore'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'

export interface AgendaNavigationProps {
  currentDateIso: string
  onDateChange: (newDateIso: string) => void
  onExportCSV?: () => void
}

const VISTAS_CONFIG: { id: AgendaViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'day', label: 'Día', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'week', label: 'Semana', icon: <CalendarDays className="w-3.5 h-3.5" /> },
  { id: 'month', label: 'Mes', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
  { id: 'list', label: 'Lista', icon: <List className="w-3.5 h-3.5" /> },
  { id: 'waiting_room', label: 'Sala de Espera', icon: <Users className="w-3.5 h-3.5" /> }
]

export const AgendaNavigation: React.FC<AgendaNavigationProps> = ({
  currentDateIso,
  onDateChange
}) => {
  const currentView = useAgendaStore((state) => state.currentView)
  const setView = useAgendaStore((state) => state.setView)

  const handleAnterior = useCallback(() => {
    const d = new Date(currentDateIso + 'T00:00:00')
    if (currentView === 'month') d.setMonth(d.getMonth() - 1)
    else if (currentView === 'week') d.setDate(d.getDate() - 7)
    else d.setDate(d.getDate() - 1)
    onDateChange(obtenerFechaLocalISO(d))
  }, [currentDateIso, currentView, onDateChange])

  const handleSiguiente = useCallback(() => {
    const d = new Date(currentDateIso + 'T00:00:00')
    if (currentView === 'month') d.setMonth(d.getMonth() + 1)
    else if (currentView === 'week') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
    onDateChange(obtenerFechaLocalISO(d))
  }, [currentDateIso, currentView, onDateChange])

  const handleHoy = useCallback(() => {
    onDateChange(obtenerFechaLocalISO())
  }, [onDateChange])

  // Atajos de teclado: 't' -> hoy, ArrowLeft / ArrowRight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 't' || e.key === 'T') handleHoy()
      else if (e.key === 'ArrowLeft') handleAnterior()
      else if (e.key === 'ArrowRight') handleSiguiente()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleHoy, handleAnterior, handleSiguiente])

  return (
    <div className="bg-surface p-3 border border-surface-border rounded-2xl flex items-center justify-between flex-wrap gap-3 shadow-xs">
      {/* Navegación temporal */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={handleHoy}
          className="px-3 py-1.5 rounded-xl font-bold text-xs bg-surface-muted hover:bg-surface-border text-[#0F172A] dark:text-white transition-colors cursor-pointer"
          title="Ir a hoy (T)"
        >
          Hoy
        </button>

        <div className="flex items-center rounded-xl bg-surface-muted p-0.5 border border-surface-border">
          <button
            type="button"
            onClick={handleAnterior}
            className="p-1 rounded-lg hover:bg-surface text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Anterior (←)"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSiguiente}
            className="p-1 rounded-lg hover:bg-surface text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Siguiente (→)"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <input
          type="date"
          value={currentDateIso}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-surface-border bg-surface text-[#0F172A] dark:text-white cursor-pointer"
          aria-label="Seleccionar fecha"
        />
      </div>

      {/* Selector de vistas */}
      <div className="flex items-center p-1 rounded-xl bg-surface-muted border border-surface-border">
        {VISTAS_CONFIG.map((v) => {
          const activa = currentView === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activa
                  ? 'bg-[#B88E3A] text-[#070B14] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {v.icon}
              <span>{v.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
