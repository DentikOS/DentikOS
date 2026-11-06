import React, { memo, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { PATOLOGIAS_GES_ODONTO } from '../constants/urgenciasGesConstants'
import type { ConfiguracionGesClinica } from '../services/urgenciasGesTypes'

interface ConfiguracionGesClinicaPanelProps {
  configuraciones: ConfiguracionGesClinica[]
  alGuardar: (
    patologiaId: string,
    input: Pick<ConfiguracionGesClinica, 'codigo_fonasa' | 'descripcion_convenio' | 'arancel_pactado' | 'centro_costos' | 'previsiones_convenio'>,
    version: number | null
  ) => Promise<void>
}

export const ConfiguracionGesClinicaPanel: React.FC<ConfiguracionGesClinicaPanelProps> = memo(({ configuraciones, alGuardar }) => {
  const [patologiaId, setPatologiaId] = useState(PATOLOGIAS_GES_ODONTO[0]?.id || '')
  const configuracion = configuraciones.find((item) => item.patologia_id === patologiaId)
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [arancel, setArancel] = useState('')
  const [centroCostos, setCentroCostos] = useState('')
  const [previsiones, setPrevisiones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    setCodigo(configuracion?.codigo_fonasa || '')
    setDescripcion(configuracion?.descripcion_convenio || '')
    setArancel(configuracion?.arancel_pactado === null || configuracion?.arancel_pactado === undefined ? '' : String(configuracion.arancel_pactado))
    setCentroCostos(configuracion?.centro_costos || '')
    setPrevisiones(configuracion?.previsiones_convenio.join(', ') || '')
    setError(null)
    setGuardado(false)
  }, [patologiaId, configuracion])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!patologiaId || guardando) return
    const valorArancel = arancel.trim() ? Number(arancel) : null
    if (valorArancel !== null && (!Number.isFinite(valorArancel) || valorArancel < 0)) {
      setError('El arancel debe ser un valor numérico igual o mayor a cero.')
      return
    }
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      await alGuardar(patologiaId, {
        codigo_fonasa: codigo.trim() || null,
        descripcion_convenio: descripcion.trim() || null,
        arancel_pactado: valorArancel,
        centro_costos: centroCostos.trim() || null,
        previsiones_convenio: previsiones.split(',').map((value) => value.trim()).filter(Boolean)
      }, configuracion?.version ?? null)
      setGuardado(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-surface bg-surface p-5 shadow-xs">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Configuración GES de la clínica</h2>
        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
          Ingresa solo códigos, aranceles y convenios confirmados por la clínica. Los campos vacíos no se completan con valores de ejemplo.
        </p>
      </div>
      <label className="mb-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Patología
        <select value={patologiaId} onChange={(event) => setPatologiaId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900">
          {PATOLOGIAS_GES_ODONTO.map((item) => <option key={item.id} value={item.id}>{item.numero}. {item.nombre}</option>)}
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo label="Código FONASA confirmado" value={codigo} onChange={setCodigo} maxLength={80} />
        <Campo label="Descripción de convenio" value={descripcion} onChange={setDescripcion} maxLength={300} />
        <Campo label="Arancel pactado" value={arancel} onChange={setArancel} type="number" min="0" step="0.01" />
        <Campo label="Centro de costos" value={centroCostos} onChange={setCentroCostos} maxLength={100} />
      </div>
      <label className="mt-3 block text-xs font-medium text-graphite-700 dark:text-graphite-200">
        Previsiones incluidas (separadas por coma)
        <input value={previsiones} onChange={(event) => setPrevisiones(event.target.value)} maxLength={1000} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" />
      </label>
      {configuracion && <p className="mt-2 text-xs text-graphite-500 dark:text-graphite-400">
        Última actualización: {configuracion.updated_at ? new Date(configuracion.updated_at).toLocaleString('es-CL') : 'sin fecha disponible'}
        {configuracion.updated_by ? ` · Usuario ${configuracion.updated_by}` : ''}
      </p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-red-700 dark:text-red-300">{error || (guardado ? 'Configuración guardada y auditada.' : '')}</p>
        <Button type="submit" variant="primary" loading={guardando} disabled={guardando} icon={Save}>Guardar configuración</Button>
      </div>
    </form>
  )
})

const Campo: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  min?: string
  maxLength?: number
  step?: string
}> = ({ label, value, onChange, type = 'text', min, maxLength, step }) => (
  <label className="block text-xs font-medium text-graphite-700 dark:text-graphite-200">
    {label}
    <input type={type} min={min} maxLength={maxLength} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm dark:bg-graphite-900" />
  </label>
)

ConfiguracionGesClinicaPanel.displayName = 'ConfiguracionGesClinicaPanel'
