import React, { useState } from 'react'
import { Sparkles, ArrowRight, ArrowLeft, Check, X } from 'lucide-react'
import { escribirJSON } from '../../../infrastructure/storage/localStorageRepository'

const PASOS = [
  {
    titulo: 'Bienvenido a tu Consola Odontológica',
    descripcion: 'Este es tu Dashboard: aquí ves todo lo que pasa en tu clínica cada día con máxima telemetría operativa.',
    emoji: ''
  },
  {
    titulo: 'Morning Brief Inteligente',
    descripcion: 'El Morning Brief te da un resumen en 30 segundos. Click en cualquier línea para ir al módulo correspondiente.',
    emoji: ''
  },
  {
    titulo: 'Acciones Rápidas con Gradiente',
    descripcion: 'Las acciones rápidas abajo te permiten crear citas, pacientes y presupuestos en un click.',
    emoji: ''
  },
  {
    titulo: 'Búsqueda Global Omnicanal',
    descripcion: 'Usa ⌘K para buscar cualquier paciente, cita o acción sin navegar por menús manuales.',
    emoji: ''
  },
  {
    titulo: 'Personalización por Rol y Widgets',
    descripcion: 'Puedes personalizar tu Dashboard reordenando u ocultando los widgets según tu criterio profesional. ¡Explora!',
    emoji: ''
  }
]

export interface MiniTourProps {
  isOpen: boolean
  onClose: () => void
}

export const MiniTour: React.FC<MiniTourProps> = ({ isOpen, onClose }) => {
  const [pasoActual, setPasoActual] = useState(0)

  if (!isOpen) return null

  const esUltimo = pasoActual === PASOS.length - 1
  const paso = PASOS[pasoActual]

  const finalizar = () => {
    escribirJSON('dashboard_tour_completed', true)
    onClose()
  }

  const handleSiguiente = () => {
    if (esUltimo) {
      finalizar()
    } else {
      setPasoActual((prev) => prev + 1)
    }
  }

  const handleAnterior = () => {
    setPasoActual((prev) => Math.max(0, prev - 1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-surface border-2 border-[#B88E3A]/40 rounded-3xl shadow-2xl p-6 overflow-hidden space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#B88E3A]/10 text-[#B88E3A]">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-[#B88E3A] uppercase tracking-wider">
              Tour del Dashboard · Paso {pasoActual + 1} de {PASOS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={finalizar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Saltar tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center py-4 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-surface-muted flex items-center justify-center text-3xl shadow-inner">
            {paso.emoji}
          </div>
          <h3 className="text-xl font-bold text-[#0F172A] dark:text-white">
            {paso.titulo}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
            {paso.descripcion}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 py-1">
          {PASOS.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === pasoActual
                  ? 'w-6 bg-[#B88E3A]'
                  : 'w-2 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-surface-border">
          <button
            type="button"
            onClick={handleAnterior}
            disabled={pasoActual === 0}
            className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer ${
              pasoActual === 0
                ? 'opacity-0 pointer-events-none'
                : 'text-slate-600 hover:bg-surface-muted dark:text-slate-300'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <button
            type="button"
            onClick={finalizar}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Saltar tour
          </button>

          <button
            type="button"
            onClick={handleSiguiente}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white bg-[#B88E3A] hover:bg-[#a07a30] transition-colors shadow-xs cursor-pointer"
          >
            <span>{esUltimo ? 'Finalizar' : 'Siguiente'}</span>
            {esUltimo ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
