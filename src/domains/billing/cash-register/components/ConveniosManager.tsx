import React, { memo, useEffect, useMemo, useState } from 'react'
import { Plus, Save, Settings } from 'lucide-react'
import type { ConvenioConfig } from '../services/finanzasStorageService'
import { ESPECIALIDADES_ODONTOLOGICAS } from '../../../organization/prestations/constants/prestacionesConstants'
import { useConfiguracionConvenios } from '../../../organization/clinic/hooks/useConfiguracionConvenios'
import {
  type ConfiguracionConvenios,
  type ConvenioClinica,
} from '../../../organization/clinic/schemas/configuracionConveniosSchema'
import { PreciosEspecificosManager } from './PreciosEspecificosManager'

// Props opcionales conservadas porque FinanzasModulo aún consume la API local legacy.
export interface ConveniosManagerProps {
  convenios?: ConvenioConfig[]
  onActualizarDescuento?: (convenioId: string | number, nuevoDescuento: string | number) => void
}

const crearId = (prefijo: string): string => `${prefijo}-${crypto.randomUUID()}`

const etiquetaConvenio = (convenio: ConvenioClinica): string => {
  if (convenio.tipo === 'fonasa') return `FONASA · Tramo ${convenio.tramoFonasa}`
  if (convenio.tipo === 'isapre') return 'ISAPRE'
  return 'Otro convenio'
}

