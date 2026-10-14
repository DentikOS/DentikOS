/**
 * ModoPresentacionBar — Barra superior fija de 48px en Modo Presentación (⌘⇧M)
 * Blueprint 03: Diferenciador competitivo para exhibir planes a pacientes sin distracciones operativas
 */
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DentikOSLogo } from './brand/DentikOSLogo'
import type { Paciente } from '../../domains/clinical/patient/schemas/pacienteSchema'

export interface ModoPresentacionBarProps {
  activo: boolean
  clinicaNombre?: string
  paciente?: Paciente | null
  onSalir: () => void
}

export const ModoPresentacionBar: React.FC<ModoPresentacionBarProps> = ({
  activo,
  clinicaNombre = 'DentikOS Clinical Suite',
  paciente,
  onSalir,
}) => {
  return (
    <AnimatePresence>
      {activo && (
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 h-[48px] bg-white/95 dark:bg-graphite-950/95 border-b border-surface backdrop-blur-md z-50 flex items-center justify-between px-6 shadow-lg"
          role="banner"
          aria-label="Barra de Modo Presentación"
        >
          {/* Izquierda: Logo + Clínica */}
          <div className="flex items-center gap-3">
            <DentikOSLogo variant="horizontal" size="sm" opticalSize="standard" />
            <div className="h-4 w-px bg-graphite-300 dark:bg-graphite-700 hidden sm:block" />
            <span className="text-base font-semibold text-graphite-800 dark:text-graphite-200 hidden sm:inline">
              {clinicaNombre}
            </span>
          </div>

          {/* Centro/Derecha: Paciente + Botón Salir */}
          <div className="flex items-center gap-4">
            {paciente ? (
              <span className="text-base font-medium text-graphite-700 dark:text-graphite-300">
                {paciente.nombre} {paciente.edad ? `· ${paciente.edad} años` : ''}
              </span>
            ) : (
              <span className="text-base text-graphite-500 dark:text-graphite-400">
                Sin paciente seleccionado
              </span>
            )}
            <button
              type="button"
              onClick={onSalir}
              aria-label="Salir del modo presentación"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-graphite-100 hover:bg-graphite-200 dark:bg-graphite-800 dark:hover:bg-graphite-700 text-graphite-900 dark:text-graphite-100 transition-colors border border-surface cursor-pointer"
              title="Salir de Modo Presentación"
            >
              <span>Salir</span>
              <kbd className="px-1 py-0.2 text-[9px] font-mono bg-white dark:bg-graphite-900 rounded border border-surface">
                Esc
              </kbd>
            </button>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  )
}
