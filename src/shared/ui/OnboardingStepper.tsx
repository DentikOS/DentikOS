import React from 'react'

export interface OnboardingStepperProps {
  paso: number
  totalPasos?: number
}

const PASOS = [
  '1. Clínica', '2. Preferencias', '3. Plantilla', '4. Sedes y boxes',
  '5. Equipo', '6. Catálogo', '7. Convenios', '8. Listo',
]

export const OnboardingStepper: React.FC<OnboardingStepperProps> = ({
  paso,
  totalPasos = 8,
}) => {
  return (
    <div className="mb-6" aria-label="Progreso de configuración">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-graphite-500 dark:text-graphite-400" aria-live="polite">
        <span className="shrink-0">Paso {paso} de {totalPasos}</span>
        <span className="truncate text-right font-semibold text-champagne-700 dark:text-gold-satin">
          {PASOS[paso - 1]?.replace(/^\d+\.\s*/, '') || 'Configuración'}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-graphite-200 dark:bg-graphite-800"
        role="progressbar"
        aria-label="Progreso de configuración inicial"
        aria-valuemin={0}
        aria-valuemax={totalPasos}
        aria-valuenow={paso}
      >
        <div
          className="h-full origin-left rounded-full bg-gradient-to-r from-champagne-300 to-gold-solid transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${paso / totalPasos})` }}
        />
      </div>
    </div>
  )
}
