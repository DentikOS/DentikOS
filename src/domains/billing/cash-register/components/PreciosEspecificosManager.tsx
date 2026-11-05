import React, { memo, useMemo, useState } from 'react'
import { usePrestacionesStore } from '../../../../app/stores/prestacionesStore'
import { useSedes } from '../../../organization/clinic/hooks/useSedes'
import type {
  ConfiguracionConvenios,
  PrecioEspecificoPrestacion,
} from '../../../organization/clinic/schemas/configuracionConveniosSchema'

interface PreciosEspecificosManagerProps {
  configuracion: ConfiguracionConvenios
  esAdmin: boolean
  guardando: boolean
  onChange: (configuracion: ConfiguracionConvenios) => void
}

const clavePrecio = (precio: PrecioEspecificoPrestacion): string =>
  `${precio.prestacionId}:${precio.alcance}:${precio.contextoId}`

export const PreciosEspecificosManager: React.FC<PreciosEspecificosManagerProps> = memo(({
  configuracion,
  esAdmin,
  guardando,
  onChange,
}) => {
  const prestaciones = usePrestacionesStore((state) => state.prestacionesArancel)
  const estadoArancel = usePrestacionesStore((state) => state.estadoRemoto)
  const { sedes, cargando: cargandoSedes, errorSincronizacion } = useSedes()
  const [alcance, setAlcance] = useState<PrecioEspecificoPrestacion['alcance']>('convenio')
  const [contextoId, setContextoId] = useState('')
  const [prestacionId, setPrestacionId] = useState('')
  const [precio, setPrecio] = useState('')
  const [editandoClave, setEditandoClave] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const precios = configuracion.preciosEspecificos ?? []
  const prestacionesOrdenadas = useMemo(
    () => [...prestaciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CL')),
    [prestaciones],
  )
  const prestacionesPorId = useMemo(
    () => new Map(prestaciones.map((item) => [String(item.id), item.nombre])),
    [prestaciones],
  )
  const conveniosPorId = useMemo(
    () => new Map(configuracion.convenios.map((item) => [item.id, item.nombre])),
    [configuracion.convenios],
  )
  const sedesPorId = useMemo(
    () => new Map(sedes.map((item) => [item.id || '', item.nombre])),
    [sedes],
  )
  const arancelListo = estadoArancel === 'listo'
  const sucursalesListas = alcance !== 'sucursal' || (!cargandoSedes && !errorSincronizacion)

  const cambiarAlcance = (nuevoAlcance: PrecioEspecificoPrestacion['alcance']): void => {
    setAlcance(nuevoAlcance)
    setContextoId('')
    setEditandoClave(null)
    setMensaje(null)
  }

  const guardarPrecio = (): void => {
    const monto = Number(precio)
    if (!esAdmin || guardando) return
    if (!arancelListo || !sucursalesListas) {
      setMensaje('Espera a que se sincronicen el arancel y las sucursales antes de guardar precios.')
      return
    }
    if (!prestacionId || !contextoId || precio.trim() === '' || !Number.isSafeInteger(monto) || monto < 0 || monto > 2_147_483_647) {
      setMensaje('Selecciona el contexto y la prestación, e indica un precio entero entre $0 y $2.147.483.647.')
      return
    }

    const nuevo: PrecioEspecificoPrestacion = {
      prestacionId,
      alcance,
      contextoId,
      precio: monto,
    }
    const restantes = precios.filter((item) => clavePrecio(item) !== clavePrecio(nuevo))
    onChange({ ...configuracion, preciosEspecificos: [...restantes, nuevo] })
    setPrecio('')
    setEditandoClave(null)
    setMensaje(null)
  }

  const editar = (item: PrecioEspecificoPrestacion): void => {
    setAlcance(item.alcance)
    setContextoId(item.contextoId)
    setPrestacionId(item.prestacionId)
    setPrecio(String(item.precio))
    setEditandoClave(clavePrecio(item))
    setMensaje(null)
  }

  const quitar = (item: PrecioEspecificoPrestacion): void => {
    if (!esAdmin || guardando) return
    onChange({
      ...configuracion,
      preciosEspecificos: precios.filter((actual) => clavePrecio(actual) !== clavePrecio(item)),
    })
    if (editandoClave === clavePrecio(item)) {
      setEditandoClave(null)
      setPrecio('')
    }
    setMensaje(null)
  }

  const etiquetaContexto = (item: PrecioEspecificoPrestacion): string =>
    item.alcance === 'convenio'
      ? conveniosPorId.get(item.contextoId) || 'Convenio eliminado'
      : sedesPorId.get(item.contextoId) || 'Sucursal no disponible'

  return (
    <section className="space-y-3 rounded-xl border border-surface p-4" aria-labelledby="precios-especificos-title">
      <div>
        <h3 id="precios-especificos-title" className="text-xs font-bold text-graphite-800 dark:text-graphite-100">
          Precios fijos por prestación
        </h3>
        <p className="mt-1 text-[11px] text-graphite-500 dark:text-graphite-400">
          Un precio fijo de convenio tiene prioridad sobre el descuento por categoría. Si no hay regla de convenio, se considera el precio de sucursal antes del arancel general. El precio se copia al presupuesto al agregar la prestación.
        </p>
      </div>

      {esAdmin && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[130px_1fr_1.5fr_150px_auto] lg:items-end">
          <label className="space-y-1 text-[11px] font-semibold">
            Alcance
            <select
              value={alcance}
              disabled={guardando}
              onChange={(event) => cambiarAlcance(event.target.value as PrecioEspecificoPrestacion['alcance'])}
              className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal"
            >
              <option value="convenio">Convenio</option>
              <option value="sucursal">Sucursal</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold">
            {alcance === 'convenio' ? 'Convenio' : 'Sucursal'}
            <select
              value={contextoId}
              disabled={guardando || !sucursalesListas}
              onChange={(event) => setContextoId(event.target.value)}
              className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal"
            >
              <option value="">Seleccionar…</option>
              {alcance === 'convenio'
                ? configuracion.convenios.map((item) => (
                    <option key={item.id} value={item.id}>{item.nombre}{item.activo ? '' : ' · Inactivo'}</option>
                  ))
                : sedes.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold">
            Prestación del arancel
            <select
              value={prestacionId}
              disabled={guardando || !arancelListo}
              onChange={(event) => setPrestacionId(event.target.value)}
              className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal"
            >
              <option value="">Seleccionar…</option>
              {prestacionesOrdenadas.map((item) => (
                <option key={item.id} value={String(item.id)}>{item.nombre}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold">
            Precio fijo (CLP)
            <input
              type="number"
              min="0"
              max="2147483647"
              step="1"
              value={precio}
              disabled={guardando}
              onChange={(event) => setPrecio(event.target.value)}
              className="w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs font-normal"
            />
          </label>
          <button
            type="button"
            onClick={guardarPrecio}
            disabled={guardando || !sucursalesListas || !arancelListo}
            className="rounded-lg border border-surface px-3 py-2 text-xs font-semibold hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editandoClave ? 'Actualizar precio' : 'Agregar precio'}
          </button>
        </div>
      )}

      {cargandoSedes && <p role="status" className="text-[11px] text-graphite-500">Sincronizando sucursales…</p>}
      {errorSincronizacion && alcance === 'sucursal' && <p role="alert" className="text-[11px] text-rose-700">{errorSincronizacion}</p>}
      {(estadoArancel === 'pendiente' || estadoArancel === 'cargando') && <p role="status" className="text-[11px] text-graphite-500">Sincronizando el arancel…</p>}
      {estadoArancel === 'error' && <p role="alert" className="text-[11px] text-rose-700">
        No se pudo sincronizar el arancel. <button type="button" onClick={() => void usePrestacionesStore.getState().sincronizarDesdeSupabase()} className="underline">Reintentar</button>
      </p>}

      {precios.length === 0 ? (
        <p className="rounded-lg border border-dashed border-surface p-3 text-[11px] text-graphite-500">No hay precios fijos configurados.</p>
      ) : (
        <ul className="divide-y divide-surface rounded-lg border border-surface">
          {precios.map((item) => (
            <li key={clavePrecio(item)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
              <span className="min-w-0 flex-1">
                <strong>{prestacionesPorId.get(item.prestacionId) || `Prestación ${item.prestacionId}`}</strong>
                <span className="text-graphite-500"> · {item.alcance === 'convenio' ? 'Convenio' : 'Sucursal'}: {etiquetaContexto(item)} · ${item.precio.toLocaleString('es-CL')}</span>
              </span>
              {esAdmin && (
                <span className="flex gap-2">
                  <button type="button" disabled={guardando} onClick={() => editar(item)} className="font-semibold text-primary disabled:opacity-50">Editar</button>
                  <button type="button" disabled={guardando} onClick={() => quitar(item)} className="font-semibold text-rose-700 disabled:opacity-50">Quitar</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {mensaje && <p role="status" className="text-[11px] text-graphite-600 dark:text-graphite-300">{mensaje}</p>}
      {esAdmin && <p className="text-[10px] text-graphite-500">Los cambios se aplican al guardar la configuración compartida de esta clínica.</p>}
    </section>
  )
})

PreciosEspecificosManager.displayName = 'PreciosEspecificosManager'
