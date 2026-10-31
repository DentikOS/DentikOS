import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Layers, DollarSign, Stethoscope } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { FichaDerivacionModal } from './FichaDerivacionModal'
import { derivacionesService, type DerivacionClinica } from './derivacionesService'
import { PresupuestosPaciente } from './PresupuestosPaciente'
import { useOdontogramaStore } from '../../../../../../app/stores/odontogramaStore'
import { useSesionStore } from '../../../../../../app/stores/sesionStore'
import { usePacientesStore } from '../../../../../../app/stores/pacientesStore'
import { useRBAC } from '../../../../../../shared/hooks/useRBAC'
import { usePresupuestosStore } from '../../../../../../app/stores/usePresupuestosStore'
import { ModalNuevoPresupuesto } from '../../../../../billing/budget/components/modal/ModalNuevoPresupuesto'
import { timelineService } from '../../../services/timelineService'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import { usePrestacionesStore } from '../../../../../../app/stores/prestacionesStore'
import { presupuestosStorageService, type PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'
import { presupuestoPlanSyncService } from '../../../../../billing/budget/services/presupuestoPlanSyncService'
import { getClinicaActivaSync } from '../../../../../../infrastructure/auth/authService'
import type { ItemDesdePlan } from '../../../../../billing/budget/utils/planBudgetMerge'
import { evaluarEstadoPlanTratamiento } from './estadoPlanTratamiento'
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
  const { rol } = useRBAC()
  const emisor = useSesionStore((s) => s.userProfile)
  const clinicaActual = useSesionStore((s) => s.clinicaActual)
  const abrirPestanaFicha = usePacientesStore((s) => s.setPestanaActiva)
  const odontogramaPacienteId = useOdontogramaStore((s) => s.pacienteId)
  const [fases, setFases] = useState<FasePlan[]>(fasesVacias)
  const prestaciones = usePrestacionesStore((s) => s.prestacionesArancel)
  const [odontogramaActualizadoAt, setOdontogramaActualizadoAt] = useState<string | undefined>()
  const [piezasActuales, setPiezasActuales] = useState<Parameters<typeof generarFasesDesdeOdontograma>[0]>([])
  const [guardando, setGuardando] = useState(false)
  const [planGuardado, setPlanGuardado] = useState(false)
  const [planRevision, setPlanRevision] = useState<string | undefined>()
  const [versionables, setVersionables] = useState<PresupuestoLocal[]>([])
  const [presupuestosPlan, setPresupuestosPlan] = useState<PresupuestoLocal[]>([])
  const [borradoresDesactualizados, setBorradoresDesactualizados] = useState<PresupuestoLocal[]>([])
  const [odontogramaDesactualizado, setOdontogramaDesactualizado] = useState(false)
  const [error, setError] = useState('')
  const [mostrarDerivacion, setMostrarDerivacion] = useState(false)
  const [derivaciones, setDerivaciones] = useState<DerivacionClinica[]>([])
  const [modalPresupuestoAbierto, setModalPresupuestoAbierto] = useState(false)
  const planOdontogramaStampRef = useRef<string | null>(null)
  const planCargadoRef = useRef(false)

  useEffect(() => {
    const cargar = () => setPresupuestosPlan(getClinicaActivaSync()
      ? presupuestosStorageService.obtenerPresupuestos([]).filter((p) => String(p.pacienteId) === pacienteId)
      : [])
    cargar()
    window.addEventListener('presupuestos_actualizados', cargar)
    return () => window.removeEventListener('presupuestos_actualizados', cargar)
  }, [pacienteId, clinicaActual])

  useEffect(() => {
    let vigente = true
    setDerivaciones([])
    if (pacienteId) void derivacionesService.listar(pacienteId)
      .then((lista) => { if (vigente) setDerivaciones(lista) })
      .catch(() => { if (vigente) setDerivaciones([]) })
    return () => { vigente = false }
  }, [pacienteId])

  useEffect(() => {
    let vigente = true
    setVersionables([])
    setBorradoresDesactualizados([])
    if (pacienteId && planRevision) void presupuestosStorageService.sincronizarDesdeSupabase()
      .then((lista) => {
        if (!vigente) return
        const porGrupo = new Map<string, PresupuestoLocal>()
        for (const presupuesto of lista) {
          if (!presupuesto.origenPlan || !presupuesto.versionGrupoId || String(presupuesto.pacienteId) !== pacienteId) continue
          const actual = porGrupo.get(presupuesto.versionGrupoId)
          if (!actual || Number(presupuesto.version || 1) > Number(actual.version || 1)) {
            porGrupo.set(presupuesto.versionGrupoId, presupuesto)
          }
        }
        const desactualizados = [...porGrupo.values()].filter((p) => p.planRevision !== planRevision && p.sincronizado !== false)
        setBorradoresDesactualizados(desactualizados.filter((p) => ['borrador', 'Borrador'].includes(p.estado || '')))
        setVersionables(desactualizados.filter((p) =>
          ['enviado', 'Emitido', 'Pendiente', 'aprobado', 'Aprobado', 'en-curso', 'EnTratamiento'].includes(p.estado || '')))
      })
      .catch(() => { if (vigente) { setVersionables([]); setBorradoresDesactualizados([]) } })
    return () => { vigente = false }
  }, [pacienteId, planRevision])

  useEffect(() => {
    let vigente = true
    setFases(fasesVacias())
    planOdontogramaStampRef.current = null
    planCargadoRef.current = false
    setPlanGuardado(false)
    setPlanRevision(undefined)
    setOdontogramaDesactualizado(false)
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
      setPiezasActuales(piezas as Parameters<typeof generarFasesDesdeOdontograma>[0])
      const plan = ficha.plan_tratamiento as { fases?: FasePlan[]; odontogramaActualizadoAt?: string; actualizadoAt?: string } | null
      if (Array.isArray(plan?.fases)) {
        planCargadoRef.current = true
        planOdontogramaStampRef.current = plan.odontogramaActualizadoAt || null
        setFases(plan.fases)
        setPlanGuardado(true)
        setPlanRevision(plan.actualizadoAt)
        setOdontogramaDesactualizado(plan.odontogramaActualizadoAt !== od?.actualizadoAt)
      } else {
        setFases(generarFasesDesdeOdontograma(piezas))
      }
    })
    return () => { vigente = false }
  }, [pacienteId])

  useEffect(() => {
    if (odontogramaPacienteId === pacienteId && odontograma &&
      !(planCargadoRef.current && odontograma.actualizadoAt === planOdontogramaStampRef.current)) {
      setPiezasActuales(odontograma.piezas)
      if (planCargadoRef.current) {
        setOdontogramaActualizadoAt(odontograma.actualizadoAt)
        setOdontogramaDesactualizado(true)
        return
      }
      setFases(generarFasesDesdeOdontograma(odontograma.piezas))
      setOdontogramaActualizadoAt(odontograma.actualizadoAt)
      setPlanGuardado(false)
    }
  }, [odontograma, odontogramaPacienteId, pacienteId])

  const totalPlan = useMemo(
    () => fases.reduce((sum, f) => sum + f.procedimientos.reduce((pSum, p) => pSum + (p.costo || 0), 0), 0),
    [fases]
  )
  const estadoPlan = useMemo(() => evaluarEstadoPlanTratamiento(
    fases, presupuestosPlan, pacienteId, planGuardado ? planRevision : undefined
  ), [fases, presupuestosPlan, pacienteId, planGuardado, planRevision])

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

  const solicitarMotivoVersion = () => {
    const motivo = window.prompt('Motivo de la nueva versión del presupuesto:')?.trim()
    if (!motivo || motivo.length > 500) {
      setError('Indica un motivo de hasta 500 caracteres para registrar la versión.')
      return null
    }
    return motivo
  }

  const guardarPlan = async () => {
    if (!pacienteId || odontogramaDesactualizado) {
      setError('El odontograma cambió. Revisa el plan antes de guardarlo.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const revision = new Date().toISOString()
      const ok = await fichasClinicasStorageService.guardarSeccionFicha(pacienteId, 'plan_tratamiento', {
        fases,
        odontogramaActualizadoAt,
        actualizadoAt: revision,
      })
      setPlanGuardado(ok)
      if (ok) {
        planOdontogramaStampRef.current = odontogramaActualizadoAt || null
        setPlanRevision(revision)
        try {
          const sinRevision = fases.some((fase) => fase.id === 'fase-revision' && fase.procedimientos.length > 0)
          if (!sinRevision && itemsPresupuesto.length > 0) {
            const presupuestos = await presupuestosStorageService.sincronizarDesdeSupabase()
            const borradores = presupuestos.filter((p) => p.origenPlan &&
              String(p.pacienteId) === pacienteId && p.sincronizado !== false &&
              ['borrador', 'Borrador'].includes(p.estado || '') && p.planRevision !== revision)
            if (borradores.length > 0 && window.confirm(`El plan cambió. ¿Actualizar ${borradores.length} presupuesto(s) borrador vinculados? Se conservarán los ítems manuales y descuentos; quedarán pendientes de revisión antes de enviarlos.`)) {
              const motivo = solicitarMotivoVersion()
              if (!motivo) return
              for (const presupuesto of borradores) {
                await presupuestoPlanSyncService.actualizarBorrador(
                  presupuesto, pacienteId, revision, itemsPresupuesto as ItemDesdePlan[], motivo)
              }
            }
          }
        } catch {
          setError('El plan se guardó, pero no se pudo sincronizar un borrador. Revísalo en Presupuestos antes de enviarlo.')
        }
      }
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
        origenPlanProcedimientoId: p.id,
        precioPlanOriginal: p.costo || 0,
        faseClinica: f.id.replace('fase-', '') as FaseClinica,
      }))
  ), [fases])

  const handleGenerarPresupuesto = () => {
    if (!pacienteId || !planGuardado || !planRevision || odontogramaDesactualizado || fases.some((fase) => fase.id === 'fase-revision' && fase.procedimientos.length > 0) || itemsPresupuesto.length === 0) {
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
          {planGuardado && <p className="text-xs font-semibold mt-1" data-testid="estado-plan-tratamiento">
            {estadoPlan.completado ? 'Plan completado: tratamientos realizados y saldo pagado' :
              estadoPlan.tratamientosRealizados ? 'Tratamientos realizados · presupuesto o saldo pendiente' :
              estadoPlan.saldoCubierto ? 'Saldo del plan pagado · tratamientos pendientes' :
              'Plan en curso: revisar tratamientos y presupuesto'}
          </p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(rol === 'admin' || rol === 'dentista') && <Button type="button" size="sm" variant="secondary" icon={Stethoscope} onClick={() => setMostrarDerivacion(true)}>
            Ficha Derivación
          </Button>}
          <Button type="button" size="sm" variant="secondary" onClick={guardarPlan} disabled={!pacienteId || guardando} data-testid="btn-guardar-plan">
            {guardando ? 'Guardando…' : planGuardado ? 'Plan guardado' : 'Guardar plan'}
          </Button>
          <Button type="button" size="sm" variant="primary" icon={DollarSign} onClick={handleGenerarPresupuesto} data-testid="btn-generar-presupuesto-plan">
            Generar Presupuesto (${totalPlan.toLocaleString('es-CL')})
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}

      {borradoresDesactualizados.map((presupuesto) => <div key={String(presupuesto.id)} className="p-4 border border-amber-400 rounded-xl text-xs text-amber-900">
        El borrador {presupuesto.folio} v{presupuesto.version || 1} corresponde a una revisión anterior del plan. Actualízalo y confirma la revisión clínica antes de enviarlo.
        <button type="button" className="ml-2 underline font-bold" onClick={async () => {
          if (!planRevision || !planGuardado || odontogramaDesactualizado || itemsPresupuesto.length === 0 ||
            fases.some((fase) => fase.id === 'fase-revision' && fase.procedimientos.length > 0)) {
            setError('Resuelve la revisión clínica del plan antes de actualizar el borrador.')
            return
          }
          try {
            const motivo = solicitarMotivoVersion()
            if (!motivo) return
            await presupuestoPlanSyncService.actualizarBorrador(presupuesto, pacienteId, planRevision, itemsPresupuesto as ItemDesdePlan[], motivo)
            setBorradoresDesactualizados((actuales) => actuales.filter((item) => item.id !== presupuesto.id))
            setError('')
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el borrador.')
          }
        }}>Actualizar borrador</button>
      </div>)}

      {versionables.map((presupuesto) => <div key={String(presupuesto.id)} className="p-4 border border-amber-400 rounded-xl text-xs text-amber-900">
        El plan cambió después del presupuesto {presupuesto.folio} v{presupuesto.version || 1}. Sus importes aprobados o enviados se conservarán.
        <button type="button" className="ml-2 underline font-bold" onClick={async () => {
          if (!planRevision || !planGuardado || !window.confirm(`¿Crear una nueva versión en borrador de ${presupuesto.folio}? Se conservarán los ajustes manuales y descuentos; revisa los importes antes de enviarla.`)) return
          try {
            const motivo = solicitarMotivoVersion()
            if (!motivo) return
            await presupuestoPlanSyncService.crearVersionDesdePlan(presupuesto, pacienteId, planRevision, itemsPresupuesto as ItemDesdePlan[], motivo)
            setVersionables((actuales) => actuales.filter((item) => item.id !== presupuesto.id))
            setError('')
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No se pudo crear la nueva versión.')
          }
        }}>Crear nueva versión</button>
      </div>)}

      {derivaciones.length > 0 && <section aria-label="Derivaciones emitidas" className="p-4 border border-surface rounded-xl text-xs space-y-2">
        <h4 className="font-bold">Derivaciones emitidas</h4>
        {derivaciones.map((derivacion) => <div key={derivacion.id} className="border-t border-surface pt-2">
          <span className="font-semibold">{derivacion.especialidad}</span> · {derivacion.prioridad} · {new Date(derivacion.fecha).toLocaleDateString('es-CL')}
          {derivacion.especialista && <span> · {derivacion.especialista}</span>}
          <p className="mt-1 whitespace-pre-wrap">{derivacion.motivo}</p>
          {derivacion.diagnostico && <p className="mt-1">Diagnóstico: {derivacion.diagnostico}</p>}
          {derivacion.emisor && <p>Emitida por: {derivacion.emisor}</p>}
          {(derivacion.archivoIds?.length || derivacion.incluirOdontograma || derivacion.incluirEvoluciones) &&
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span>Antecedentes de la ficha:</span>
              {(derivacion.archivoIds?.length || 0) > 0 && <button type="button" className="underline"
                onClick={() => abrirPestanaFicha('recetas-consentimientos')}>
                Ver {derivacion.archivoIds?.length} archivo(s)
              </button>}
              {derivacion.incluirOdontograma && <button type="button" className="underline"
                onClick={() => abrirPestanaFicha('odontograma')}>Ver odontograma</button>}
              {derivacion.incluirEvoluciones && <button type="button" className="underline"
                onClick={() => abrirPestanaFicha('evoluciones')}>Ver evoluciones</button>}
            </div>}
          <button type="button" className="mt-1 underline font-semibold" onClick={async () => {
            try {
              const { derivacionPDFService } = await import('./derivacionPDFService')
              await derivacionPDFService.descargar({ pacienteId, pacienteNombre: nombrePaciente,
                pacienteRut, derivacion })
              setError('')
            } catch {
              setError('No se pudo descargar la ficha de derivación. Revisa la clínica y los antecedentes disponibles.')
            }
          }}>Descargar ficha de derivación</button>
        </div>)}
      </section>}

      {odontogramaDesactualizado && (
        <div role="alert" className="p-4 border border-amber-500/50 rounded-xl text-xs text-amber-700">
          El odontograma cambió desde que se guardó este plan. Conservamos las decisiones clínicas anteriores. Revisa los hallazgos antes de continuar.
          <button type="button" className="ml-2 underline font-semibold" onClick={() => {
            if (!window.confirm('¿Reemplazar el plan actual por los hallazgos del odontograma? Se perderán las selecciones clínicas del plan anterior.')) return
            setFases(generarFasesDesdeOdontograma(piezasActuales))
            planOdontogramaStampRef.current = null
            planCargadoRef.current = false
            setPlanGuardado(false)
            setOdontogramaDesactualizado(false)
            setError('')
          }}>Recrear plan desde odontograma</button>
        </div>
      )}

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
                      {estadoPlan.aprobaciones[proc.id] && <span className="text-[10px] font-semibold text-emerald-700">
                        Aprobado en {estadoPlan.aprobaciones[proc.id].folio} v{estadoPlan.aprobaciones[proc.id].version}
                      </span>}
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
                        aria-label={`Estado clínico de ${proc.descripcion}`}
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

      <PresupuestosPaciente pacienteId={pacienteId} />

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
          pacienteId={pacienteId}
          nombrePaciente={nombrePaciente}
          nombreEmisor={emisor?.nombreCompleto || emisor?.email}
          onCerrar={() => setMostrarDerivacion(false)}
          onDerivar={async (input) => {
            const emitida = await derivacionesService.emitir(pacienteId, input)
            setDerivaciones((actuales) => [emitida, ...actuales])
          }}
        />
      )}

      {modalPresupuestoAbierto && (
        <ModalNuevoPresupuesto
          pacienteId={pacienteId}
          pacienteNombre={nombrePaciente}
          pacienteRut={pacienteRut}
          itemsIniciales={itemsPresupuesto}
          planRevision={planRevision}
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
