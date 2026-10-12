import React, { useState } from 'react'
import { Info, X } from 'lucide-react'
import { debeMostrarSugerenciaCompletitud, MENSAJE_SUGERENCIA } from '../../utils/sugerenciasCompletitud'
import type { Paciente } from '../../schemas/pacienteSchema'

interface SugerenciaCompletitudProps {
  paciente: Paciente
  onCompletar?: () => void
}

const DESCARTAR_KEY = 'sugerencia_completitud_descartada'

export const SugerenciaCompletitud: React.FC<SugerenciaCompletitudProps> = ({ paciente, onCompletar }) => {
  const [descartada, setDescartada] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`${DESCARTAR_KEY}_${paciente.id}`) === 'true'
    } catch {
      return false
    }
  })

  if (descartada || !debeMostrarSugerenciaCompletitud(paciente)) return null

  const handleDescartar = () => {
    try {
      localStorage.setItem(`${DESCARTAR_KEY}_${paciente.id}`, 'true')
    } catch {
      // Ignorar error de storage
    }
    setDescartada(true)
  }

  return (
    <div
      className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl"
      data-testid="sugerencia-completitud-banner"
    >
      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-blue-900 dark:text-blue-100">
          Antecedentes incompletos
        </p>
        <p className="text-blue-700 dark:text-blue-300 text-xs mt-0.5">
          {MENSAJE_SUGERENCIA}
        </p>
      </div>
      {onCompletar && (
        <button
          type="button"
          onClick={onCompletar}
          className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline shrink-0 cursor-pointer"
        >
          Completar ahora
        </button>
      )}
      <button
        type="button"
        onClick={handleDescartar}
        className="text-blue-400 hover:text-blue-600 shrink-0 cursor-pointer p-0.5"
        aria-label="Descartar sugerencia"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
