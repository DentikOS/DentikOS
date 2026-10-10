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
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-[#B88E3A]/30 shadow-xs space-y-4">
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

      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#E5C378] to-[#B88E3A] transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface/80 hover:bg-surface border border-surface-border cursor-pointer transition-all"
          >
            {item.completado ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span
              className={`text-xs truncate ${
                item.completado
                  ? 'line-through text-slate-400'
                  : 'font-semibold text-[#0F172A] dark:text-white'
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        {primerPendiente && (
          <button
            type="button"
            onClick={() => onNavegarSeccion?.(primerPendiente.seccion)}
            className="flex items-center gap-1.5 text-xs font-bold text-[#B88E3A] hover:underline cursor-pointer"
          >
            <span>Siguiente tarea: {primerPendiente.label}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {onCompletarTour && (
          <button
            type="button"
            onClick={onCompletarTour}
            className="text-xs font-semibold text-slate-500 hover:text-[#B88E3A] transition-colors cursor-pointer ml-auto"
          >
            Ver mini-tour guiado ✨
          </button>
        )}
      </div>
    </div>
  )
}
