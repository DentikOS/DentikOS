import React, { useState } from 'react'
import { CheckCircle2, Circle, ArrowRight, X } from 'lucide-react'
import { leerJSON, escribirJSON } from '../../../infrastructure/storage/localStorageRepository'

const CHECKLIST_KEY = 'dashboard_onboarding_checklist'

export interface ChecklistItem {
  id: string
  label: string
  completado: boolean
  seccion: string
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: '1', label: 'Espacio configurado', completado: true, seccion: 'Administración DentikOS' },
  { id: '2', label: 'Sedes creadas', completado: true, seccion: 'Administración DentikOS' },
  { id: '3', label: 'Invitar equipo', completado: false, seccion: 'Administración DentikOS' },
  { id: '4', label: 'Agregar prestaciones', completado: false, seccion: 'Prestaciones' },
  { id: '5', label: 'Configurar agenda', completado: false, seccion: 'Agenda' },
  { id: '6', label: 'Crear primer paciente', completado: false, seccion: 'Pacientes' }
]

export interface ChecklistOnboardingProps {
  onNavegarSeccion?: (seccion: string) => void
  onCompletarTour?: () => void
}

export const ChecklistOnboarding: React.FC<ChecklistOnboardingProps> = ({
  onNavegarSeccion,
  onCompletarTour
}) => {
  const [oculto, setOculto] = useState<boolean>(() => {
    return !!leerJSON<boolean>('dashboard_onboarding_dismissed', false)
  })
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    return leerJSON<ChecklistItem[]>(CHECKLIST_KEY, DEFAULT_ITEMS)
  })

  if (oculto) return null

  const completados = items.filter((i) => i.completado).length
  const porcentaje = Math.round((completados / items.length) * 100)

  const toggleItem = (id: string) => {
    const nuevos = items.map((i) => (i.id === id ? { ...i, completado: !i.completado } : i))
    setItems(nuevos)
    escribirJSON(CHECKLIST_KEY, nuevos)
  }

  const descartar = () => {
    setOculto(true)
    escribirJSON('dashboard_onboarding_dismissed', true)
  }

  const primerPendiente = items.find((i) => !i.completado)

  return (
    <div className="p-3 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-[#B88E3A]/30 shadow-xs space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#B88E3A] uppercase tracking-wider">
            Primeros Pasos en Studio Dental
          </span>
          <h3 className="text-base font-bold text-[#0F172A] dark:text-white mt-0.5">
            Checklist de Configuración Inicial ({completados} de {items.length} completados)
          </h3>
        </div>
        <button
          type="button"
          onClick={descartar}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Ocultar checklist"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-graphite-200 dark:bg-graphite-800"
        role="progressbar"
        aria-label="Progreso de configuración inicial"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
      >
        <div
          className="h-full origin-left rounded-full bg-gradient-to-r from-[#E5C378] to-[#B88E3A] transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${porcentaje / 100})` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.completado}
            onClick={() => toggleItem(item.id)}
            className="group flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-surface-border bg-surface/80 p-2 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-champagne-300 hover:bg-surface hover:shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-satin focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {item.completado ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span
              className={`text-xs leading-tight ${
                item.completado
                  ? 'line-through text-slate-400'
                  : 'font-semibold text-[#0F172A] dark:text-white'
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-start gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        {primerPendiente && (
          <button
            type="button"
            onClick={() => onNavegarSeccion?.(primerPendiente.seccion)}
            className="flex min-w-0 items-center gap-1.5 text-left text-xs font-bold text-[#B88E3A] hover:underline cursor-pointer"
          >
            <span>Siguiente tarea: {primerPendiente.label}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {onCompletarTour && (
          <button
            type="button"
            onClick={onCompletarTour}
            className="text-xs font-semibold text-slate-500 hover:text-[#B88E3A] transition-colors cursor-pointer sm:ml-auto"
          >
            Ver mini-tour guiado
          </button>
        )}
      </div>
    </div>
  )
}
