import React, { useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CalendarDays, List, Download } from 'lucide-react'
import { useAgendaStore, type AgendaViewType } from '../../../../app/stores/useAgendaStore'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { FILTROS_DOCTOR } from '../constants/doctorConstants'
import type { DoctorAgenda } from '../services/agendaConfigService'

export interface AgendaNavigationProps {
  currentDateIso: string
  onDateChange: (newDateIso: string) => void
  onExportCSV?: () => void
  doctorFiltro?: string
  setDoctorFiltro?: (doctor: string) => void
  doctores?: readonly DoctorAgenda[] | DoctorAgenda[]
}

const VISTAS_CONFIG: { id: AgendaViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'day', label: 'Día', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'week', label: 'Semana', icon: <CalendarDays className="w-3.5 h-3.5" /> },
  { id: 'month', label: 'Mes', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
  { id: 'list', label: 'Lista', icon: <List className="w-3.5 h-3.5" /> }
]

export const AgendaNavigation: React.FC<AgendaNavigationProps> = ({
  currentDateIso,
  onDateChange,
  onExportCSV,
  doctorFiltro,
  setDoctorFiltro,
  doctores = []
}) => {
  const currentView = useAgendaStore((state) => state.currentView)
  const setView = useAgendaStore((state) => state.setView)
  const userProfile = useSesionStore((s) => s.userProfile)
  const esDoctor = userProfile?.rol === 'dentista' || userProfile?.rol === 'admin'
  const dateInputRef = useRef<HTMLInputElement>(null)

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

  // Atajos de teclado: 't' -> hoy, ArrowLeft / ArrowRight, 'g' -> enfocar fecha
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      
      // BP05 §01: Atajos de navegación temporal
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        handleHoy()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleAnterior()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleSiguiente()
      } else if (e.key === 'g' || e.key === 'G') {
        // BP05 §01: Atajo G -> enfocar input de fecha
        e.preventDefault()
        dateInputRef.current?.focus()
        dateInputRef.current?.showPicker?.()
      }
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
          className="px-3 py-1.5 rounded-xl font-bold text-xs bg-surface-muted hover:bg-surface-border text-[#0F172A] dark:text-white transition-all duration-100 cursor-pointer active:scale-95 active:bg-surface-border"
          title="Ir a hoy (T)"
        >
          Hoy
        </button>

        <div className="flex items-center rounded-xl bg-surface-muted p-0.5 border border-surface-border">
          <button
            type="button"
            onClick={handleAnterior}
            className="p-1 rounded-lg hover:bg-surface text-slate-600 dark:text-slate-300 transition-all duration-100 cursor-pointer active:scale-90 active:bg-surface-border"
            title="Anterior (←)"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSiguiente}
            className="p-1 rounded-lg hover:bg-surface text-slate-600 dark:text-slate-300 transition-all duration-100 cursor-pointer active:scale-90 active:bg-surface-border"
            title="Siguiente (→)"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={dateInputRef}
          type="date"
          value={currentDateIso}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-surface-border bg-surface text-[#0F172A] dark:text-white cursor-pointer"
          aria-label="Seleccionar fecha (atajo G)"
          title="Ir a fecha específica (G)"
        />

        {onExportCSV && (
          <button
            type="button"
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-surface-muted hover:bg-surface-border text-[#0F172A] dark:text-white transition-all duration-100 cursor-pointer active:scale-95 active:bg-surface-border ml-1"
            aria-label="Exportar agenda a CSV"
            title="Exportar citas a CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        )}

        {setDoctorFiltro && (
          <select
            value={doctorFiltro || FILTROS_DOCTOR.TODOS}
            onChange={(e) => setDoctorFiltro(e.target.value)}
            className="px-2.5 py-1.5 border border-surface-border rounded-xl bg-surface text-xs font-bold text-[#0F172A] dark:text-white cursor-pointer ml-1"
            aria-label="Filtrar por doctor"
          >
            <option value={FILTROS_DOCTOR.TODOS}>Todos los doctores</option>
            {esDoctor && (
              <option value={FILTROS_DOCTOR.SOLO_YO}>
                Solo yo ({userProfile?.nombreCompleto?.split(' ')[0] || 'yo'})
              </option>
            )}
            {doctores.map((doc) => (
              <option key={doc.userId} value={doc.nombreCompleto}>
                {doc.nombreCompleto}
              </option>
            ))}
          </select>
        )}
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-[background,color] duration-100 cursor-pointer ${
                activa
                  ? 'bg-[#B88E3A] text-[#070B14] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 hover:text-[#0F172A] dark:hover:text-white'
              }`}
              aria-label={`Vista ${v.label}`}
              aria-pressed={activa}
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
