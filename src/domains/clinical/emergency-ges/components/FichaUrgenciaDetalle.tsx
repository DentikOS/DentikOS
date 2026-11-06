import React, { memo, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FilePenLine, Printer, Save } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { PATOLOGIAS_GES_ODONTO } from '../constants/urgenciasGesConstants'
import type { EstadoUrgencia, EventoUrgencia, FichaUrgencia, IngresoUrgencia, TriageUrgencia } from '../services/urgenciasGesTypes'
import type { PacienteUrgenciaMinimo } from './FormRegistroUrgencia'

type CamposEditables = Pick<FichaUrgencia,
  'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
  | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
  | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado'>

interface FichaUrgenciaDetalleProps {
  ficha: FichaUrgencia
  ingreso: IngresoUrgencia
  triage?: TriageUrgencia
  paciente?: PacienteUrgenciaMinimo
  eventos: EventoUrgencia[]
  alGuardarCambios: (ficha: FichaUrgencia, cambios: Partial<CamposEditables>) => Promise<void>
  alCambiarEstado: (ficha: FichaUrgencia, estado: Extract<EstadoUrgencia, 'cerrada' | 'rechazada' | 'derivada'>) => Promise<void>
  alAgregarEnmienda: (ingresoId: string, motivo: string, detalle: Record<string, unknown>) => Promise<void>
}

const fmtFecha = (value: string | null | undefined): string => value
  ? new Date(value).toLocaleString('es-CL')
  : 'No registrado'