export const ConveniosManager = memo<ConveniosManagerProps>(() => {
  const { configuracion, cargando, cargada, guardando, error, esAdmin, guardar } = useConfiguracionConvenios()
  const [borrador, setBorrador] = useState<ConfiguracionConvenios>(configuracion)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [tipoNuevo, setTipoNuevo] = useState<ConvenioClinica['tipo']>('isapre')
  const [tramoNuevo, setTramoNuevo] = useState<'A' | 'B' | 'C' | 'D'>('B')
  const [categoriaNueva, setCategoriaNueva] = useState('')
  const [especialidadNueva, setEspecialidadNueva] = useState('')
  const [categoriaEspecialidadNueva, setCategoriaEspecialidadNueva] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (!cargando && !error) setBorrador(configuracion)
  }, [configuracion, cargando, error])

  const especialidades = useMemo(() => {
    const encontradas = new Set<string>(ESPECIALIDADES_ODONTOLOGICAS)
    for (const categoria of borrador.categorias) {
      categoria.especialidades.forEach((especialidad) => encontradas.add(especialidad))
    }
    return [...encontradas].sort((a, b) => a.localeCompare(b, 'es-CL'))
  }, [borrador.categorias])

  const actualizarConvenio = (id: string, actualizar: (convenio: ConvenioClinica) => ConvenioClinica): void => {
    setBorrador((actual) => ({
      ...actual,
      convenios: actual.convenios.map((convenio) => convenio.id === id ? actualizar(convenio) : convenio),
    }))
    setMensaje(null)
  }

  const agregarConvenio = (): void => {
    const nombre = nombreNuevo.trim()
    if (!nombre) {
      setMensaje('Escribe el nombre del convenio.')
      return
    }
    const duplicado = borrador.convenios.some((convenio) =>
      convenio.nombre.trim().toLocaleLowerCase('es-CL') === nombre.toLocaleLowerCase('es-CL') &&
      (convenio.tipo !== 'fonasa' || convenio.tramoFonasa === tramoNuevo)
    )
    if (duplicado) {
      setMensaje('Ya existe un convenio con ese nombre y tipo.')
      return
    }

    const convenio: ConvenioClinica = {
      id: crearId('convenio'),
      nombre,
      tipo: tipoNuevo,
      ...(tipoNuevo === 'fonasa' ? { tramoFonasa: tramoNuevo } : {}),
      activo: true,
      descuentosPorCategoria: Object.fromEntries(borrador.categorias.map((categoria) => [categoria.id, 0])),
    }
    setBorrador((actual) => ({ ...actual, convenios: [...actual.convenios, convenio] }))
    setNombreNuevo('')
    setMensaje(null)
  }

  const agregarCategoria = (): void => {
    const nombre = categoriaNueva.trim()
    if (!nombre) return
    if (borrador.categorias.some((categoria) => categoria.nombre.toLocaleLowerCase('es-CL') === nombre.toLocaleLowerCase('es-CL'))) {
      setMensaje('Ya existe una categoría con ese nombre.')
      return
    }
    const id = crearId('categoria')
    setBorrador((actual) => ({
      ...actual,
      categorias: [...actual.categorias, { id, nombre, especialidades: [] }],
      convenios: actual.convenios.map((convenio) => ({
        ...convenio,
        descuentosPorCategoria: { ...convenio.descuentosPorCategoria, [id]: 0 },
      })),
    }))
    setCategoriaNueva('')
    setMensaje(null)
  }

  const asignarEspecialidad = (especialidad: string, categoriaId: string): void => {
    setBorrador((actual) => ({
      ...actual,
      categorias: actual.categorias.map((categoria) => ({
        ...categoria,
        especialidades: categoria.id === categoriaId
          ? [...categoria.especialidades.filter((item) => item !== especialidad), especialidad]
          : categoria.especialidades.filter((item) => item !== especialidad),
      })),
    }))
    setMensaje(null)
  }

  const agregarEspecialidadPersonalizada = (): void => {
    const nombre = especialidadNueva.trim()
    if (!nombre || !categoriaEspecialidadNueva) {
      setMensaje('Escribe la especialidad exacta del catálogo y elige su categoría.')
      return
    }
    if (especialidades.some((item) => item.toLocaleLowerCase('es-CL') === nombre.toLocaleLowerCase('es-CL'))) {
      setMensaje('Esa especialidad ya está en la lista.')
      return
    }
    asignarEspecialidad(nombre, categoriaEspecialidadNueva)
    setEspecialidadNueva('')
    setCategoriaEspecialidadNueva('')
  }

  const guardarConfiguracion = async (): Promise<void> => {
    const ok = await guardar(borrador)
    setMensaje(ok ? 'Configuración compartida guardada.' : 'No se guardaron los cambios.')
  }

  const categoriaDeEspecialidad = (especialidad: string): string =>
    borrador.categorias.find((categoria) => categoria.especialidades.includes(especialidad))?.id || ''

  return (
    <section className="rounded-2xl border border-surface bg-surface p-5 shadow-xs" aria-labelledby="convenios-title">
      <header className="mb-5 border-b border-surface pb-3">
        <h2 id="convenios-title" className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-50">
          <Settings size={16} /> Convenios compartidos de la clínica
        </h2>
        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
          La configuración se sincroniza entre los miembros de esta clínica. Parte sin convenios ni descuentos precargados.
          Las reglas se aplican solo a prestaciones nuevas del plan y no modifican presupuestos existentes.
        </p>
      </header>

      {cargando && <p role="status" className="text-xs text-graphite-500">Cargando configuración de la clínica…</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

      {!cargando && (!error || cargada) && (
        <div className="space-y-6">
          {!esAdmin && (
            <p className="rounded-lg bg-surface-muted p-3 text-xs text-graphite-600 dark:text-graphite-300">
              Puedes consultar los convenios. Solo un administrador de la clínica puede cambiarlos.
            </p>
          )}

          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-graphite-800 dark:text-graphite-100">Categorías y especialidades</h3>
              <p className="mt-1 text-[11px] text-graphite-500">Asocia cada especialidad del catálogo a una sola categoría. Sin asociación, no se aplica descuento por categoría.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {especialidades.map((especialidad) => (
                <label key={especialidad} className="grid grid-cols-[1fr_minmax(140px,0.8fr)] items-center gap-2 rounded-lg border border-surface p-2 text-[11px]">
                  <span className="font-medium text-graphite-700 dark:text-graphite-200">{especialidad}</span>
                  <select
                    value={categoriaDeEspecialidad(especialidad)}
                    disabled={!esAdmin || guardando}
                    onChange={(event) => asignarEspecialidad(especialidad, event.target.value)}
                    className="min-w-0 rounded-md border border-surface bg-surface px-2 py-1.5 disabled:opacity-60"
                    aria-label={`Categoría de ${especialidad}`}
                  >
                    <option value="">Sin categoría</option>
                    {borrador.categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {esAdmin && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={categoriaNueva}
                    onChange={(event) => setCategoriaNueva(event.target.value)}
                    maxLength={100}
                    placeholder="Categoría personalizada"
                    className="min-w-[220px] flex-1 rounded-lg border border-surface bg-surface px-3 py-2 text-xs"
                  />
                  <button type="button" onClick={agregarCategoria} className="inline-flex items-center gap-1 rounded-lg border border-surface px-3 py-2 text-xs font-semibold hover:bg-surface-muted">
                    <Plus size={14} /> Agregar categoría
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={especialidadNueva}
                    onChange={(event) => setEspecialidadNueva(event.target.value)}
                    maxLength={100}
                    placeholder="Especialidad exacta del catálogo"
                    className="min-w-[220px] flex-1 rounded-lg border border-surface bg-surface px-3 py-2 text-xs"
                  />
                  <select value={categoriaEspecialidadNueva} onChange={(event) => setCategoriaEspecialidadNueva(event.target.value)} className="min-w-[180px] rounded-lg border border-surface bg-surface px-3 py-2 text-xs">
                    <option value="">Asignar categoría…</option>
                    {borrador.categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                  </select>
                  <button type="button" onClick={agregarEspecialidadPersonalizada} className="inline-flex items-center gap-1 rounded-lg border border-surface px-3 py-2 text-xs font-semibold hover:bg-surface-muted">
                    <Plus size={14} /> Agregar especialidad
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-graphite-800 dark:text-graphite-100">Convenios configurados</h3>
                <p className="mt-1 text-[11px] text-graphite-500">Cada convenio y tramo mantiene sus propios porcentajes (0–100%, con decimales).</p>
              </div>
              <span className="text-[11px] text-graphite-500">{borrador.convenios.filter((item) => item.activo).length} activos</span>
            </div>

            {borrador.convenios.length === 0 && (
              <p className="rounded-lg border border-dashed border-surface p-4 text-xs text-graphite-500">
                Aún no hay convenios para esta clínica. Agrega uno cuando exista un acuerdo real.
              </p>
            )}

            {borrador.convenios.map((convenio) => (
              <article key={convenio.id} className="space-y-3 rounded-xl border border-surface p-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] sm:items-end">
                  <label className="space-y-1 text-[11px] font-semibold">
                    Nombre
                    <input
                      value={convenio.nombre}
                      disabled={!esAdmin || guardando}
                      maxLength={120}
                      onChange={(event) => actualizarConvenio(convenio.id, (actual) => ({ ...actual, nombre: event.target.value }))}
                      className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal disabled:opacity-60"
                    />
                  </label>
                  <div className="text-[11px] font-semibold">{etiquetaConvenio(convenio)}</div>
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold">
                    <input
                      type="checkbox"
                      checked={convenio.activo}
                      disabled={!esAdmin || guardando}
                      onChange={(event) => actualizarConvenio(convenio.id, (actual) => ({ ...actual, activo: event.target.checked }))}
                    />
                    Activo
                  </label>
                </div>

                {esAdmin && (
                  <div className="grid gap-3 border-t border-surface pt-3 sm:grid-cols-2 lg:grid-cols-3">
                    {borrador.categorias.map((categoria) => (
                      <label key={categoria.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate">{categoria.nombre}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={convenio.descuentosPorCategoria[categoria.id] ?? 0}
                            disabled={guardando}
                            onChange={(event) => {
                              const raw = event.target.value
                              const porcentaje = raw === '' ? 0 : Number(raw)
                              if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) return
                              actualizarConvenio(convenio.id, (actual) => ({
                                ...actual,
                                descuentosPorCategoria: { ...actual.descuentosPorCategoria, [categoria.id]: porcentaje },
                              }))
                            }}
                            className="w-20 rounded-md border border-surface bg-surface px-2 py-1 text-right"
                            aria-label={`Descuento ${categoria.nombre} para ${convenio.nombre}`}
                          />
                          %
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {!esAdmin && (
                  <p className="text-[11px] text-graphite-500">
                    {borrador.categorias.map((categoria) => {
                      const porcentaje = convenio.descuentosPorCategoria[categoria.id] || 0
                      return porcentaje > 0 ? `${categoria.nombre} ${porcentaje}%` : null
                    }).filter(Boolean).join(' · ') || 'Sin descuentos configurados'}
                  </p>
                )}
              </article>
            ))}

            {esAdmin && (
              <div className="grid gap-2 rounded-xl bg-surface-muted p-3 sm:grid-cols-[1fr_160px_110px_auto] sm:items-end">
                <label className="space-y-1 text-[11px] font-semibold">
                  Nuevo convenio
                  <input value={nombreNuevo} onChange={(event) => setNombreNuevo(event.target.value)} maxLength={120} placeholder="Nombre de la entidad o plan" className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal" />
                </label>
                <label className="space-y-1 text-[11px] font-semibold">
                  Tipo
                  <select value={tipoNuevo} onChange={(event) => setTipoNuevo(event.target.value as ConvenioClinica['tipo'])} className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal">
                    <option value="isapre">ISAPRE</option>
                    <option value="fonasa">FONASA por tramo</option>
                    <option value="otro">Otro convenio</option>
                  </select>
                </label>
                {tipoNuevo === 'fonasa' && (
                  <label className="space-y-1 text-[11px] font-semibold">
                    Tramo
                    <select value={tramoNuevo} onChange={(event) => setTramoNuevo(event.target.value as 'A' | 'B' | 'C' | 'D')} className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal">
                      <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                    </select>
                  </label>
                )}
                <button type="button" onClick={agregarConvenio} className="inline-flex items-center justify-center gap-1 rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-semibold hover:bg-surface-muted">
                  <Plus size={14} /> Agregar
                </button>
              </div>
            )}
          </section>

          <PreciosEspecificosManager
            configuracion={borrador}
            esAdmin={esAdmin}
            guardando={guardando}
            onChange={(configuracion) => {
              setBorrador(configuracion)
              setMensaje(null)
            }}
          />

          {mensaje && <p role="status" className="text-xs text-graphite-600">{mensaje}</p>}
          {esAdmin && (
            <div className="flex justify-end border-t border-surface pt-3">
              <button type="button" onClick={() => void guardarConfiguracion()} disabled={guardando} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60">
                <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar configuración compartida'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
})

ConveniosManager.displayName = 'ConveniosManager'
