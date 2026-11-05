import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Plus, Save, Tag, Trash2 } from 'lucide-react'
import { usePrestacionesStore } from '../../../../app/stores/prestacionesStore'
import { Button } from '../../../../shared/ui/ui/Button'
import { configuracionConveniosSchema, type ConfiguracionConvenios, type ConvenioClinica, type PrecioEspecificoPrestacion } from '../schemas/configuracionConveniosSchema'
import { useConfiguracionConvenios } from '../hooks/useConfiguracionConvenios'
import { clinicStorageService } from '../services/clinicStorageService'
import type { Sede } from '../schemas/sedeSchema'

interface ConfiguracionConveniosModuloProps {
  sedes: Sede[]
}

type AlcancePrecio = PrecioEspecificoPrestacion['alcance']

const crearId = (prefijo: string): string => {
  const aleatorio = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '')
    : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`
  return `${prefijo}-${aleatorio}`
}

const idDeContextoPrecio = (precio: PrecioEspecificoPrestacion): string =>
  `${precio.prestacionId}:${precio.alcance}:${precio.contextoId}`

export const ConfiguracionConveniosModulo: React.FC<ConfiguracionConveniosModuloProps> = ({ sedes }) => {
  const { configuracion, cargando, cargada, guardando, error, esAdmin, guardar } = useConfiguracionConvenios()
  const prestaciones = usePrestacionesStore((state) => state.prestacionesArancel)
  const estadoPrestaciones = usePrestacionesStore((state) => state.estadoRemoto)
  const sincronizarPrestaciones = usePrestacionesStore((state) => state.sincronizarDesdeSupabase)
  const [draft, setDraft] = useState<ConfiguracionConvenios>(configuracion)
  const [sucio, setSucio] = useState(false)
  const [nombreCategoria, setNombreCategoria] = useState('')
  const [nombreConvenio, setNombreConvenio] = useState('')
  const [tipoConvenioNuevo, setTipoConvenioNuevo] = useState<ConvenioClinica['tipo']>('isapre')
  const [nuevoPrecio, setNuevoPrecio] = useState<{ prestacionId: string; alcance: AlcancePrecio; contextoId: string; precio: string }>({
    prestacionId: '', alcance: 'convenio', contextoId: '', precio: '',
  })
  const [estadoGuardado, setEstadoGuardado] = useState<{ error: boolean; mensaje: string } | null>(null)
  const moneda = useMemo(() => clinicStorageService.obtenerClinica()?.moneda || 'CLP', [])

  useEffect(() => {
    if (cargada && !sucio) setDraft(configuracion)
  }, [cargada, configuracion, sucio])

  useEffect(() => {
    if (estadoPrestaciones === 'pendiente' || estadoPrestaciones === 'error') void sincronizarPrestaciones()
  }, [estadoPrestaciones, sincronizarPrestaciones])

  const actualizarDraft = (cambio: (actual: ConfiguracionConvenios) => ConfiguracionConvenios): void => {
    setDraft(cambio)
    setSucio(true)
    setEstadoGuardado(null)
  }

  const especialidades = [...new Set(prestaciones.map((prestacion) => prestacion.especialidad.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const sedesActivas = sedes.filter((sede) => sede.estado === 'activa' && sede.id)
  const contextosPrecio = nuevoPrecio.alcance === 'convenio'
    ? draft.convenios.filter((convenio) => convenio.activo).map((convenio) => ({ id: convenio.id, nombre: convenio.nombre }))
    : sedesActivas.map((sede) => ({ id: sede.id as string, nombre: sede.nombre }))
  const preciosEspecificos = draft.preciosEspecificos || []

  const guardarCambios = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const resultado = configuracionConveniosSchema.safeParse(draft)
    if (!resultado.success) {
      setEstadoGuardado({ error: true, mensaje: resultado.error.issues[0]?.message || 'Revisa la configuración de convenios.' })
      return
    }
    const ok = await guardar(resultado.data)
    setEstadoGuardado({ error: !ok, mensaje: ok ? 'Configuración sincronizada con la clínica.' : 'No se guardaron los cambios.' })
    if (ok) setSucio(false)
  }

  const agregarCategoria = (): void => {
    const nombre = nombreCategoria.trim()
    if (!nombre) return
    const idBase = nombre.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    actualizarDraft((actual) => ({
      ...actual,
      categorias: [...actual.categorias, { id: crearId(idBase || 'categoria'), nombre, especialidades: [] }],
    }))
    setNombreCategoria('')
  }

  const agregarConvenio = (): void => {
    const nombre = nombreConvenio.trim()
    if (!nombre) return
    const idBase = nombre.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    const nuevo: ConvenioClinica = {
      id: crearId(idBase || 'convenio'),
      nombre,
      tipo: tipoConvenioNuevo,
      ...(tipoConvenioNuevo === 'fonasa' ? { tramoFonasa: 'A' as const } : {}),
      activo: true,
      descuentosPorCategoria: {},
    }
    actualizarDraft((actual) => ({ ...actual, convenios: [...actual.convenios, nuevo] }))
    setNombreConvenio('')
  }

  const guardarPrecio = (): void => {
    const precio = Number(nuevoPrecio.precio)
    if (!nuevoPrecio.prestacionId || !nuevoPrecio.contextoId || !Number.isSafeInteger(precio) || precio < 0) return
    const entrada: PrecioEspecificoPrestacion = {
      prestacionId: nuevoPrecio.prestacionId,
      alcance: nuevoPrecio.alcance,
      contextoId: nuevoPrecio.contextoId,
      precio,
    }
    actualizarDraft((actual) => ({
      ...actual,
      preciosEspecificos: [
        ...(actual.preciosEspecificos || []).filter((item) => idDeContextoPrecio(item) !== idDeContextoPrecio(entrada)),
        entrada,
      ],
    }))
    setNuevoPrecio((actual) => ({ ...actual, prestacionId: '', precio: '' }))
  }

  if (cargando) return <p role="status" className="rounded-xl border border-surface bg-surface p-4 text-sm text-graphite-500">Cargando convenios de la clínica…</p>
  if (!cargada) return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      {error || 'No se pudo cargar la configuración compartida. No se habilitaron valores locales de reemplazo.'}
    </div>
  )

  return (
    <form onSubmit={(event) => { void guardarCambios(event) }} className="space-y-5 rounded-2xl border border-surface bg-surface p-4 sm:p-6">
      <header className="border-b border-surface pb-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-graphite-900 dark:text-white"><Tag size={17} /> Convenios y precios</h2>
        <p className="mt-1 text-xs text-graphite-500 dark:text-slate-400">Configura categorías, descuentos por convenio y precios específicos compartidos por la clínica.</p>
      </header>

      {!esAdmin && <p className="rounded-lg bg-gray-50 p-3 text-xs text-graphite-600 dark:bg-slate-900 dark:text-slate-300">Solo administración clínica puede modificar estos valores.</p>}

      <section className="space-y-3" aria-labelledby="categorias-convenio-titulo">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="categorias-convenio-titulo" className="text-sm font-semibold text-graphite-900 dark:text-white">Categorías de prestaciones</h3>
            <p className="mt-1 text-[11px] text-graphite-500 dark:text-slate-400">Asocia cada especialidad del catálogo a una categoría para que los porcentajes se calculen correctamente.</p>
          </div>
          {esAdmin && (
            <div className="flex gap-2">
              <input aria-label="Nombre de nueva categoría" maxLength={100} value={nombreCategoria} onChange={(event) => setNombreCategoria(event.target.value)} placeholder="Nueva categoría" className="min-w-0 rounded-lg border border-surface bg-white px-3 py-2 text-xs dark:bg-slate-900" />
              <Button type="button" size="sm" variant="outline" disabled={!nombreCategoria.trim()} onClick={agregarCategoria}><Plus size={14} className="mr-1" />Agregar</Button>
            </div>
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {draft.categorias.map((categoria) => (
            <article key={categoria.id} className="space-y-2 rounded-xl border border-surface p-3">
              <div className="flex items-center gap-2">
                <input aria-label={`Nombre de categoría ${categoria.nombre}`} disabled={!esAdmin} maxLength={100} value={categoria.nombre} onChange={(event) => actualizarDraft((actual) => ({ ...actual, categorias: actual.categorias.map((item) => item.id === categoria.id ? { ...item, nombre: event.target.value } : item) }))} className="min-w-0 flex-1 rounded-lg border border-surface bg-white px-2.5 py-2 text-xs font-semibold dark:bg-slate-900" />
                {esAdmin && <button type="button" aria-label={`Eliminar categoría ${categoria.nombre}`} onClick={() => actualizarDraft((actual) => ({
                  ...actual,
                  categorias: actual.categorias.filter((item) => item.id !== categoria.id),
                  convenios: actual.convenios.map((convenio) => {
                    const descuentosPorCategoria = { ...convenio.descuentosPorCategoria }
                    delete descuentosPorCategoria[categoria.id]
                    return { ...convenio, descuentosPorCategoria }
                  }),
                }))} className="rounded p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={14} /></button>}
              </div>
              {especialidades.length > 0 ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-graphite-600 dark:text-slate-300">Especialidades asignadas: {categoria.especialidades.length}</summary>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {especialidades.map((especialidad) => (
                      <label key={especialidad} className="flex items-center gap-2 rounded-md px-1 py-1 text-[11px] text-graphite-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          disabled={!esAdmin}
                          checked={categoria.especialidades.includes(especialidad)}
                          onChange={(event) => actualizarDraft((actual) => ({
                            ...actual,
                            categorias: actual.categorias.map((item) => item.id !== categoria.id ? { ...item, especialidades: item.especialidades.filter((nombre) => nombre !== especialidad) } : {
                              ...item,
                              especialidades: event.target.checked ? [...item.especialidades, especialidad] : item.especialidades.filter((nombre) => nombre !== especialidad),
                            }),
                          }))}
                        />
                        {especialidad}
                      </label>
                    ))}
                  </div>
                </details>
              ) : <p className="text-[11px] text-amber-700 dark:text-amber-300">Sin especialidades en el catálogo sincronizado.</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-surface pt-4" aria-labelledby="convenios-titulo">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="convenios-titulo" className="text-sm font-semibold text-graphite-900 dark:text-white">Convenios</h3>
            <p className="mt-1 text-[11px] text-graphite-500 dark:text-slate-400">Los porcentajes se aplican al precio particular cuando no hay un precio fijo configurado.</p>
          </div>
          {esAdmin && (
            <div className="flex flex-wrap gap-2">
              <input aria-label="Nombre del nuevo convenio" maxLength={120} value={nombreConvenio} onChange={(event) => setNombreConvenio(event.target.value)} placeholder="Nombre del convenio" className="min-w-40 rounded-lg border border-surface bg-white px-3 py-2 text-xs dark:bg-slate-900" />
              <select aria-label="Tipo del nuevo convenio" value={tipoConvenioNuevo} onChange={(event) => setTipoConvenioNuevo(event.target.value as ConvenioClinica['tipo'])} className="rounded-lg border border-surface bg-white px-3 py-2 text-xs dark:bg-slate-900">
                <option value="isapre">ISAPRE</option><option value="fonasa">FONASA</option><option value="otro">Otro</option>
              </select>
              <Button type="button" size="sm" variant="outline" disabled={!nombreConvenio.trim()} onClick={agregarConvenio}><Plus size={14} className="mr-1" />Agregar convenio</Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {draft.convenios.map((convenio) => (
            <article key={convenio.id} className="space-y-3 rounded-xl border border-surface p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_160px_130px_auto_auto] sm:items-end">
                <label className="text-[11px] font-semibold text-graphite-600 dark:text-slate-300">Nombre
                  <input disabled={!esAdmin} maxLength={120} value={convenio.nombre} onChange={(event) => actualizarDraft((actual) => ({ ...actual, convenios: actual.convenios.map((item) => item.id === convenio.id ? { ...item, nombre: event.target.value } : item) }))} className="mt-1 w-full rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900" />
                </label>
                <label className="text-[11px] font-semibold text-graphite-600 dark:text-slate-300">Tipo
                  <select disabled={!esAdmin} value={convenio.tipo} onChange={(event) => {
                    const tipo = event.target.value as ConvenioClinica['tipo']
                    actualizarDraft((actual) => ({ ...actual, convenios: actual.convenios.map((item) => {
                      if (item.id !== convenio.id) return item
                      const siguiente = { ...item, tipo }
                      if (tipo === 'fonasa') siguiente.tramoFonasa = item.tramoFonasa || 'A'
                      else delete siguiente.tramoFonasa
                      return siguiente
                    }) }))
                  }} className="mt-1 w-full rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900">
                    <option value="isapre">ISAPRE</option><option value="fonasa">FONASA</option><option value="otro">Otro</option>
                  </select>
                </label>
                {convenio.tipo === 'fonasa' && <label className="text-[11px] font-semibold text-graphite-600 dark:text-slate-300">Tramo
                  <select disabled={!esAdmin} value={convenio.tramoFonasa || 'A'} onChange={(event) => actualizarDraft((actual) => ({ ...actual, convenios: actual.convenios.map((item) => item.id === convenio.id ? { ...item, tramoFonasa: event.target.value as 'A' | 'B' | 'C' | 'D' } : item) }))} className="mt-1 w-full rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900">
                    {['A', 'B', 'C', 'D'].map((tramo) => <option key={tramo} value={tramo}>{tramo}</option>)}
                  </select>
                </label>}
                <label className="flex items-center gap-2 pb-2 text-xs text-graphite-700 dark:text-slate-200"><input type="checkbox" disabled={!esAdmin} checked={convenio.activo} onChange={(event) => actualizarDraft((actual) => ({ ...actual, convenios: actual.convenios.map((item) => item.id === convenio.id ? { ...item, activo: event.target.checked } : item) }))} />Activo</label>
                {esAdmin && <button type="button" aria-label={`Eliminar convenio ${convenio.nombre}`} onClick={() => actualizarDraft((actual) => ({
                  ...actual,
                  convenios: actual.convenios.filter((item) => item.id !== convenio.id),
                  preciosEspecificos: (actual.preciosEspecificos || []).filter((item) => !(item.alcance === 'convenio' && item.contextoId === convenio.id)),
                }))} className="mb-1 rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button>}
              </div>
              {draft.categorias.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {draft.categorias.map((categoria) => <label key={categoria.id} className="text-[11px] font-medium text-graphite-600 dark:text-slate-300">Descuento {categoria.nombre} (%)
                  <input type="number" min={0} max={100} step="0.01" disabled={!esAdmin} aria-label={`${convenio.nombre}: descuento ${categoria.nombre} en porcentaje`} value={convenio.descuentosPorCategoria[categoria.id] ?? 0} onChange={(event) => {
                    const valor = Number(event.target.value)
                    if (!Number.isFinite(valor) || valor < 0 || valor > 100) return
                    actualizarDraft((actual) => ({ ...actual, convenios: actual.convenios.map((item) => item.id === convenio.id ? { ...item, descuentosPorCategoria: { ...item.descuentosPorCategoria, [categoria.id]: valor } } : item) }))
                  }} className="mt-1 w-full rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900" />
                </label>)}
              </div>}
            </article>
          ))}
          {draft.convenios.length === 0 && <p className="rounded-lg bg-gray-50 p-4 text-xs text-graphite-500 dark:bg-slate-900 dark:text-slate-400">Todavía no hay convenios configurados.</p>}
        </div>
      </section>

      <section className="space-y-3 border-t border-surface pt-4" aria-labelledby="precios-especificos-titulo">
        <div>
          <h3 id="precios-especificos-titulo" className="text-sm font-semibold text-graphite-900 dark:text-white">Precios por prestación</h3>
          <p className="mt-1 text-[11px] text-graphite-500 dark:text-slate-400">Un precio fijo por convenio o sucursal tiene prioridad sobre el arancel base. Los importes se expresan en {moneda}.</p>
        </div>
        {esAdmin && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_150px_1fr_150px_auto]">
            <select aria-label="Prestación para precio específico" value={nuevoPrecio.prestacionId} onChange={(event) => setNuevoPrecio((actual) => ({ ...actual, prestacionId: event.target.value }))} disabled={prestaciones.length === 0} className="rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900">
              <option value="">Selecciona prestación</option>{prestaciones.map((prestacion) => <option key={prestacion.id} value={String(prestacion.id)}>{prestacion.nombre} · {prestacion.especialidad}</option>)}
            </select>
            <select aria-label="Alcance del precio específico" value={nuevoPrecio.alcance} onChange={(event) => setNuevoPrecio({ ...nuevoPrecio, alcance: event.target.value as AlcancePrecio, contextoId: '' })} className="rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900">
              <option value="convenio">Convenio</option><option value="sucursal">Sucursal</option>
            </select>
            <select aria-label="Convenio o sucursal del precio específico" value={nuevoPrecio.contextoId} onChange={(event) => setNuevoPrecio((actual) => ({ ...actual, contextoId: event.target.value }))} disabled={contextosPrecio.length === 0} className="rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900">
              <option value="">Selecciona contexto</option>{contextosPrecio.map((contexto) => <option key={contexto.id} value={contexto.id}>{contexto.nombre}</option>)}
            </select>
            <input aria-label={`Precio específico en ${moneda}`} type="number" min={0} max={2147483647} step={1} value={nuevoPrecio.precio} onChange={(event) => setNuevoPrecio((actual) => ({ ...actual, precio: event.target.value }))} placeholder={`Precio (${moneda})`} className="rounded-lg border border-surface bg-white px-2.5 py-2 text-xs dark:bg-slate-900" />
            <Button type="button" size="sm" variant="outline" disabled={!nuevoPrecio.prestacionId || !nuevoPrecio.contextoId || nuevoPrecio.precio === ''} onClick={guardarPrecio}><Plus size={14} className="mr-1" />Agregar precio</Button>
          </div>
        )}
        {estadoPrestaciones === 'error' && <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300">El catálogo no se sincronizó; los precios específicos requieren cargar las prestaciones de la clínica.</p>}
        {preciosEspecificos.length > 0 ? (
          <ul className="divide-y divide-surface rounded-xl border border-surface">
            {preciosEspecificos.map((precio) => {
              const prestacion = prestaciones.find((item) => String(item.id) === precio.prestacionId)
              const contexto = precio.alcance === 'convenio'
                ? draft.convenios.find((item) => item.id === precio.contextoId)?.nombre
                : sedes.find((item) => item.id === precio.contextoId)?.nombre
              return <li key={idDeContextoPrecio(precio)} className="flex items-center justify-between gap-3 p-3 text-xs">
                <span>{prestacion?.nombre || `Prestación ${precio.prestacionId}`} · {contexto || precio.contextoId} · {precio.precio.toLocaleString()} {moneda}</span>
                {esAdmin && <button type="button" aria-label={`Eliminar precio ${prestacion?.nombre || precio.prestacionId} en ${contexto || precio.contextoId}`} onClick={() => actualizarDraft((actual) => ({ ...actual, preciosEspecificos: (actual.preciosEspecificos || []).filter((item) => idDeContextoPrecio(item) !== idDeContextoPrecio(precio)) }))} className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={14} /></button>}
              </li>
            })}
          </ul>
        ) : <p className="rounded-lg bg-gray-50 p-3 text-xs text-graphite-500 dark:bg-slate-900 dark:text-slate-400">No hay precios específicos configurados.</p>}
      </section>

      {(error || estadoGuardado) && <p role={estadoGuardado?.error || error ? 'alert' : 'status'} className={`flex items-center gap-2 text-xs ${estadoGuardado?.error || error ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
        {estadoGuardado?.error || error ? <CircleAlert size={14} /> : <CheckCircle2 size={14} />}{estadoGuardado?.mensaje || error}
      </p>}
      {esAdmin && <div className="flex justify-end border-t border-surface pt-3"><Button type="submit" variant="primary" disabled={guardando || !cargada}><Save size={14} className="mr-1.5" />{guardando ? 'Sincronizando…' : 'Guardar configuración'}</Button></div>}
    </form>
  )
}
