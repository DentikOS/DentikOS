import React, { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, RefreshCw, ShieldAlert } from 'lucide-react'
import type { OrdenLaboratorio } from '../constants/laboratorioConstants'
import {
  ETIQUETAS_DOCUMENTO_LABORATORIO,
  laboratorioTraceabilityService,
  type ArchivoLaboratorio,
  type GarantiaLaboratorio,
  type HistorialGarantiaLaboratorio,
} from '../services/laboratorioTraceabilityService'

export interface GarantiasLaboratorioPanelProps {
  orden: OrdenLaboratorio
  puedeCrearReclamo: boolean
  puedeAprobar: boolean
  onCambio?: () => void | Promise<void>
}

const EVENTO_LABEL: Record<string, string> = {
  reclamo_creado: 'Reclamo registrado',
  reclamo_rechazado: 'Reclamo rechazado',
  reposicion_aprobada: 'Reposición aprobada',
  reposicion_creada: 'Orden de reposición creada',
}

const RESPONSABILIDADES = [
  { value: 'laboratorio', label: 'Laboratorio asume el costo' },
  { value: 'clinica', label: 'Clínica asume el costo' },
  { value: 'compartida', label: 'Costo compartido' },
  { value: 'sin_garantia', label: 'Sin garantía; paciente paga un nuevo trabajo' },
] as const

