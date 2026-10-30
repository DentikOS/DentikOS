import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Layers, DollarSign, Stethoscope } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { FichaDerivacionModal } from './FichaDerivacionModal'
import { useOdontogramaStore } from '../../../../../../app/stores/odontogramaStore'
import { usePresupuestosStore } from '../../../../../../app/stores/usePresupuestosStore'
import { ModalNuevoPresupuesto } from '../../../../../billing/budget/components/modal/ModalNuevoPresupuesto'
import { timelineService } from '../../../services/timelineService'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import { usePrestacionesStore } from '../../../../../../app/stores/prestacionesStore'
import { presupuestosStorageService } from '../../../../../billing/budget/services/presupuestosStorageService'
import {
  generarFasesDesdeOdontograma,
  fasesVacias,
  type FaseClinica,
  type FasePlan,
  type ProcedimientoPlan,
} from './planOdontogramaGenerator'

export type { FasePlan, ProcedimientoPlan }

interface PlanTratamientoProps {
  pacienteId: string
  nombrePaciente?: string
  pacienteRut?: string
  onGenerarPresupuesto?: (fases: FasePlan[]) => void
  setActiveSection?: (section: string) => void
}

export const PlanTratamiento: React.FC<PlanTratamientoProps> = ({
  pacienteId,
  nombrePaciente = 'Paciente',
  pacienteRut,
  onGenerarPresupuesto,
  setActiveSection,
}) => {
  const odontograma = useOdontogramaStore((s) => s.odontograma)
  const odontogramaPacienteId = useOdontogramaStore((s) => s.pacienteId)
  const [fases, setFases] = useState<FasePlan[]>(fasesVacias)
  const prestaciones = usePrestacionesStore((s) => s.prestacionesArancel)
  const [odontogramaActualizadoAt, setOdontogramaActualizadoAt] = useState<string | undefined>()
  const [guardando, setGuardando] = useState(false)
  const [planGuardado, setPlanGuardado] = useState(false)
  const [error, setError] = useState('')
  const [mostrarDerivacion, setMostrarDerivacion] = useState(false)
  const [modalPresupuestoAbierto, setModalPresupuestoAbierto] = useState(false)
  const planOdontogramaStampRef = useRef<string | null>(null)

  useEffect(() => {
    let vigente = true
    setFases(fasesVacias())
    planOdontogramaStampRef.current = null
    setPlanGuardado(false)
    if (!pacienteId) return
    fichasClinicasStorageService.obtenerFichaClinica(pacienteId).then((ficha) => {
      if (!vigente || !ficha) return
      const od = ficha.odontograma as { piezas?: Array<{ numero: string; estado: string; tipoPatologia?: string }>; piezasData?: Record<string, { caras?: Record<string, string>; estadoGeneral?: string }>; actualizadoAt?: string } | null
      const piezas = Array.isArray(od?.piezas) ? od.piezas : Object.entries(od?.piezasData || {}).map(([numero, data]) => ({
        numero,
        estado: (data.estadoGeneral && data.estadoGeneral !== 'sano') || Object.values(data.caras || {}).some((cara) => cara !== 'sano') ? 'patologia' : 'sano',
        tipoPatologia: data.estadoGeneral || Object.values(data.caras || {}).find((cara) => cara !== 'sano') || 'sano',
      }))
      setOdontogramaActualizadoAt(od?.actualizadoAt)
      const plan = ficha.plan_tratamiento as { fases?: FasePlan[]; odontogramaActualizadoAt?: string } | null
      if (Array.isArray(plan?.fases) && plan?.odontogramaActualizadoAt === od?.actualizadoAt) {
        planOdontogramaStampRef.current = od?.actualizadoAt || null
        setFases(plan.fases)
        setPlanGuardado(true)
      } else {
        setFases(generarFasesDesdeOdontograma(piezas))
      }
    })
    return () => { vigente = false }
  }, [pacienteId])

  useEffect(() => {
    if (odontogramaPacienteId === pacienteId && odontograma &&
      !(planOdontogramaStampRef.current && odontograma.actualizadoAt === planOdontogramaStampRef.current)) {
      setFases(generarFasesDesdeOdontograma(odontograma.piezas))
      setOdontogramaActualizadoAt(odontograma.actualizadoAt)
      setPlanGuardado(false)
    }
  }, [odontograma, odontogramaPacienteId, pacienteId])

  const totalPlan = useMemo(
    () => fases.reduce((sum, f) => sum + f.procedimientos.reduce((pSum, p) => pSum + (p.costo || 0), 0), 0),
    [fases]
  )

  const actualizarProcedimiento = (procId: string, cambio: Partial<ProcedimientoPlan>) => {
    setFases((prev) => {
      const procedimientos = prev.flatMap((fase) => fase.procedimientos).map((proc) => {
        if (proc.id !== procId) return proc
        const actualizado = { ...proc, ...cambio }
        actualizado.requiereRevision = !actualizado.prestacionId || !actualizado.faseAsignada || actualizado.costo === null
        return actualizado
      })
      const nuevasFases = fasesVacias()
      for (const proc of procedimientos) {
        const fase = proc.requiereRevision ? nuevasFases[4] : nuevasFases.find((f) => f.id === `fase-${proc.faseAsignada}`) || nuevasFases[4]
        fase.procedimientos.push(proc)
      }
      return nuevasFases
    })
    setPlanGuardado(false)
  }

  const guardarPlan = async () => {
    if (!pacienteId) return
    setGuardando(true)
    setError('')
    try {
      const ok = await fichasClinicasStorageService.guardarSeccionFicha(pacienteId, 'plan_tratamiento', {
        fases,
        odontogramaActualizadoAt,
        actualizadoAt: new Date().toISOString(),
      })
      setPlanGuardado(ok)
      if (ok) planOdontogramaStampRef.current = odontogramaActualizadoAt || null
      if (!ok) setError('No se pudo guardar el plan. Revisa la clínica activa y vuelve a intentar.')
    } catch {
      setPlanGuardado(false)
      setError('No se pudo guardar el plan. Revisa la clínica activa y vuelve a intentar.')
    } finally {
      setGuardando(false)
    }
  }

  const itemsPresupuesto = useMemo(() => fases.flatMap((f) =>
    f.id === 'fase-revision' ? [] : f.procedimientos.map((p) => ({
        id: crypto.randomUUID(),
        codigoPrestacion: p.prestacionId,
        nombrePrestacion: p.descripcion,
        piezaDental: p.pieza,
        cantidad: 1,
        precioUnitario: p.costo || 0,
        subtotal: p.costo || 0,
        descuento: 0,
        faseClinica: f.id.replace('fase-', '') as FaseClinica,
      }))
  ), [fases])

  const handleGenerarPresupuesto = () => {
    if (!pacienteId || !planGuardado || fases[4].procedimientos.length > 0 || itemsPresupuesto.length === 0) {
      setError('Guarda el plan y resuelve cada hallazgo con prestación y fase antes de generar el presupuesto.')
      return
    }
    setError('')
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
            Los hallazgos del odontograma requieren selección de prestación y fase por un profesional.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" size="sm" variant="secondary" icon={Stethoscope} onClick={() => setMostrarDerivacion(true)}>
            Ficha Derivación
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={guardarPlan} disabled={!pacienteId || guardando} data-testid="btn-guardar-plan">
            {guardando ? 'Guardando…' : planGuardado ? 'Plan guardado' : 'Guardar plan'}
          </Button>
          <Button type="button" size="sm" variant="primary" icon={DollarSign} onClick={handleGenerarPresupuesto} data-testid="btn-generar-presupuesto-plan">
            Generar Presupuesto (${totalPlan.toLocaleString('es-CL')})
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}

      {fases.every((fase) => fase.procedimientos.length === 0) && (
        <div className="p-4 bg-surface/60 border border-surface rounded-xl text-center text-xs text-graphite-500" data-testid="msg-sin-patologias">
          No hay patologías registradas
        </div>
      )}

      <div className="space-y-4">
        {fases.map((fase) => {
          const totalFase = fase.procedimientos.reduce((acc, p) => acc + (p.costo || 0), 0)
          return (
            <div key={fase.id} className="p-5 bg-surface/80 border border-surface rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-surface flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">{fase.nombre}</h4>
                  <p className="text-[11px] text-graphite-400">{fase.subtitulo}</p>
                </div>
                <span className="text-xs font-bold font-mono text-primary">{fase.id === 'fase-revision' ? `${fase.procedimientos.length} pendiente(s)` : `$${totalFase.toLocaleString('es-CL')}`}</span>
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

                    <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                      <select
                        aria-label={`Prestación para pieza ${proc.pieza}`}
                        value={proc.prestacionId || ''}
                        onChange={(e) => {
                          const prestacion = prestaciones.find((item) => String(item.id) === e.target.value)
                          actualizarProcedimiento(proc.id, prestacion ? {
                            prestacionId: String(prestacion.id),
                            descripcion: `${prestacion.nombre} (P.${proc.pieza})`,
                            costo: prestacion.precioParticular,
                          } : { prestacionId: undefined, descripcion: `Hallazgo ${proc.hallazgo} (P.${proc.pieza})`, costo: null })
                        }}
                        className="text-xs bg-surface border border-surface rounded-lg px-2 py-1"
                      >
                        <option value="">Revisión: seleccionar prestación</option>
                        {prestaciones.map((prestacion) => <option key={prestacion.id} value={String(prestacion.id)}>{prestacion.nombre} · ${prestacion.precioParticular.toLocaleString('es-CL')}</option>)}
                      </select>
                      <select
                        aria-label={`Fase para pieza ${proc.pieza}`}
                        value={proc.faseAsignada || ''}
                        onChange={(e) => actualizarProcedimiento(proc.id, { faseAsignada: e.target.value ? e.target.value as FaseClinica : undefined })}
                        className="text-xs bg-surface border border-surface rounded-lg px-2 py-1"
                      >
                        <option value="">Seleccionar fase</option>
                        <option value="urgencias">Urgencias</option>
                        <option value="estabilizacion">Estabilización</option>
                        <option value="rehabilitacion">Rehabilitación</option>
                        <option value="estetica">Estética</option>
                      </select>
                      <span className="font-mono font-semibold text-graphite-700 dark:text-graphite-300">
                        {proc.costo === null ? 'Sin precio · revisión clínica' : `$${proc.costo.toLocaleString('es-CL')}`}
                      </span>
                      <select
                        value={proc.estado}
                        onChange={(e) => actualizarProcedimiento(proc.id, { estado: e.target.value as ProcedimientoPlan['estado'] })}
                        disabled={proc.requiereRevision}
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
          pacienteId={pacienteId}
          pacienteNombre={nombrePaciente}
          pacienteRut={pacienteRut}
          itemsIniciales={itemsPresupuesto}
          onGuardar={async (presupuesto) => {
            const guardado = await presupuestosStorageService.guardarPresupuesto(presupuesto as any)
            if (!guardado) {
              setError('No se pudo guardar el presupuesto. Revisa la clínica activa y vuelve a intentar.')
              return false
            }
            usePresupuestosStore.getState().crearPresupuesto(presupuesto)
            await timelineService.agregarEvento(pacienteId, {
              id: crypto.randomUUID(),
              fecha: new Date().toISOString(),
              tipo: 'presupuesto',
              titulo: `Presupuesto ${presupuesto.folio} creado en borrador`,
              detalles: `Total: $${(presupuesto.totalAPagar || 0).toLocaleString('es-CL')} · ${(presupuesto.items || []).length} prestaciones`,
            })
            onGenerarPresupuesto?.(fases)
            setModalPresupuestoAbierto(false)
            return true
          }}
          onCerrar={() => setModalPresupuestoAbierto(false)}
        />
      )}
    </div>
  )
}
