import React, { memo, useState } from 'react'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { Plus, Pencil, Building2 } from 'lucide-react'
import type { LaboratorioBase } from '../constants/laboratorioConstants'
import type { LabDataInput } from '../hooks/useLaboratorio'

export interface DirectorioLaboratoriosProps {
  laboratorios: LaboratorioBase[]
  puedeGestionar: boolean
  alGuardarLab: (labData: LabDataInput) => Promise<void>
}

const blankForm: LabDataInput = { nombre: '', tipo: 'externo' }

export const DirectorioLaboratorios: React.FC<DirectorioLaboratoriosProps> = memo(({ laboratorios, puedeGestionar, alGuardarLab }) => {
  const [editar, setEditar] = useState<LaboratorioBase | null>(null)
  const [form, setForm] = useState<LabDataInput>(blankForm)
  const [especialidades, setEspecialidades] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const iniciarNuevo = (): void => {
    setEditar(null)
    setForm(blankForm)
    setEspecialidades('')
    setError(null)
  }

  const iniciarEdicion = (lab: LaboratorioBase): void => {
    setEditar(lab)
    setForm({ ...lab, id: lab.id })
    setEspecialidades((lab.especialidades || []).join(', '))
    setError(null)
  }

  const actualizar = (campo: keyof LabDataInput, valor: string): void => {
    setForm(current => ({ ...current, [campo]: valor }))
  }

  const guardar = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!form.nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await alGuardarLab({
        ...form,
        nombre: form.nombre.trim(),
        especialidades: especialidades.split(',').map(item => item.trim()).filter(Boolean)
      })
      iniciarNuevo()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el laboratorio.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] gap-5 text-sm">
      {puedeGestionar && <form onSubmit={guardar} className="rounded-2xl border border-surface bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-surface pb-3">
          <h3 className="font-semibold">{editar ? 'Editar laboratorio' : 'Registrar laboratorio'}</h3>
          {editar && <Button type="button" variant="ghost" size="sm" onClick={iniciarNuevo}>Cancelar</Button>}
        </div>
        <Input label="Nombre *" required value={form.nombre} onChange={event => actualizar('nombre', event.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 font-medium">
            <span>Tipo</span>
            <select value={form.tipo || 'externo'} onChange={event => actualizar('tipo', event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              <option value="externo">Externo</option><option value="interno">Interno</option><option value="digital">Digital</option>
            </select>
          </label>
          <Input label="RUT" value={form.rut || ''} onChange={event => actualizar('rut', event.target.value)} />
          <Input label="Representante" value={form.representante || form.contacto || ''} onChange={event => actualizar('representante', event.target.value)} />
          <Input label="Técnico responsable" value={form.tecnicoResponsable || ''} onChange={event => actualizar('tecnicoResponsable', event.target.value)} />
          <Input label="Teléfono" value={form.telefono || ''} onChange={event => actualizar('telefono', event.target.value)} />
          <Input label="Correo" type="email" value={form.email || ''} onChange={event => actualizar('email', event.target.value)} />
          <Input label="Dirección" value={form.direccion || ''} onChange={event => actualizar('direccion', event.target.value)} />
          <Input label="Horario de retiro y entrega" value={form.horarioRetiroEntrega || ''} onChange={event => actualizar('horarioRetiroEntrega', event.target.value)} />
          <div className="sm:col-span-2">
            <Input label="Especialidades (separadas por coma)" value={especialidades} onChange={event => setEspecialidades(event.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className="text-xs text-clinical-error">{error}</p>}
        <Button type="submit" loading={guardando} icon={editar ? Pencil : Plus} fullWidth>
          {editar ? 'Guardar cambios' : 'Registrar laboratorio'}
        </Button>
      </form>}

      <section className="rounded-2xl border border-surface bg-surface p-5 space-y-3" aria-label="Directorio de laboratorios">
        <h3 className="font-semibold">Laboratorios registrados</h3>
        {laboratorios.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay laboratorios en el directorio.</p> : (
          <ul className="divide-y divide-surface">
            {laboratorios.map(lab => <li key={lab.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold truncate"><Building2 size={14} className="mr-1 inline" />{lab.nombre}</p>
                <p className="mt-1 text-xs text-muted-foreground">{lab.tipo || 'externo'} · {lab.estado || 'activo'}</p>
                <p className="text-xs text-muted-foreground">{lab.representante || lab.contacto || 'Sin representante'} · {lab.telefono || 'Sin teléfono'}</p>
                {lab.especialidades?.length ? <p className="mt-1 text-xs">{lab.especialidades.join(' · ')}</p> : null}
              </div>
              {puedeGestionar && typeof lab.id === 'string' && <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${lab.nombre}`} onClick={() => iniciarEdicion(lab)} icon={Pencil} />}
            </li>)}
          </ul>
        )}
        {!puedeGestionar && <p className="text-xs text-muted-foreground">Solo usuarios con permiso de gestión pueden modificar el directorio.</p>}
      </section>
    </div>
  )
})

DirectorioLaboratorios.displayName = 'DirectorioLaboratorios'