export const GarantiasLaboratorioPanel: React.FC<GarantiasLaboratorioPanelProps> = ({
  orden,
  puedeCrearReclamo,
  puedeAprobar,
  onCambio,
}) => {
  const [garantias, setGarantias] = useState<GarantiaLaboratorio[]>([])
  const [evidencias, setEvidencias] = useState<ArchivoLaboratorio[]>([])
  const [historial, setHistorial] = useState<Record<string, HistorialGarantiaLaboratorio[]>>({})
  const [motivo, setMotivo] = useState('')
  const [evidenciaId, setEvidenciaId] = useState('')
  const [responsabilidad, setResponsabilidad] = useState<'laboratorio' | 'clinica' | 'compartida' | 'sin_garantia'>('laboratorio')
  const [porcentaje, setPorcentaje] = useState(50)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async (): Promise<void> => {
    if (typeof orden.id !== 'string') {
      setGarantias([])
      setEvidencias([])
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const [reclamos, archivos] = await Promise.all([
        laboratorioTraceabilityService.listarGarantiasOrden(orden.id),
        laboratorioTraceabilityService.listarDocumentos(orden.id),
      ])
      setGarantias(reclamos)
      setEvidencias(archivos.filter(item => ['evidencia_garantia', 'foto_diseno', 'otro'].includes(item.metadata?.tipo_documento || '')))
      const historiales = await Promise.all(reclamos.map(async item => [
        item.id,
        await laboratorioTraceabilityService.listarHistorialGarantia(item.id),
      ] as const))
      setHistorial(Object.fromEntries(historiales))
    } catch {
      setError('No se pudieron sincronizar las garantías de esta orden.')
    } finally {
      setCargando(false)
    }
  }, [orden.id])

  useEffect(() => { void recargar() }, [recargar])

  const crearReclamo = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (typeof orden.id !== 'string' || !evidenciaId || !motivo.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await laboratorioTraceabilityService.crearReclamo({
        ordenOriginalId: orden.id,
        motivo: motivo.trim(),
        archivoEvidenciaId: evidenciaId,
      })
      setMotivo('')
      await recargar()
      await onCambio?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar el reclamo.')
    } finally {
      setGuardando(false)
    }
  }

  const resolver = async (garantia: GarantiaLaboratorio, decision: 'aprobar' | 'rechazar'): Promise<void> => {
    if (decision === 'rechazar' && !motivoRechazo.trim()) {
      setError('Escribe el motivo del rechazo para continuar.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await laboratorioTraceabilityService.resolverGarantia({
        garantiaId: garantia.id,
        decision,
        tipoResponsabilidad: decision === 'aprobar' ? responsabilidad : null,
        porcentajeCostoClinica: decision === 'aprobar' && responsabilidad === 'compartida' ? porcentaje : null,
        motivoRechazo: decision === 'rechazar' ? motivoRechazo.trim() : null,
      })
      setMotivoRechazo('')
      await recargar()
      await onCambio?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo resolver la garantía.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="rounded-2xl border border-surface bg-surface p-4 space-y-4" aria-label={`Garantías de ${orden.codigoOrden}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2"><ShieldAlert size={16} />Garantía y reproceso</h3>
          <p className="mt-1 text-xs text-muted-foreground">Cada reposición se registra como una nueva orden; la original conserva su entrega e historial.</p>
        </div>
        <button type="button" onClick={() => void recargar()} disabled={cargando} className="rounded-lg border border-surface p-2 disabled:opacity-50" aria-label="Actualizar garantías">
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {puedeCrearReclamo && orden.etapa === 'entrega' && !orden.solicitudLimitada && (
        <form onSubmit={(event) => void crearReclamo(event)} className="rounded-xl border border-surface p-3 space-y-3">
          <h4 className="text-xs font-semibold">Registrar reclamo desde la orden entregada</h4>
          <label className="block space-y-1 text-xs font-medium">
            <span>Motivo *</span>
            <textarea required maxLength={2000} value={motivo} onChange={event => setMotivo(event.target.value)} rows={3} className="w-full rounded-lg border border-surface bg-background p-2.5" placeholder="Describe el problema observado" />
          </label>
          <label className="block space-y-1 text-xs font-medium">
            <span>Foto o evidencia vinculada a esta orden *</span>
            <select required value={evidenciaId} onChange={event => setEvidenciaId(event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              <option value="">Selecciona un documento</option>
              {evidencias.map(item => <option key={item.id} value={item.id}>{item.nombre_archivo} · {ETIQUETAS_DOCUMENTO_LABORATORIO[item.metadata?.tipo_documento || 'otro']}</option>)}
            </select>
            {evidencias.length === 0 && <span className="block text-[11px] text-muted-foreground">Sube primero una foto con tipo “Evidencia de garantía” en los documentos de esta orden.</span>}
          </label>
          <button type="submit" disabled={guardando || evidencias.length === 0} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {guardando ? 'Registrando…' : 'Crear reclamo'}
          </button>
        </form>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
      {cargando ? <p role="status" className="text-xs text-muted-foreground">Cargando garantías…</p> : garantias.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface p-5 text-center text-xs text-muted-foreground">No hay reclamos de garantía vinculados a esta orden.</p>
      ) : (
        <div className="space-y-3">
          {garantias.map(garantia => (
            <article key={garantia.id} className="rounded-xl border border-surface p-3 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="inline-flex items-center gap-1 text-xs font-semibold capitalize"><BadgeCheck size={14} />{garantia.estado}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{garantia.orden_original_folio || orden.codigoOrden} · {new Date(garantia.created_at).toLocaleDateString('es-CL')}</p>
                </div>
                {garantia.orden_reposicion_folio && <p className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Reposición {garantia.orden_reposicion_folio}</p>}
              </div>
              <p className="text-xs">{garantia.motivo}</p>
              {garantia.tipo_responsabilidad && <p className="text-[11px] text-muted-foreground">
                Responsabilidad: {RESPONSABILIDADES.find(item => item.value === garantia.tipo_responsabilidad)?.label || garantia.tipo_responsabilidad}
                {garantia.porcentaje_costo_clinica !== null ? ` · Clínica ${garantia.porcentaje_costo_clinica}%` : ''}
              </p>}
              {garantia.resolucion_motivo && <p className="text-[11px] text-rose-700">Resolución: {garantia.resolucion_motivo}</p>}

              {puedeAprobar && garantia.estado === 'reclamo' && (
                <div className="grid grid-cols-1 gap-2 border-t border-surface pt-3 md:grid-cols-[minmax(0,1fr)_7rem_auto_auto] md:items-end">
                  <label className="space-y-1 text-[11px] font-medium">
                    <span>Responsabilidad</span>
                    <select value={responsabilidad} onChange={event => setResponsabilidad(event.target.value as typeof responsabilidad)} className="w-full min-h-9 rounded-lg border border-surface bg-background px-2.5">
                      {RESPONSABILIDADES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  {responsabilidad === 'compartida' ? (
                    <label className="space-y-1 text-[11px] font-medium">
                      <span>% clínica</span>
                      <input type="number" min={0} max={100} step={1} value={porcentaje} onChange={event => setPorcentaje(Number(event.target.value))} className="w-full min-h-9 rounded-lg border border-surface bg-background px-2.5" />
                    </label>
                  ) : <span />}
                  <button type="button" disabled={guardando} onClick={() => void resolver(garantia, 'aprobar')} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50">Aprobar y crear reposición</button>
                  <button type="button" disabled={guardando} onClick={() => void resolver(garantia, 'rechazar')} className="min-h-9 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-800 disabled:opacity-50">Rechazar</button>
                  <label className="space-y-1 text-[11px] font-medium md:col-span-4">
                    <span>Motivo de rechazo</span>
                    <input value={motivoRechazo} onChange={event => setMotivoRechazo(event.target.value)} maxLength={2000} className="w-full min-h-9 rounded-lg border border-surface bg-background px-2.5" />
                  </label>
                </div>
              )}
              {(historial[garantia.id] || []).length > 0 && (
                <ol className="border-t border-surface pt-2 space-y-1">
                  {historial[garantia.id].map(evento => (
                    <li key={evento.id} className="flex flex-wrap justify-between gap-2 text-[10px] text-muted-foreground">
                      <span>{EVENTO_LABEL[evento.evento] || evento.evento}</span>
                      <time>{new Date(evento.registrado_en).toLocaleString('es-CL')}</time>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
