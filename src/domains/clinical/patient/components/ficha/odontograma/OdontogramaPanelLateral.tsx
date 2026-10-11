import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ShieldAlert } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import type { CaraDental } from './OdontogramaPieza'
import { ESTADOS_ODONTOGRAMA } from './OdontogramaPanel'
import { sonarDoblePulso680_850Hz } from '../../../utils/alertaSonido'

interface OdontogramaPanelLateralProps {
  pieza?: string | null
  piezaId?: string | null
  abierto?: boolean
  datos?: { caras: Record<CaraDental, string>; estadoGeneral?: string }
  onCerrar: () => void
  onActualizarCara?: (cara: CaraDental, estado: string) => void
  onActualizarEstadoGeneral?: (estado: string | undefined) => void
  onGuardar?: (datos: { caras: Record<CaraDental, string>; estadoGeneral?: string }) => void
}

const CARAS_INFO: { id: CaraDental; label: string }[] = [
  { id: 'vestibular', label: 'Vestibular' },
  { id: 'oclusal', label: 'Oclusal / Incisal' },
  { id: 'lingual', label: 'Lingual / Palatino' },
  { id: 'mesial', label: 'Mesial' },
  { id: 'distal', label: 'Distal' },
]

export const OdontogramaPanelLateral: React.FC<OdontogramaPanelLateralProps> = ({
  pieza,
  piezaId,
  abierto,
  datos,
  onCerrar,
  onActualizarCara = () => {},
  onActualizarEstadoGeneral = () => {},
  onGuardar,
}) => {
  const [caraActiva, setCaraActiva] = useState<CaraDental>('oclusal')

  const piezaEfectiva = piezaId || pieza
  if (abierto === false || !piezaEfectiva) return null

  const caras = datos?.caras || {
    vestibular: 'sano',
    lingual: 'sano',
    mesial: 'sano',
    distal: 'sano',
    oclusal: 'sano',
  }
  const estadoGeneral = datos?.estadoGeneral

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          className="w-full max-w-md h-full bg-white dark:bg-graphite-900 shadow-2xl border-l border-graphite-200 dark:border-graphite-800 flex flex-col"
          data-testid="odontograma-panel-lateral"
        >
          {/* Header */}
          <div className="p-4 border-b border-graphite-200 dark:border-graphite-800 flex items-center justify-between bg-graphite-50 dark:bg-graphite-950">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-mono text-primary">Pieza {piezaEfectiva}</span>
                {estadoGeneral && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                    {ESTADOS_ODONTOGRAMA.find((e) => e.id === estadoGeneral)?.nombre || estadoGeneral}
                  </span>
                )}
              </div>
              <p className="text-xs text-graphite-500 dark:text-graphite-400">Detalle anatómico y 5 caras clínicas</p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="p-1.5 rounded-lg hover:bg-graphite-200 dark:hover:bg-graphite-800 text-graphite-500 transition-colors"
              aria-label="Cerrar panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Selector de Caras (5 Caras) */}
            <div>
              <p className="text-xs font-bold text-graphite-700 dark:text-graphite-300 uppercase tracking-wider mb-2">
                1. Selecciona Cara Dental
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARAS_INFO.map((c) => {
                  const estadoActual = caras[c.id] || 'sano'
                  const def = ESTADOS_ODONTOGRAMA.find((e) => e.id === estadoActual)
                  const isSeleccionada = caraActiva === c.id

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCaraActiva(c.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSeleccionada
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 font-bold'
                          : 'border-graphite-200 dark:border-graphite-800 hover:border-graphite-300 bg-white dark:bg-graphite-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-medium mb-1">
                        <span>{c.label}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-graphite-300"
                          style={{ backgroundColor: def?.color || '#FFFFFF' }}
                        />
                      </div>
                      <p className="text-[11px] text-graphite-500 dark:text-graphite-400 truncate">
                        {def?.nombre || 'Sano'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selector de Estado Clínico (17 Estados) */}
            <div>
              <p className="text-xs font-bold text-graphite-700 dark:text-graphite-300 uppercase tracking-wider mb-2">
                2. Asignar Estado a Cara ({caraActiva.toUpperCase()}) o Pieza
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 border border-graphite-100 dark:border-graphite-800 rounded-xl">
                {ESTADOS_ODONTOGRAMA.map((est) => {
                  const isCaraActivaEnEsteEstado = caras[caraActiva] === est.id
                  const isPiezaEnEsteEstado = estadoGeneral === est.id

                  return (
                    <button
                      key={est.id}
                      type="button"
                      onClick={() => {
                        if (est.alcance === 'pieza') {
                          onActualizarEstadoGeneral(isPiezaEnEsteEstado ? undefined : est.id)
                        } else {
                          onActualizarCara(caraActiva, est.id)
                        }
                      }}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border ${
                        (est.alcance === 'cara' && isCaraActivaEnEsteEstado) || (est.alcance === 'pieza' && isPiezaEnEsteEstado)
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                          : 'bg-white dark:bg-graphite-800/50 border-graphite-200 dark:border-graphite-700 hover:bg-graphite-50 text-graphite-700 dark:text-graphite-300'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-graphite-300 shrink-0"
                        style={{ backgroundColor: est.color }}
                      />
                      <div className="truncate">
                        <p className="truncate font-medium">{est.nombre}</p>
                        <span className="text-[9px] text-graphite-400 uppercase tracking-wider">
                          {est.alcance === 'pieza' ? 'Toda la pieza' : 'Cara individual'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-graphite-200 dark:border-graphite-800 flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  CARAS_INFO.forEach((c) => onActualizarCara(c.id, 'sano'))
                  onActualizarEstadoGeneral(undefined)
                }}
              >
                Resetear a Sano
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                icon={Check}
                onClick={() => {
                  sonarDoblePulso680_850Hz()
                  onGuardar?.(datos || { caras, estadoGeneral })
                  onCerrar()
                }}
              >
                Listo
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
