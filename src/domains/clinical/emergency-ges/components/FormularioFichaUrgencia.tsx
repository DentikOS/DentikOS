import React, { memo, useMemo, useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { PATOLOGIAS_GES_ODONTO } from '../constants/urgenciasGesConstants'
import { PROTOCOLOS_URGENCIA_GES } from '../data/protocolosUrgenciaGes'
import type { ConfiguracionGesClinica, FichaUrgencia, IngresoUrgencia, TriageUrgencia } from '../services/urgenciasGesTypes'
import type { PacienteUrgenciaMinimo } from './FormRegistroUrgencia'

interface FormularioFichaUrgenciaProps {
  ingresos: IngresoUrgencia[]
  triajes: TriageUrgencia[]
  fichas: FichaUrgencia[]
  configuraciones: ConfiguracionGesClinica[]
  pacientes: PacienteUrgenciaMinimo[]
  alCrear: (ingresoId: string, ficha: Pick<FichaUrgencia,
    'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
    | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
    | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado'>) => Promise<void>
}

export const FormularioFichaUrgencia: React.FC<FormularioFichaUrgenciaProps> = memo(({
  ingresos, triajes, fichas, configuraciones, pacientes, alCrear
}) => {
  const pacientesPorId = useMemo(() => new Map(pacientes.map((paciente) => [String(paciente.id), paciente])), [pacientes])
  const elegibles = ingresos.filter((ingreso) =>
    triajes.some((triage) => triage.id === ingreso.id)
    && !fichas.some((ficha) => ficha.id === ingreso.id)
  )
  const [ingresoId, setIngresoId] = useState('')
  const [patologiaId, setPatologiaId] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [protocoloCargado, setProtocoloCargado] = useState<{ patologiaId: string; diagnostico: string; tratamiento: string } | null>(null)
  const [protocoloPendiente, setProtocoloPendiente] = useState<string | null>(null)
  const [cie10, setCie10] = useState('')
  const [piezas, setPiezas] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [derivacion, setDerivacion] = useState(false)
  const [destino, setDestino] = useState('')
  const [motivo, setMotivo] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [control, setControl] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configuracion = configuraciones.find((item) => item.patologia_id === patologiaId)

  const cargarProtocolo = (id: string): void => {
    const protocolo = PROTOCOLOS_URGENCIA_GES.find((item) => item.id === id)
    if (!protocolo) return
    const diagnosticoSugerido = protocolo.pasos[0] || ''
    const tratamientoSugerido = protocolo.pasos.slice(1).join('\n')
    setDiagnostico(diagnosticoSugerido)
    setTratamiento(tratamientoSugerido)
    setProtocoloCargado({ patologiaId: id, diagnostico: diagnosticoSugerido, tratamiento: tratamientoSugerido })
    setProtocoloPendiente(null)
  }

  const handlePatologiaChange = (id: string): void => {
    setPatologiaId(id)
    if (!id || !PROTOCOLOS_URGENCIA_GES.some((item) => item.id === id)) {
      setProtocoloPendiente(null)
      return
    }

    const textoSinCompletar = !diagnostico.trim() && !tratamiento.trim()
    const textoSigueEnBase = protocoloCargado !== null
      && diagnostico === protocoloCargado.diagnostico
      && tratamiento === protocoloCargado.tratamiento
    if (textoSinCompletar || textoSigueEnBase) cargarProtocolo(id)
    else setProtocoloPendiente(id)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!ingresoId || !patologiaId || !diagnostico.trim() || !indicaciones.trim() || guardando) return
    if (derivacion && (!destino.trim() || !motivo.trim())) {
      setError('Completa destino y motivo para registrar la derivación.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await alCrear(ingresoId, {
        patologia_id: patologiaId,
        diagnostico_clinico: diagnostico.trim(),
        diagnostico_cie10: cie10.trim() || null,
        piezas_afectadas: piezas.split(/[;,\n]/).map((pieza) => pieza.trim()).filter(Boolean),
        tratamiento_realizado: tratamiento.split('\n').map((paso) => paso.trim()).filter(Boolean),
        requiere_derivacion: derivacion,
        centro_derivacion: derivacion ? destino.trim() : null,
        motivo_derivacion: derivacion ? motivo.trim() : null,
        indicaciones_post: indicaciones.trim(),
        control_programado: control ? new Date(control).toISOString() : null
      })
      setIngresoId('')
      setPatologiaId('')
      setDiagnostico('')
      setProtocoloCargado(null)
      setProtocoloPendiente(null)
      setCie10('')
      setPiezas('')
      setTratamiento('')
      setDerivacion(false)
      setDestino('')
      setMotivo('')
      setIndicaciones('')
      setControl('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la ficha')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-surface bg-surface p-5 shadow-xs">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-50">
          <FilePlus2 size={17} aria-hidden="true" /> Ficha clínica de urgencia
        </h2>
        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
          El registro se vincula al paciente y a la clínica activa. La hora, folio y responsable los confirma el servidor.
        </p>
      </div>

      <label className="mb-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Llegada con triage
        <select required value={ingresoId} onChange={(event) => setIngresoId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900">
          <option value="">Selecciona una llegada</option>
          {elegibles.map((ingreso) => {
            const paciente = pacientesPorId.get(ingreso.paciente_id)
            return <option key={ingreso.id} value={ingreso.id}>{paciente?.nombre || 'Paciente'} · {paciente?.rut || ingreso.paciente_id.slice(0, 8)}</option>
          })}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          Patología GES
          <select required value={patologiaId} onChange={(event) => handlePatologiaChange(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900">
            <option value="">Selecciona una patología</option>
            {PATOLOGIAS_GES_ODONTO.map((patologia) => <option key={patologia.id} value={patologia.id}>{patologia.numero}. {patologia.nombre}</option>)}
          </select>
        </label>
        <div className="rounded-lg border border-surface p-3 text-xs text-graphite-600 dark:text-graphite-300">
          {configuracion?.codigo_fonasa
            ? <>Código configurado: <strong>{configuracion.codigo_fonasa}</strong>{configuracion.arancel_pactado !== null ? ` · Arancel pactado: ${configuracion.arancel_pactado}` : ''}</>
            : 'Código FONASA / convenio no configurado para esta patología. No se asigna un valor de ejemplo.'}
        </div>
      </div>

      <p className="mt-2 text-xs text-graphite-500 dark:text-graphite-400">
        Al elegir una patología se carga su protocolo en diagnóstico y tratamiento. Revisa y elimina las acciones no realizadas antes de guardar; las indicaciones al paciente se completan aparte.
      </p>
      {protocoloPendiente && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-graphite-700 dark:text-graphite-200">
        <span>Hay texto editado. ¿Quieres reemplazarlo por el protocolo de {PROTOCOLOS_URGENCIA_GES.find((item) => item.id === protocoloPendiente)?.titulo}?</span>
        <Button type="button" variant="secondary" onClick={() => cargarProtocolo(protocoloPendiente)}>Cargar protocolo</Button>
      </div>}

      <label className="mt-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Diagnóstico clínico
        <textarea required maxLength={5000} value={diagnostico} onChange={(event) => setDiagnostico(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" />
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          CIE-10 (opcional)
          <input value={cie10} onChange={(event) => setCie10(event.target.value)} maxLength={20} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" />
        </label>
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          Piezas afectadas (separadas por coma)
          <input value={piezas} onChange={(event) => setPiezas(event.target.value)} maxLength={300} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" />
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Tratamiento realizado (una entrada por línea)
        <textarea value={tratamiento} onChange={(event) => setTratamiento(event.target.value)} maxLength={8000} rows={3} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" />
      </label>
      <p className="mt-2 text-xs text-graphite-500 dark:text-graphite-400">
        Las recetas se registran en la ficha del paciente; esta ficha no emite prescripciones.
      </p>

      <label className="mt-3 flex items-start gap-2 text-xs font-medium text-graphite-700 dark:text-graphite-200">
        <input type="checkbox" checked={derivacion} onChange={(event) => setDerivacion(event.target.checked)} className="mt-0.5" />
        Registrar derivación realizada
      </label>
      {derivacion && <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          Destino
          <input required value={destino} onChange={(event) => setDestino(event.target.value)} maxLength={300} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" />
        </label>
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          Motivo
          <input required value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={2000} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" />
        </label>
      </div>}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          Indicaciones registradas para el paciente
          <textarea required value={indicaciones} onChange={(event) => setIndicaciones(event.target.value)} maxLength={5000} rows={2} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" />
        </label>
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          Control programado (opcional)
          <input type="datetime-local" value={control} onChange={(event) => setControl(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-red-700 dark:text-red-300">{error}</p>
        <Button type="submit" variant="primary" loading={guardando} disabled={!ingresoId || !patologiaId || !diagnostico.trim() || !indicaciones.trim() || guardando} icon={FilePlus2}>
          Guardar ficha
        </Button>
      </div>
    </form>
  )
})

FormularioFichaUrgencia.displayName = 'FormularioFichaUrgencia'
