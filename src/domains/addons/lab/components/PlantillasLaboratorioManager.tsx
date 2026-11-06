import React, { useMemo, useState } from 'react'
import { FilePlus2, Save } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { Input } from '../../../../shared/ui/ui/Input'
import { CATEGORIAS_LABORATORIO, ETAPAS_LABORATORIO, type CategoriaLaboratorio } from '../constants/laboratorioConstants'
import { laboratorioCoreService, type PlantillaLaboratorioInput } from '../services/laboratorioCoreService'

interface Props {
  clinicaId: string | null
  plantillas: Record<string, unknown>[]
  puedeConfigurar: boolean
  onCambio: () => Promise<void>
}

const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const active = (row: Record<string, unknown>): boolean => row.estado === 'activo'

const formularioVacio = (): PlantillaLaboratorioInput => ({
  nombre: '', categoria: 'protesis_fija', descripcion: '', diasEstimados: null,
  etapas: ETAPAS_LABORATORIO.map(item => item.id), fotosRequeridas: [],
  camposPersonalizados: {}, estado: 'activo'
})

export const PlantillasLaboratorioManager: React.FC<Props> = ({ clinicaId, plantillas, puedeConfigurar, onCambio }) => {
  const [form, setForm] = useState<PlantillaLaboratorioInput>(formularioVacio)
  const [fotosTexto, setFotosTexto] = useState('')
  const [camposTexto, setCamposTexto] = useState('{}')
  const [guardando, setGuardando] = useState(false)
  const [inicializando, setInicializando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const ordenadas = useMemo(() => [...plantillas].sort((a, b) => {
    const byName = text(a.nombre).localeCompare(text(b.nombre), 'es')
    return byName || Number(b.version || 0) - Number(a.version || 0)
  }), [plantillas])

  const seleccionar = (row: Record<string, unknown>): void => {
    const etapas = strings(row.etapas).filter((item): item is PlantillaLaboratorioInput['etapas'][number] =>
      ETAPAS_LABORATORIO.some(stage => stage.id === item))
    const campos = row.campos_personalizados && typeof row.campos_personalizados === 'object' && !Array.isArray(row.campos_personalizados)
      ? row.campos_personalizados as Record<string, unknown> : {}
    const fotos = strings(row.fotos_requeridas)
    setForm({
      id: text(row.id), nombre: text(row.nombre), categoria: text(row.categoria, 'protesis_fija'),
      descripcion: text(row.descripcion), diasEstimados: typeof row.dias_estimados === 'number' ? row.dias_estimados : null,
      etapas, fotosRequeridas: fotos, camposPersonalizados: campos,
      estado: active(row) ? 'activo' : 'inactivo'
    })
    setFotosTexto(fotos.join(', '))
    setCamposTexto(JSON.stringify(campos, null, 2))
    setError(null)
    setMensaje(null)
  }

  const nueva = (): void => {
    setForm(formularioVacio())
    setFotosTexto('')
    setCamposTexto('{}')
    setError(null)
    setMensaje(null)
  }

  const guardar = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)
    setMensaje(null)
    let campos: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(camposTexto)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('El JSON debe ser un objeto.')
      campos = parsed as Record<string, unknown>
    } catch {
      setError('Los campos personalizados deben ser un objeto JSON válido.')
      return
    }
    const fotos = [...new Set(fotosTexto.split(',').map(item => item.trim()).filter(Boolean))]
    if (!form.etapas.length) {
      setError('Selecciona al menos una etapa de trabajo.')
      return
    }
    setGuardando(true)
    try {
      await laboratorioCoreService.guardarPlantilla({ ...form, fotosRequeridas: fotos, camposPersonalizados: campos })
      setMensaje('Nueva versión guardada. Las órdenes existentes conservan su copia de plantilla.')
      await onCambio()
    } catch {
      setError('No se pudo guardar. Verifica los datos y los permisos de esta clínica.')
    } finally {
      setGuardando(false)
    }
  }

  const inicializar = async (): Promise<void> => {
    setInicializando(true)
    setError(null)
    try {
      const creadas = await laboratorioCoreService.asegurarPlantillas()
      await onCambio()
      setMensaje(creadas > 0 ? 'Plantillas base listas para esta clínica.' : 'Las plantillas base ya estaban disponibles.')
    } catch {
      setError('No se pudieron preparar las plantillas base para esta clínica.')
    } finally {
      setInicializando(false)
    }
  }

  if (!puedeConfigurar) return null

  return (
    <section className="rounded-2xl border border-surface bg-surface p-5 space-y-4" aria-label="Plantillas de laboratorio">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Plantillas de trabajo</h3>
          <p className="mt-1 text-xs text-muted-foreground">Cada guardado crea una versión nueva dentro de la clínica activa.</p>
        </div>
        <div className="flex gap-2">
          {plantillas.length === 0 && <Button type="button" variant="outline" size="sm" loading={inicializando} onClick={() => void inicializar()}>Preparar plantillas base</Button>}
          <Button type="button" variant="outline" size="sm" icon={FilePlus2} onClick={nueva}>Nueva plantilla</Button>
        </div>
      </div>

      {plantillas.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Versiones de plantillas">
        {ordenadas.map(row => (
          <button key={String(row.id)} type="button" onClick={() => seleccionar(row)}
            className={`rounded-lg border px-3 py-2 text-left text-xs ${form.id === row.id ? 'border-primary bg-primary/5' : 'border-surface hover:bg-background'}`}>
            <span className="block font-semibold">{text(row.nombre, 'Plantilla')}</span>
            <span className="block text-muted-foreground">v{Number(row.version || 1)} · {active(row) ? 'Activa' : 'Histórica'}</span>
          </button>
        ))}
      </div>}

      <form onSubmit={guardar} className="space-y-3 border-t border-surface pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nombre *" required minLength={2} maxLength={160} value={form.nombre} onChange={event => setForm(current => ({ ...current, nombre: event.target.value }))} />
          <label className="space-y-1 text-xs font-medium">
            <span>Categoría</span>
            <select value={form.categoria} onChange={event => setForm(current => ({ ...current, categoria: event.target.value as CategoriaLaboratorio }))} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              {CATEGORIAS_LABORATORIO.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-xs font-medium"><span>Descripción</span>
          <textarea rows={2} maxLength={2000} value={form.descripcion} onChange={event => setForm(current => ({ ...current, descripcion: event.target.value }))} className="w-full rounded-lg border border-surface bg-background px-3 py-2" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Días estimados" type="number" min={1} max={365} value={form.diasEstimados ?? ''} onChange={event => setForm(current => ({ ...current, diasEstimados: event.target.value ? Number(event.target.value) : null }))} />
          <Input label="Fotos requeridas (separadas por coma)" maxLength={500} value={fotosTexto} onChange={event => setFotosTexto(event.target.value)} />
        </div>
        <fieldset className="rounded-xl border border-surface p-3">
          <legend className="px-1 text-xs font-semibold">Etapas de esta plantilla</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {ETAPAS_LABORATORIO.map(stage => <label key={stage.id} className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.etapas.includes(stage.id)} onChange={event => setForm(current => ({ ...current, etapas: event.target.checked ? [...current.etapas, stage.id] : current.etapas.filter(item => item !== stage.id) }))} />
              {stage.nombre}
            </label>)}
          </div>
        </fieldset>
        <label className="block space-y-1 text-xs font-medium"><span>Campos personalizados (JSON)</span>
          <textarea rows={5} spellCheck={false} value={camposTexto} onChange={event => setCamposTexto(event.target.value)} className="w-full rounded-lg border border-surface bg-background px-3 py-2 font-mono text-xs" />
        </label>
        {form.id && <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={form.estado === 'activo'} onChange={event => setForm(current => ({ ...current, estado: event.target.checked ? 'activo' : 'inactivo' }))} />Versión nueva activa</label>}
        {error && <p role="alert" className="text-xs text-clinical-error">{error}</p>}
        {mensaje && <p role="status" className="text-xs text-clinical-success">{mensaje}</p>}
        <div className="flex justify-end"><Button type="submit" icon={Save} loading={guardando}>Guardar versión</Button></div>
      </form>
      {!clinicaId && <p className="text-xs text-clinical-error">Selecciona una clínica para administrar plantillas.</p>}
    </section>
  )
}
