import React, { useState } from 'react'
import { Sparkles, Check, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'

export interface OpcionComparativa {
  id: string
  nombre: string
  descripcion: string
  tiempoEstimado: string
  beneficios: string[]
  total: number
  esRecomendada?: boolean
}

interface PresupuestoComparativoProps {
  opciones?: OpcionComparativa[]
  onAprobarOpcion: (opcion: OpcionComparativa) => void
  onCerrar?: () => void
}

export const PresupuestoComparativo: React.FC<PresupuestoComparativoProps> = ({
  opciones = [],
  onAprobarOpcion,
  onCerrar,
}) => {
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<string>('')

  const handleConfirmar = () => {
    const elegida = opciones.find((o) => o.id === opcionSeleccionada)
    if (elegida) {
      onAprobarOpcion(elegida)
    }
  }

  return (
    <div
      className="p-6 bg-surface/90 border border-surface rounded-2xl space-y-6 shadow-sm"
      data-testid="presupuesto-comparativo-modulo"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">
              Presupuesto Clínico Comparativo de Alternativas
            </h3>
          </div>
          <p className="text-xs text-graphite-500 mt-0.5">
            Compare alternativas terapéuticas y seleccione la opción que mejor se adapte a sus expectativas.
          </p>
        </div>

        {onCerrar && (
          <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>
            Volver
          </Button>
        )}
      </div>

      {/* Grid de 3 Opciones Comparativas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {opciones.length === 0 && <p className="text-xs text-graphite-500">No hay alternativas clínicas registradas para comparar.</p>}
        {opciones.map((opc) => {
          const isSelected = opcionSeleccionada === opc.id

          return (
            <div
              key={opc.id}
              onClick={() => setOpcionSeleccionada(opc.id)}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer relative ${
                isSelected
                  ? 'bg-primary/5 border-primary shadow-md ring-2 ring-primary/20'
                  : 'bg-surface border-surface hover:border-primary/40 hover:bg-surface-hover/50'
              }`}
            >
              {opc.esRecomendada && (
                <div className="absolute -top-3 right-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Recomendada
                  </span>
                </div>
              )}

              <div>
                <h4 className="font-bold text-sm text-graphite-900 dark:text-graphite-50 mb-1">
                  {opc.nombre}
                </h4>
                <p className="text-xs text-graphite-500 leading-relaxed mb-4">
                  {opc.descripcion}
                </p>

                <div className="flex items-center gap-1.5 text-xs text-graphite-600 dark:text-graphite-300 font-medium mb-4">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Tiempo estimado: {opc.tiempoEstimado}</span>
                </div>

                <div className="space-y-1.5 mb-6">
                  <span className="text-[11px] font-bold text-graphite-700 dark:text-graphite-300 uppercase tracking-wider block">
                    Ventajas Clínicas:
                  </span>
                  {opc.beneficios.map((ben, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-graphite-600 dark:text-graphite-400">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{ben}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total y Radio */}
              <div className="pt-4 border-t border-surface flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-graphite-400 block uppercase">
                    Inversión Total:
                  </span>
                  <span className="text-lg font-black font-mono text-graphite-900 dark:text-graphite-50">
                    ${opc.total.toLocaleString('es-CL')}
                  </span>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-primary bg-primary text-white' : 'border-graphite-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Botón de Confirmación */}
      <div className="flex items-center justify-between pt-2 border-t border-surface">
        <span className="text-xs text-graphite-500">
          Selecciona una alternativa clínica registrada para continuar.
        </span>
        <Button
          type="button"
          variant="primary"
          icon={CheckCircle2}
          onClick={handleConfirmar}
          disabled={!opciones.some((o) => o.id === opcionSeleccionada)}
          data-testid="btn-aprobar-opcion-comparativa"
        >
          Aprobar Opción Seleccionada
        </Button>
      </div>
    </div>
  )
}
