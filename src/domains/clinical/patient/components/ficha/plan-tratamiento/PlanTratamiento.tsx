import React, { useState, useEffect, useMemo } from 'react'
import { Layers, DollarSign, Stethoscope } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { FichaDerivacionModal } from './FichaDerivacionModal'
import { useOdontogramaStore } from '../../../../../../app/stores/odontogramaStore'
import { usePresupuestosStore } from '../../../../../../app/stores/usePresupuestosStore'
import { usePacientesStore } from '../../../../../../app/stores/usePacientesStore'
import { ModalNuevoPresupuesto } from '../../../../../billing/budget/components/modal/ModalNuevoPresupuesto'
import { timelineService } from '../../../services/timelineService'
import { presupuestosStorageService } from '../../../../../billing/budget/services/presupuestosStorageService'
import {
  generarFasesDesdeOdontograma,
  type FasePlan,
  type ProcedimientoPlan,
} from './planOdontogramaGenerator'

export type { FasePlan, ProcedimientoPlan }

interface PlanTratamientoProps {
  nombrePaciente?: string
  onGenerarPresupuesto?: (fases: FasePlan[]) => void
  setActiveSection?: (section: string) => void
}

export const PlanTratamiento: React.FC<PlanTratamientoProps> = ({
  nombrePaciente = 'Paciente',
  onGenerarPresupuesto,
  setActiveSection,
}) => {
  const odontograma = useOdontogramaStore((s) => s.odontograma)
  const [fases, setFases] = useState<FasePlan[]>(() =>
    generarFasesDesdeOdontograma(odontograma?.piezas || [])
  )
  const [mostrarDerivacion, setMostrarDerivacion] = useState(false)
  const [modalPresupuestoAbierto, setModalPresupuestoAbierto] = useState(false)

  useEffect(() => {
    setFases(generarFasesDesdeOdontograma(odontograma?.piezas || []))
  }, [odontograma])

  const totalPlan = useMemo(
    () => fases.reduce((sum, f) => sum + f.procedimientos.reduce((pSum, p) => pSum + p.costo, 0), 0),
    [fases]
  )

  const cambiarEstadoProcedimiento = (faseId: string, procId: string, nuevoEstado: ProcedimientoPlan['estado']) => {
    setFases((prev) =>
      prev.map((fase) =>
        fase.id !== faseId
          ? fase
          : { ...fase, procedimientos: fase.procedimientos.map((p) => (p.id === procId ? { ...p, estado: nuevoEstado } : p)) }
      )
    )
  }

  const handleGenerarPresupuesto = () => {
    const pacienteActivo = usePacientesStore.getState().pacienteActivo
    const pacienteId = pacienteActivo?.id || 'pac-1'
    const items = fases.flatMap((f) =>
      f.procedimientos.map((p) => ({
        codigoPrestacion: `PREST-${p.pieza || 'GEN'}`,
        nombrePrestacion: p.descripcion,
        cantidad: 1,
        precioUnitario: p.costo,
        subtotal: p.costo,
        descuento: 0,
        faseClinica: f.id.replace('fase-', ''),
      }))
    )
    usePresupuestosStore.getState().generarDesdePlanTratamiento(pacienteId, nombrePaciente, items)
    setModalPresupuestoAbierto(true)
    onGenerarPresupuesto?.(fases)
  }

  return (
    <div className="space-y-6" data-testid="plan-tratamiento-bp06">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-surface/90 border border-surface rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Plan Integral desde Odontograma
            </h3>
          </div>
          <p className="text-xs text-graphite-500 mt-1">
            Fases clínicas generadas automáticamente a partir de patologías diagnosticadas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" size="sm" variant="secondary" icon={Stethoscope} onClick={() => setMostrarDerivacion(true)}>
            Ficha Derivación
          </Button>
          <Button type="button" size="sm" variant="primary" icon={DollarSign} onClick={handleGenerarPresupuesto} data-testid="btn-generar-presupuesto-plan">
            Generar Presupuesto (${totalPlan.toLocaleString('es-CL')})
          </Button>
        </div>
      </div>

      {totalPlan === 0 && (
        <div className="p-4 bg-surface/60 border border-surface rounded-xl text-center text-xs text-graphite-500" data-testid="msg-sin-patologias">
          No hay patologías registradas
        </div>
      )}

      <div className="space-y-4">
        {fases.map((fase) => {
          const totalFase = fase.procedimientos.reduce((acc, p) => acc + p.costo, 0)
          return (
            <div key={fase.id} className="p-5 bg-surface/80 border border-surface rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-surface flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">{fase.nombre}</h4>
                  <p className="text-[11px] text-graphite-400">{fase.subtitulo}</p>
                </div>
                <span className="text-xs font-bold font-mono text-primary">${totalFase.toLocaleString('es-CL')}</span>
              </div>

              <div className="space-y-2">
                {fase.procedimientos.map((proc) => (
                  <div key={proc.id} className="p-3 rounded-xl bg-surface border border-surface flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {proc.pieza && (
                        <span className="font-mono font-bold text-primary px-1.5 py-0.5 rounded-md bg-primary/10 text-[11px]">
                          P.{proc.pieza}
                        </span>
                      )}
                      <span className="font-medium text-graphite-800 dark:text-graphite-200 truncate">{proc.descripcion}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-graphite-700 dark:text-graphite-300">
                        ${proc.costo.toLocaleString('es-CL')}
                      </span>
                      <select
                        value={proc.estado}
                        onChange={(e) => cambiarEstadoProcedimiento(fase.id, proc.id, e.target.value as ProcedimientoPlan['estado'])}
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

      <div className="mt-6 pt-6 border-t border-surface flex justify-between items-center flex-wrap gap-4" data-testid="seccion-total-presupuesto-plan">
        <div>
          <p className="text-sm text-graphite-600 dark:text-graphite-400">Total estimado:</p>
          <p className="text-2xl font-bold font-mono text-primary">${totalPlan.toLocaleString('es-CL')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (setActiveSection) {
                setActiveSection('Presupuestos')
              } else {
                window.dispatchEvent(new CustomEvent('navegar_seccion', { detail: 'Presupuestos' }))
              }
            }}
            data-testid="btn-ver-todos-presupuestos"
          >
            Ver todos los presupuestos
          </Button>
          <button
            type="button"
            onClick={handleGenerarPresupuesto}
            className="px-6 py-3 bg-gradient-to-r from-[#E5C378] to-[#B88E3A] text-[#070B14] font-semibold rounded-lg hover:brightness-105 cursor-pointer"
            data-testid="btn-generar-presupuesto-bottom"
          >
            Generar presupuesto
          </button>
        </div>
      </div>

      {mostrarDerivacion && (
        <FichaDerivacionModal
          nombrePaciente={nombrePaciente}
          onCerrar={() => setMostrarDerivacion(false)}
          onDerivar={(d) => window.alert(`Derivación emitida a ${d.especialidad} (${d.prioridad}).`)}
        />
      )}

      {modalPresupuestoAbierto && (
        <ModalNuevoPresupuesto
          pacienteId={usePacientesStore.getState().pacienteActivo?.id || 'pac-1'}
          pacienteNombre={nombrePaciente}
          pacienteRut={usePacientesStore.getState().pacienteActivo?.rut || '12.345.678-9'}
          onGuardar={async (presupuesto) => {
            usePresupuestosStore.getState().actualizarPresupuesto(presupuesto.id, presupuesto)
            await presupuestosStorageService.guardarPresupuesto(presupuesto as any)
            const pid = usePacientesStore.getState().pacienteActivo?.id || 'pac-1'
            timelineService.agregarEvento(pid, {
              id: `tl-pres-${Date.now()}`,
              fecha: new Date().toISOString(),
              tipo: 'presupuesto',
              titulo: `Presupuesto ${presupuesto.folio || 'generado'} en estado BORRADOR`,
              detalles: `Total: $${(presupuesto.totalAPagar || 0).toLocaleString('es-CL')} · ${(presupuesto.items || []).length} prestaciones`,
            })
            onGenerarPresupuesto?.(fases)
            setModalPresupuestoAbierto(false)
          }}
          onCerrar={() => setModalPresupuestoAbierto(false)}
        />
      )}
    </div>
  )
}
