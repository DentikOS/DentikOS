import React, { useState } from 'react'
import { ArchiveRestore, Armchair, AlertCircle, Pencil, Plus, Wrench } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import type { Sede } from '../schemas/sedeSchema'
import {
  boxClinicoSchema,
  EQUIPAMIENTO_BOX,
  type BoxClinico,
  type EquipoBox,
} from '../schemas/boxSchema'
import { useBoxesClinicos } from '../hooks/useBoxesClinicos'

type DatosBox = Omit<BoxClinico, 'id' | 'clinicaId' | 'sucursalId' | 'createdAt' | 'updatedAt'>

const boxVacio = (): DatosBox => ({
  nombre: '',
  tipo: 'general',
  unidadDental: '',
  anioInstalacion: null,
  equipamiento: [],
  notas: '',
  estado: 'activo',
})

const etiquetaEstado = (estado: BoxClinico['estado']): string => ({
  activo: 'Activo',
  inactivo: 'Inactivo',
  mantenimiento: 'En mantenimiento',
})[estado]

interface GestionBoxesClinicosProps {
  sede: Sede | null
  puedeAdministrar: boolean
  sucursalesRegistradas?: number
  onIrAConfigurarSedePrincipal?: () => void
}

export const GestionBoxesClinicos: React.FC<GestionBoxesClinicosProps> = ({
  sede,
  puedeAdministrar,
  sucursalesRegistradas = sede ? 1 : 0,
  onIrAConfigurarSedePrincipal,
}) => {
  const clinicaId = useSesionStore((state) => state.clinicaActual || state.userProfile?.clinicaId || '')
  const { boxes, cargando, error, crear, actualizar } = useBoxesClinicos(sede?.id || null)
  const [edicionId, setEdicionId] = useState<string | null>(null)
  const [form, setForm] = useState<DatosBox>(boxVacio)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null)

  const iniciarEdicion = (box: BoxClinico) => {
    setEdicionId(box.id || null)
    setForm({
      nombre: box.nombre,
      tipo: box.tipo,
      unidadDental: box.unidadDental,
      anioInstalacion: box.anioInstalacion || null,
      equipamiento: box.equipamiento.map((equipo) => ({ ...equipo })),
      notas: box.notas,
      estado: box.estado,
    })
    setErrorFormulario(null)
  }

  const cancelarEdicion = () => {
    setEdicionId(null)
    setForm(boxVacio())
    setErrorFormulario(null)
  }

  const guardar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!puedeAdministrar || !sede?.id || guardando) return
    const datos = {
      ...form,
      nombre: form.nombre.trim(),
      unidadDental: form.unidadDental.trim(),
      clinicaId,
      sucursalId: sede.id,
      ...(edicionId ? { id: edicionId } : {}),
    }
    const validacion = boxClinicoSchema.safeParse(datos)
    if (!validacion.success) {
      setErrorFormulario(validacion.error.issues[0]?.message || 'Revisa los datos del box.')
      return
    }
    setGuardando(true)
    setErrorFormulario(null)
    try {
      const { id: _id, clinicaId: _clinicaId, sucursalId: _sucursalId, createdAt: _createdAt, updatedAt: _updatedAt, ...datosGuardables } = validacion.data
      if (edicionId) await actualizar(edicionId, datosGuardables)
      else await crear(datosGuardables)
      cancelarEdicion()
    } catch (cause: unknown) {
      setErrorFormulario(cause instanceof Error ? cause.message : 'No se pudo guardar el box.')
    } finally {
      setGuardando(false)
    }
  }

  const cambiarDisponibilidadEquipo = (tipo: EquipoBox['tipo'], disponible: boolean) => {
    setForm((prev) => {
      const equipoExistente = prev.equipamiento.find((equipo) => equipo.tipo === tipo)
      if (!disponible) return { ...prev, equipamiento: prev.equipamiento.filter((equipo) => equipo.tipo !== tipo) }
      if (equipoExistente) return prev
      return { ...prev, equipamiento: [...prev.equipamiento, { tipo, marca: '', serial: '' }] }
    })
  }

  const cambiarDatoEquipo = (tipo: EquipoBox['tipo'], campo: 'marca' | 'serial', valor: string) => {
    setForm((prev) => ({
      ...prev,
      equipamiento: prev.equipamiento.map((equipo) => equipo.tipo === tipo ? { ...equipo, [campo]: valor } : equipo),
    }))
  }

  const cambiarEstado = async (box: BoxClinico, estado: BoxClinico['estado']) => {
    if (!box.id || guardando) return
    setGuardando(true)
    setErrorFormulario(null)
    try {
      await actualizar(box.id, { estado })
    } catch (cause: unknown) {
      setErrorFormulario(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado del box.')
    } finally {
      setGuardando(false)
    }
  }

  if (!sede) {
    const noHaySucursales = sucursalesRegistradas === 0
    const mensaje = noHaySucursales
      ? puedeAdministrar
        ? 'La sede principal de esta clínica aún no está configurada. Completa sus datos y quedará seleccionada automáticamente para gestionar boxes.'
        : 'La sede principal de esta clínica aún no está configurada. Solicita a administración completar sus datos para gestionar boxes.'
      : puedeAdministrar
        ? 'No hay una sucursal activa. Activa una de las sucursales registradas o registra una nueva para gestionar boxes.'
        : 'No hay una sucursal activa disponible. Solicita a administración que active una sucursal para gestionar boxes.'

    return (
      <div role="status" className="rounded-lg bg-gray-50 p-4 text-xs text-graphite-500 dark:bg-slate-900 dark:text-slate-400">
        <p>{mensaje}</p>
        {noHaySucursales && puedeAdministrar && onIrAConfigurarSedePrincipal && (
          <Button type="button" size="sm" variant="outline" className="mt-3 text-[11px]" onClick={onIrAConfigurarSedePrincipal}>
            {noHaySucursales ? 'Completar sede principal' : 'Gestionar sucursales'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-surface p-4" aria-labelledby="boxes-clinicos-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-surface pb-3">
        <div>
          <h3 id="boxes-clinicos-titulo" className="text-sm font-bold text-graphite-900 dark:text-white">Boxes · {sede.nombre}</h3>
          <p className="text-[11px] text-graphite-500 dark:text-slate-400">Unidad dental y equipamiento disponible para esta sucursal.</p>
        </div>
        {cargando && <span className="text-[11px] text-graphite-500 dark:text-slate-400">Sincronizando…</span>}
      </div>

      {(error || errorFormulario) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{errorFormulario || error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {boxes.map((box) => {
          const equipoNombres = new Set(box.equipamiento.map((equipo) => equipo.tipo))
          return (
            <article key={box.id} className="rounded-xl border border-surface bg-gray-50/50 p-4 text-xs dark:bg-slate-900/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="flex items-center gap-1.5 text-sm font-bold text-graphite-900 dark:text-white"><Armchair size={14} className="text-[#D4AF37]" />{box.nombre}</h4>
                  <p className="mt-1 text-graphite-500 dark:text-slate-400">{box.tipo === 'cirugia' ? 'Cirugía' : box.tipo === 'ortodoncia' ? 'Ortodoncia' : 'General'} · {box.unidadDental}{box.anioInstalacion ? ` · ${box.anioInstalacion}` : ''}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${box.estado === 'activo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : box.estado === 'mantenimiento' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200'}`}>{etiquetaEstado(box.estado)}</span>
              </div>
              {box.equipamiento.length > 0 ? (
                <ul className="mt-3 space-y-1 text-[11px] text-graphite-600 dark:text-slate-300">
                  {EQUIPAMIENTO_BOX.filter((equipo) => equipoNombres.has(equipo.id)).map((equipo) => (
                    <li key={equipo.id}>✓ {equipo.nombre}{box.equipamiento.find((item) => item.tipo === equipo.id)?.marca ? ` · ${box.equipamiento.find((item) => item.tipo === equipo.id)?.marca}` : ''}</li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-[11px] text-graphite-400 dark:text-slate-500">Sin equipamiento adicional registrado.</p>}
              {box.notas && <p className="mt-2 text-[11px] text-graphite-500 dark:text-slate-400">{box.notas}</p>}
              {puedeAdministrar && box.id && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-surface pt-3">
                  <Button type="button" size="sm" variant="outline" className="text-[11px]" disabled={guardando} onClick={() => iniciarEdicion(box)}><Pencil size={13} className="mr-1" />Editar</Button>
                  {box.estado !== 'inactivo' ? (
                    <Button type="button" size="sm" variant="outline" className="text-[11px]" disabled={guardando} onClick={() => void cambiarEstado(box, 'inactivo')}><ArchiveRestore size={13} className="mr-1" />Desactivar</Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="text-[11px]" disabled={guardando} onClick={() => void cambiarEstado(box, 'activo')}><ArchiveRestore size={13} className="mr-1" />Activar</Button>
                  )}
                  {box.estado !== 'mantenimiento' && box.estado !== 'inactivo' && (
                    <Button type="button" size="sm" variant="outline" className="text-[11px]" disabled={guardando} onClick={() => void cambiarEstado(box, 'mantenimiento')}><Wrench size={13} className="mr-1" />Mantenimiento</Button>
                  )}
                  {box.estado === 'mantenimiento' && (
                    <Button type="button" size="sm" variant="outline" className="text-[11px]" disabled={guardando} onClick={() => void cambiarEstado(box, 'activo')}><ArchiveRestore size={13} className="mr-1" />Reactivar</Button>
                  )}
                </div>
              )}
            </article>
          )
        })}
        {boxes.length === 0 && !cargando && <p className="col-span-full rounded-lg bg-gray-50 p-4 text-xs text-graphite-500 dark:bg-slate-900 dark:text-slate-400">Esta sucursal todavía no tiene boxes registrados.</p>}
      </div>

      {puedeAdministrar ? (
        <form onSubmit={(event) => { void guardar(event) }} className="space-y-4 rounded-xl border border-dashed border-gray-300 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-graphite-800 dark:text-slate-200">{edicionId ? 'Editar box' : 'Agregar box'}</h4>
            {edicionId && <button type="button" onClick={cancelarEdicion} className="text-[11px] text-graphite-500 hover:text-graphite-900 dark:hover:text-white">Cancelar edición</button>}
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <input aria-label="Nombre del box" required minLength={2} maxLength={100} value={form.nombre} onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))} placeholder="Nombre del box" className="rounded-lg border border-surface bg-white p-2 dark:bg-slate-900" />
            <select aria-label="Tipo de box" value={form.tipo} onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value as DatosBox['tipo'] }))} className="rounded-lg border border-surface bg-white p-2 dark:bg-slate-900">
              <option value="general">General</option>
              <option value="cirugia">Cirugía</option>
              <option value="ortodoncia">Ortodoncia</option>
            </select>
            <input aria-label="Unidad dental" required minLength={2} maxLength={120} value={form.unidadDental} onChange={(event) => setForm((prev) => ({ ...prev, unidadDental: event.target.value }))} placeholder="Unidad dental (marca y modelo)" className="rounded-lg border border-surface bg-white p-2 dark:bg-slate-900" />
            <input aria-label="Año de instalación" type="number" min={1900} max={2100} value={form.anioInstalacion ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, anioInstalacion: event.target.value ? Number(event.target.value) : null }))} placeholder="Año de instalación" className="rounded-lg border border-surface bg-white p-2 dark:bg-slate-900" />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-graphite-800 dark:text-slate-200">Equipamiento disponible</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EQUIPAMIENTO_BOX.map((equipoCatalogo) => {
                const configurado = form.equipamiento.find((item) => item.tipo === equipoCatalogo.id)
                return (
                  <div key={equipoCatalogo.id} className="space-y-1 rounded-lg border border-surface p-2">
                    <label className="flex items-center gap-2 text-xs text-graphite-700 dark:text-slate-200">
                      <input type="checkbox" checked={Boolean(configurado)} onChange={(event) => cambiarDisponibilidadEquipo(equipoCatalogo.id, event.target.checked)} />
                      {equipoCatalogo.nombre}
                    </label>
                    {configurado && (
                      <div className="grid grid-cols-2 gap-1 pl-6">
                        <input aria-label={`${equipoCatalogo.nombre} marca`} maxLength={120} value={configurado.marca || ''} onChange={(event) => cambiarDatoEquipo(equipoCatalogo.id, 'marca', event.target.value)} placeholder="Marca" className="min-w-0 rounded border border-surface bg-white p-1.5 text-[11px] dark:bg-slate-900" />
                        <input aria-label={`${equipoCatalogo.nombre} número de serie`} maxLength={100} value={configurado.serial || ''} onChange={(event) => cambiarDatoEquipo(equipoCatalogo.id, 'serial', event.target.value)} placeholder="N° de serie" className="min-w-0 rounded border border-surface bg-white p-1.5 text-[11px] dark:bg-slate-900" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </fieldset>

          <textarea aria-label="Notas del box" maxLength={1000} rows={2} value={form.notas} onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))} placeholder="Notas operativas" className="w-full rounded-lg border border-surface bg-white p-2 text-xs dark:bg-slate-900" />
          {errorFormulario && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{errorFormulario}</p>}
          <Button type="submit" size="sm" variant="primary" disabled={guardando || !sede.id} className="text-xs">
            {edicionId ? <Pencil size={14} className="mr-1" /> : <Plus size={14} className="mr-1" />}
            {guardando ? 'Guardando…' : edicionId ? 'Guardar cambios' : 'Registrar box'}
          </Button>
        </form>
      ) : <p className="text-xs text-graphite-500 dark:text-slate-400">Solo administración clínica puede registrar o modificar boxes.</p>}
    </section>
  )
}
