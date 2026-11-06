import React, { memo, useMemo, useState } from 'react'
import { ClipboardPlus } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { CATEGORIAS_TRIAGE_URGENCIA, PATOLOGIAS_GES_ODONTO } from '../constants/urgenciasGesConstants'
import type { IngresoUrgencia, TriageUrgencia } from '../services/urgenciasGesTypes'
import type { PacienteUrgenciaMinimo } from './FormRegistroUrgencia'

interface FormularioTriageUrgenciaProps {
  ingresos: IngresoUrgencia[]
  triajes: TriageUrgencia[]
  pacientes: PacienteUrgenciaMinimo[]
  alGuardar: (ingresoId: string, triage: Omit<TriageUrgencia, 'id' | 'clinica_id' | 'version' | 'created_at' | 'updated_at'>) => Promise<void>
}

const numeroOausente = (value: string): number | null => value.trim() === '' ? null : Number(value)

const CampoNumero: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  step?: number
}> = ({ label, value, onChange, min, max, step = 1 }) => (
  <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
    {label}
    <input
      type="number" inputMode="decimal" min={min} max={max} step={step} value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900"
    />
  </label>
)

export const FormularioTriageUrgencia: React.FC<FormularioTriageUrgenciaProps> = memo(({ ingresos, triajes, pacientes, alGuardar }) => {
  const pacientesPorId = useMemo(() => new Map(pacientes.map((paciente) => [String(paciente.id), paciente])), [pacientes])
  const disponibles = ingresos.filter((ingreso) =>
    ['en_espera', 'en_atencion'].includes(ingreso.estado_cola)
    && !triajes.some((triage) => triage.id === ingreso.id)
  )
  const [ingresoId, setIngresoId] = useState('')
  const [severidad, setSeveridad] = useState<TriageUrgencia['severidad'] | ''>('')
  const [sistolica, setSistolica] = useState('')
  const [diastolica, setDiastolica] = useState('')
  const [frecuencia, setFrecuencia] = useState('')
  const [saturacion, setSaturacion] = useState('')
  const [temperatura, setTemperatura] = useState('')
  const [eva, setEva] = useState('')
  const [patologiaSospechadaId, setPatologiaSospechadaId] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!ingresoId || !severidad || guardando) return
    setGuardando(true)
    setError(null)
    try {
      await alGuardar(ingresoId, {
        severidad,
        presion_sistolica: numeroOausente(sistolica),
        presion_diastolica: numeroOausente(diastolica),
        frecuencia_cardiaca: numeroOausente(frecuencia),
        saturacion_oxigeno: numeroOausente(saturacion),
        temperatura_c: numeroOausente(temperatura),
        eva: numeroOausente(eva),
        patologia_sospechada_id: patologiaSospechadaId || null,
        nota_triage: nota.trim() || null
      })
      setIngresoId('')
      setSeveridad('')
      setSistolica('')
      setDiastolica('')
      setFrecuencia('')
      setSaturacion('')
      setTemperatura('')
      setEva('')
      setPatologiaSospechadaId('')
      setNota('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el triage')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-surface bg-surface p-5 shadow-xs">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-50">
          <ClipboardPlus size={17} aria-hidden="true" /> Triage inicial
        </h2>
        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">La severidad y los signos se registran manualmente; no se calculan prioridades ni alertas.</p>
      </div>

      <label className="mb-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Llegada en espera
        <select required value={ingresoId} onChange={(event) => setIngresoId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900">
          <option value="">Selecciona una llegada</option>
          {disponibles.map((ingreso) => {
            const paciente = pacientesPorId.get(ingreso.paciente_id)
            return <option key={ingreso.id} value={ingreso.id}>{paciente?.nombre || 'Paciente'} · {paciente?.rut || ingreso.paciente_id.slice(0, 8)}</option>
          })}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
          Severidad registrada
          <select required value={severidad} onChange={(event) => setSeveridad(event.target.value as TriageUrgencia['severidad'] | '')} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900">
            <option value="">Selecciona</option>
            {CATEGORIAS_TRIAGE_URGENCIA.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
          </select>
        </label>
        <CampoNumero label="Presión sistólica" value={sistolica} onChange={setSistolica} min={1} />
        <CampoNumero label="Presión diastólica" value={diastolica} onChange={setDiastolica} min={1} />
        <CampoNumero label="Frecuencia cardíaca" value={frecuencia} onChange={setFrecuencia} min={1} />
        <CampoNumero label="Saturación O₂ (%)" value={saturacion} onChange={setSaturacion} min={0} max={100} step={0.1} />
        <CampoNumero label="Temperatura (°C)" value={temperatura} onChange={setTemperatura} min={1} max={60} step={0.1} />
        <CampoNumero label="EVA (0–10)" value={eva} onChange={setEva} min={0} max={10} />
      </div>
      <label className="mt-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Patología sospechada (opcional)
        <select value={patologiaSospechadaId} onChange={(event) => setPatologiaSospechadaId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900">
          <option value="">Sin especificar</option>
          {PATOLOGIAS_GES_ODONTO.map((patologia) => <option key={patologia.id} value={patologia.id}>{patologia.numero}. {patologia.nombre}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Nota de triage
        <textarea value={nota} onChange={(event) => setNota(event.target.value)} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-surface bg-white px-3 py-2 text-sm dark:bg-graphite-900" />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-red-700 dark:text-red-300">{error}</p>
        <Button type="submit" variant="primary" loading={guardando} disabled={!ingresoId || !severidad || guardando} icon={ClipboardPlus}>
          Guardar triage
        </Button>
      </div>
    </form>
  )
})

FormularioTriageUrgencia.displayName = 'FormularioTriageUrgencia'
