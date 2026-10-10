import React, { useState } from 'react'
import { Layers, Plus, DollarSign, Send, Stethoscope, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { Badge } from '../../../../../../shared/ui/ui/Badge'
import { FichaDerivacionModal } from './FichaDerivacionModal'

export interface ProcedimientoPlan {
  id: string
  descripcion: string
  pieza?: number | string
  costo: number
  estado: 'pendiente' | 'aprobado' | 'realizado' | 'cancelado'
}

export interface FasePlan {
  id: string
  nombre: string
  subtitulo: string
  procedimientos: ProcedimientoPlan[]
}

const FASES_INICIALES: FasePlan[] = [
  {
    id: 'fase-urgencias',
    nombre: 'Fase 1: Urgencias & Control de Dolor',
    subtitulo: 'Infecciones agudas, drenaje, alivio sintomático y temporales',
    procedimientos: [
      { id: 'proc-1', descripcion: 'Descompresión y apertura de urgencia', pieza: '1.6', costo: 45000, estado: 'realizado' },
    ],
  },
  {
    id: 'fase-estabilizacion',
    nombre: 'Fase 2: Estabilización & Saneamiento',
    subtitulo: 'Destartraje, operatoria, endodoncias y control etiológico',
    procedimientos: [
      { id: 'proc-2', descripcion: 'Tratamiento de Endodoncia Molar', pieza: '1.6', costo: 180000, estado: 'aprobado' },
      { id: 'proc-3', descripcion: 'Destartraje supragingival bimaxilar', costo: 40000, estado: 'aprobado' },
    ],
  },
  {
    id: 'fase-rehabilitacion',
    nombre: 'Fase 3: Rehabilitación Biomecánica',
    subtitulo: 'Prótesis, coronas definitivas, implantes y oclusión funcional',
    procedimientos: [
      { id: 'proc-4', descripcion: 'Corona libre de metal Zirconio', pieza: '1.6', costo: 280000, estado: 'pendiente' },
    ],
  },
  {
    id: 'fase-estetica',
    nombre: 'Fase 4: Estética & Mantenimiento',
    subtitulo: 'Blanqueamiento, carillas, alineación y citas de mantención',
    procedimientos: [
      { id: 'proc-5', descripcion: 'Blanqueamiento dental profesional en clínica', costo: 150000, estado: 'pendiente' },
    ],
  },
]

interface PlanTratamientoProps {
  nombrePaciente?: string
  onGenerarPresupuesto?: (fases: FasePlan[]) => void
}

export const PlanTratamiento: React.FC<PlanTratamientoProps> = ({
  nombrePaciente = 'Paciente',
  onGenerarPresupuesto,
}) => {
  const [fases, setFases] = useState<FasePlan[]>(FASES_INICIALES)
  const [mostrarDerivacion, setMostrarDerivacion] = useState(false)

  const totalPlan = fases.reduce(
    (sum, f) => sum + f.procedimientos.reduce((pSum, p) => pSum + p.costo, 0),
    0
  )

  const cambiarEstadoProcedimiento = (
    faseId: string,
    procId: string,
    nuevoEstado: ProcedimientoPlan['estado']
  ) => {
    setFases((prev) =>
      prev.map((fase) => {
        if (fase.id !== faseId) return fase
        return {
          ...fase,
          procedimientos: fase.procedimientos.map((p) =>
            p.id === procId ? { ...p, estado: nuevoEstado } : p
          ),
        }
      })
    )
  }

  return (
    <div className="space-y-6" data-testid="plan-tratamiento-bp06">
      {/* Header Resumen del Plan */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-surface/90 border border-surface rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Plan Integral por 4 Fases Clínicas
            </h3>
          </div>
          <p className="text-xs text-graphite-500 mt-1">
            Urgencias &rarr; Estabilización &rarr; Rehabilitación &rarr; Estética
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={Stethoscope}
            onClick={() => setMostrarDerivacion(true)}
          >
            Ficha Derivación
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={DollarSign}
            onClick={() => onGenerarPresupuesto?.(fases)}
            data-testid="btn-generar-presupuesto-plan"
          >
            Generar Presupuesto (${totalPlan.toLocaleString('es-CL')})
          </Button>
        </div>
      </div>

      {/* Acordeón de 4 Fases */}
      <div className="space-y-4">
        {fases.map((fase) => {
          const totalFase = fase.procedimientos.reduce((acc, p) => acc + p.costo, 0)

          return (
            <div
              key={fase.id}
              className="p-5 bg-surface/80 border border-surface rounded-2xl space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-surface flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">
                    {fase.nombre}
                  </h4>
                  <p className="text-[11px] text-graphite-400">{fase.subtitulo}</p>
                </div>
                <span className="text-xs font-bold font-mono text-primary">
                  ${totalFase.toLocaleString('es-CL')}
                </span>
              </div>

              {/* Lista de procedimientos */}
              <div className="space-y-2">
                {fase.procedimientos.map((proc) => (
                  <div
                    key={proc.id}
                    className="p-3 rounded-xl bg-surface border border-surface flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {proc.pieza && (
                        <span className="font-mono font-bold text-primary px-1.5 py-0.5 rounded-md bg-primary/10 text-[11px]">
                          P.{proc.pieza}
                        </span>
                      )}
                      <span className="font-medium text-graphite-800 dark:text-graphite-200 truncate">
                        {proc.descripcion}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-graphite-700 dark:text-graphite-300">
                        ${proc.costo.toLocaleString('es-CL')}
                      </span>

                      <select
                        value={proc.estado}
                        onChange={(e) =>
                          cambiarEstadoProcedimiento(
                            fase.id,
                            proc.id,
                            e.target.value as ProcedimientoPlan['estado']
                          )
                        }
                        className="text-xs bg-surface border border-surface rounded-lg px-2 py-1 font-semibold"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="aprobado">Aprobado</option>
                        <option value="realizado">Realizado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {mostrarDerivacion && (
        <FichaDerivacionModal
          nombrePaciente={nombrePaciente}
          onCerrar={() => setMostrarDerivacion(false)}
          onDerivar={(d) => {
            window.alert(`Derivación emitida a ${d.especialidad} (${d.prioridad}).`)
          }}
        />
      )}
    </div>
  )
}