export const FichaUrgenciaDetalle: React.FC<FichaUrgenciaDetalleProps> = memo(({
  ficha, ingreso, triage, paciente, eventos, alGuardarCambios, alCambiarEstado, alAgregarEnmienda
}) => {
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notaEnmienda, setNotaEnmienda] = useState('')
  const [motivoEnmienda, setMotivoEnmienda] = useState('')
  const [enviandoEnmienda, setEnviandoEnmienda] = useState(false)
  const [estadoFinal, setEstadoFinal] = useState<Extract<EstadoUrgencia, 'cerrada' | 'rechazada' | 'derivada'>>('cerrada')
  const [guardandoEstado, setGuardandoEstado] = useState(false)
  const [patologiaId, setPatologiaId] = useState(ficha.patologia_id)
  const [diagnostico, setDiagnostico] = useState(ficha.diagnostico_clinico)
  const [cie10, setCie10] = useState(ficha.diagnostico_cie10 || '')
  const [piezas, setPiezas] = useState(ficha.piezas_afectadas.join(', '))
  const [tratamiento, setTratamiento] = useState(ficha.tratamiento_realizado.map((item) => String(item)).join('\n'))
  const [derivacion, setDerivacion] = useState(ficha.requiere_derivacion)
  const [destino, setDestino] = useState(ficha.centro_derivacion || '')
  const [motivo, setMotivo] = useState(ficha.motivo_derivacion || '')
  const [indicaciones, setIndicaciones] = useState(ficha.indicaciones_post || '')
  const [control, setControl] = useState(ficha.control_programado ? ficha.control_programado.slice(0, 16) : '')
  const [fechaEdicion, setFechaEdicion] = useState(ficha.updated_at)

  useEffect(() => {
    setPatologiaId(ficha.patologia_id)
    setDiagnostico(ficha.diagnostico_clinico)
    setCie10(ficha.diagnostico_cie10 || '')
    setPiezas(ficha.piezas_afectadas.join(', '))
    setTratamiento(ficha.tratamiento_realizado.map((item) => String(item)).join('\n'))
    setDerivacion(ficha.requiere_derivacion)
    setDestino(ficha.centro_derivacion || '')
    setMotivo(ficha.motivo_derivacion || '')
    setIndicaciones(ficha.indicaciones_post || '')
    setControl(ficha.control_programado ? ficha.control_programado.slice(0, 16) : '')
    setFechaEdicion(ficha.updated_at)
    setEditando(false)
    setError(null)
  }, [ficha])

  const eventosFicha = useMemo(() => eventos.filter((evento) => evento.ingreso_id === ficha.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)), [eventos, ficha.id])
  const patologia = PATOLOGIAS_GES_ODONTO.find((item) => item.id === ficha.patologia_id)
  const cerrada = ficha.estado !== 'en_atencion'
  const pendiente = ficha.estado_sincronizacion === 'pendiente'

  const handleGuardar = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (guardando || !diagnostico.trim() || !indicaciones.trim()) return
    if (derivacion && (!destino.trim() || !motivo.trim())) {
      setError('Completa destino y motivo para registrar la derivación.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await alGuardarCambios(ficha, {
        patologia_id: patologiaId,
        diagnostico_clinico: diagnostico.trim(),
        diagnostico_cie10: cie10.trim() || null,
        piezas_afectadas: piezas.split(/[;,\n]/).map((value) => value.trim()).filter(Boolean),
        tratamiento_realizado: tratamiento.split('\n').map((value) => value.trim()).filter(Boolean),
        requiere_derivacion: derivacion,
        centro_derivacion: derivacion ? destino.trim() : null,
        motivo_derivacion: derivacion ? motivo.trim() : null,
        indicaciones_post: indicaciones.trim(),
        control_programado: control ? new Date(control).toISOString() : null
      })
      setEditando(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la ficha')
    } finally {
      setGuardando(false)
    }
  }

  const handleEstado = async (): Promise<void> => {
    if (guardandoEstado || pendiente) return
    setGuardandoEstado(true)
    setError(null)
    try {
      await alCambiarEstado(ficha, estadoFinal)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado')
    } finally {
      setGuardandoEstado(false)
    }
  }

  const handleEnmienda = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (enviandoEnmienda || motivoEnmienda.trim().length < 10 || !notaEnmienda.trim()) return
    setEnviandoEnmienda(true)
    setError(null)
    try {
      await alAgregarEnmienda(ficha.id, motivoEnmienda.trim(), { correccion_registrada: notaEnmienda.trim() })
      setMotivoEnmienda('')
      setNotaEnmienda('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo agregar la enmienda')
    } finally {
      setEnviandoEnmienda(false)
    }
  }

  const fieldsDisabled = guardando || pendiente

  return (
    <section className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface bg-surface p-4">
        <div>
          <h2 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Registro clínico de urgencia · {ficha.folio}</h2>
          <p className="text-xs text-graphite-500 dark:text-graphite-400">{patientName(paciente, ingreso.paciente_id)} · Estado: {ficha.estado.replace('_', ' ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!cerrada && <Button type="button" variant="secondary" icon={FilePenLine} disabled={pendiente || guardando} onClick={() => setEditando((value) => !value)}>{editando ? 'Cancelar edición' : 'Editar ficha'}</Button>}
          <Button type="button" variant="secondary" icon={Printer} disabled={pendiente} onClick={() => window.print()}>Imprimir registro</Button>
        </div>
      </div>
      {pendiente && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 print:hidden">Registro pendiente: todavía no está confirmado en el servidor. No se puede cerrar ni imprimir hasta sincronizar.</p>}

      <article className="urgencia-print-card space-y-5 rounded-2xl border border-surface bg-white p-6 text-sm text-graphite-900 shadow-xs print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-graphite-300 pb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-graphite-600">Copia del registro clínico de urgencia</p>
          <h1 className="mt-1 text-xl font-bold">{patologia?.nombre || 'Patología GES registrada'}</h1>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <p>Folio: <strong>{ficha.folio}</strong></p>
            <p>Estado: <strong>{ficha.estado.replace('_', ' ')}</strong></p>
            <p>Llegada: {fmtFecha(ingreso.created_at)}</p>
            <p>Atención: {fmtFecha(ficha.fecha_hora_atencion)}</p>
            <p>Fin registrado: {fmtFecha(ficha.fecha_hora_fin)}</p>
            <p>Responsable: {ficha.profesional_id}</p>
          </div>
          {pendiente && <p className="mt-2 font-bold text-amber-800">Pendiente de confirmación del servidor.</p>}
        </header>

        <section>
          <h3 className="font-bold">Paciente</h3>
          <p>{patientName(paciente, ingreso.paciente_id)}{paciente?.rut ? ` · RUT ${paciente.rut}` : ''}</p>
        </section>

        <section>
          <h3 className="font-bold">Triage registrado</h3>
          {triage ? <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
            <p>Severidad anotada: {triage.severidad}</p>
            <p>Presión arterial: {triage.presion_sistolica ?? '—'} / {triage.presion_diastolica ?? '—'}</p>
            <p>Frecuencia cardíaca: {triage.frecuencia_cardiaca ?? '—'}</p>
            <p>Saturación: {triage.saturacion_oxigeno ?? '—'}%</p>
            <p>Temperatura: {triage.temperatura_c ?? '—'} °C</p>
            <p>EVA: {triage.eva ?? '—'}</p>
            {triage.nota_triage && <p className="sm:col-span-2">Nota: {triage.nota_triage}</p>}
          </div> : <p className="text-xs">Sin triage sincronizado.</p>}
        </section>

        <section className="space-y-2">
          <h3 className="font-bold">Diagnóstico y atención registrada</h3>
          <p><strong>Diagnóstico:</strong> {ficha.diagnostico_clinico}</p>
          {ficha.diagnostico_cie10 && <p><strong>CIE-10:</strong> {ficha.diagnostico_cie10}</p>}
          {ficha.piezas_afectadas.length > 0 && <p><strong>Piezas:</strong> {ficha.piezas_afectadas.join(', ')}</p>}
          <div><strong>Tratamiento registrado:</strong><ul className="list-disc pl-5">{ficha.tratamiento_realizado.length ? ficha.tratamiento_realizado.map((item, index) => <li key={index}>{String(item)}</li>) : <li>No informado</li>}</ul></div>
          <p><strong>Indicaciones registradas:</strong> {ficha.indicaciones_post || 'No informado'}</p>
          {ficha.control_programado && <p><strong>Control programado:</strong> {fmtFecha(ficha.control_programado)}</p>}
        </section>

        {ficha.requiere_derivacion && <section>
          <h3 className="font-bold">Derivación registrada</h3>
          <p>Destino: {ficha.centro_derivacion || 'No informado'}</p>
          <p>Motivo: {ficha.motivo_derivacion || 'No informado'}</p>
        </section>}

        <p className="border-t border-graphite-200 pt-3 text-[11px] text-graphite-600">
          Este documento reproduce datos registrados en DentikOS. No es el formulario oficial de notificación GES ni una firma electrónica.
        </p>
      </article>

      {editando && !cerrada && <form onSubmit={handleGuardar} className="print:hidden space-y-3 rounded-2xl border border-surface bg-surface p-5">
        <h3 className="text-sm font-bold">Editar ficha abierta</h3>
        <label className="block text-xs font-medium">Patología<select value={patologiaId} onChange={(event) => setPatologiaId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900">{PATOLOGIAS_GES_ODONTO.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="block text-xs font-medium">Diagnóstico<textarea required maxLength={5000} value={diagnostico} onChange={(event) => setDiagnostico(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium">CIE-10<input maxLength={20} value={cie10} onChange={(event) => setCie10(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" /></label>
          <label className="block text-xs font-medium">Piezas afectadas<input maxLength={300} value={piezas} onChange={(event) => setPiezas(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" /></label>
        </div>
        <label className="block text-xs font-medium">Tratamiento realizado (una entrada por línea)<textarea maxLength={8000} value={tratamiento} onChange={(event) => setTratamiento(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" /></label>
        <label className="block text-xs font-medium">Indicaciones registradas<textarea required maxLength={5000} value={indicaciones} onChange={(event) => setIndicaciones(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" /></label>
        <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={derivacion} onChange={(event) => setDerivacion(event.target.checked)} />Derivación realizada</label>
        {derivacion && <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-medium">Destino<input required maxLength={300} value={destino} onChange={(event) => setDestino(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" /></label><label className="block text-xs font-medium">Motivo<input required maxLength={2000} value={motivo} onChange={(event) => setMotivo(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" /></label></div>}
        <label className="block text-xs font-medium">Control programado<input type="datetime-local" value={control} onChange={(event) => setControl(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" /></label>
        <p aria-live="polite" className="text-xs text-red-700">{error}</p>
        <Button type="submit" variant="primary" icon={Save} loading={guardando} disabled={fieldsDisabled || !diagnostico.trim() || !indicaciones.trim()}>Guardar cambios clínicos</Button>
      </form>}

      {!cerrada && <div className="print:hidden rounded-2xl border border-surface bg-surface p-5">
        <h3 className="text-sm font-bold">Finalizar registro</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs font-medium">Estado<select value={estadoFinal} onChange={(event) => setEstadoFinal(event.target.value as typeof estadoFinal)} className="mt-1 min-h-10 rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900"><option value="cerrada">Atención cerrada</option><option value="rechazada">Atención rechazada</option><option value="derivada">Derivación registrada</option></select></label>
          <Button type="button" variant="primary" icon={CheckCircle2} loading={guardandoEstado} disabled={pendiente || guardandoEstado} onClick={() => void handleEstado()}>Confirmar estado</Button>
        </div>
      </div>}

      {cerrada && <form onSubmit={handleEnmienda} className="print:hidden space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/20">
        <h3 className="text-sm font-bold">Enmienda de ficha finalizada</h3>
        <p className="text-xs">La ficha cerrada no se modifica. Registra la aclaración como evento nuevo con motivo y autoría del servidor.</p>
        <label className="block text-xs font-medium">Motivo (mínimo 10 caracteres)<input required minLength={10} maxLength={2000} value={motivoEnmienda} onChange={(event) => setMotivoEnmienda(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" /></label>
        <label className="block text-xs font-medium">Aclaración registrada<textarea required maxLength={5000} value={notaEnmienda} onChange={(event) => setNotaEnmienda(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" /></label>
        <Button type="submit" variant="secondary" loading={enviandoEnmienda} disabled={enviandoEnmienda || motivoEnmienda.trim().length < 10 || !notaEnmienda.trim()} icon={FilePenLine}>Agregar enmienda</Button>
      </form>}

      <section className="print:hidden rounded-2xl border border-surface bg-surface p-5">
        <h3 className="text-sm font-bold">Trazabilidad</h3>
        <p className="mb-3 text-xs text-graphite-500">Última actualización del registro: {fmtFecha(fechaEdicion)}</p>
        <ul className="space-y-2 text-xs">{eventosFicha.map((evento) => <li key={evento.id} className="border-l-2 border-primary/30 pl-3"><strong>{evento.evento_tipo.replaceAll('_', ' ')}</strong> · {fmtFecha(evento.created_at)} · Usuario {evento.actor_user_id}{evento.estado_sincronizacion === 'pendiente' && <span className="font-semibold text-amber-800"> · Pendiente de sincronización</span>}</li>)}{!eventosFicha.length && <li>No hay eventos de auditoría disponibles.</li>}</ul>
      </section>
      {error && <p role="alert" className="print:hidden text-xs text-red-700 dark:text-red-300">{error}</p>}
    </section>
  )
})

const patientName = (paciente: PacienteUrgenciaMinimo | undefined, fallbackId: string): string =>
  paciente?.nombre || `Paciente ${fallbackId.slice(0, 8)}`

FichaUrgenciaDetalle.displayName = 'FichaUrgenciaDetalle'
