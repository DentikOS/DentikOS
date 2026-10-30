import React, { memo, useState } from 'react'
import { Pencil, Plus, Gift, Trash2 } from 'lucide-react'
import { formatearCLP } from '../../../../shared/utils/formatoMoneda'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import type { PaqueteClinico } from '../services/prestacionesStorageService'
import type { PaqueteInput } from '../hooks/usePrestaciones'

export interface PaquetesClinicosManagerProps {
  paquetes: PaqueteClinico[]
  alGuardarPaquete: (paquete: PaqueteInput) => Promise<void>
  alEliminarPaquete: (id: string | number) => Promise<void>
}

export const PaquetesClinicosManager: React.FC<PaquetesClinicosManagerProps> = memo(({
  paquetes,
  alGuardarPaquete,
  alEliminarPaquete
}) => {
  const [packEditar, setPackEditar] = useState<PaqueteClinico | null>(null)
  const { alert: dialogAlert } = useAppDialog()
  const [nombre, setNombre] = useState<string>('')
  const [descripcion, setDescripcion] = useState<string>('')
  const [precioCombo, setPrecioCombo] = useState<string>('')
  const [ahorroEstimado, setAhorroEstimado] = useState<string>('15%')
  const [error, setError] = useState('')

  const handleAbrirEditar = (pk: PaqueteClinico): void => {
    setPackEditar(pk)
    // Limpiar el prefijo de emoji si existe para editar solo el texto
    setNombre(pk.nombre ? pk.nombre : '')
    setDescripcion(pk.descripcion || '')
    setPrecioCombo(
      pk.precioCombo != null
        ? String(pk.precioCombo)
        : pk.precio != null
        ? String(pk.precio)
        : ''
    )
    setAhorroEstimado(pk.ahorroEstimado || '15%')
  }

  const handleCancelarEdicion = (): void => {
    setPackEditar(null)
    setNombre('')
    setDescripcion('')
    setPrecioCombo('')
    setAhorroEstimado('15%')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!nombre.trim() || !precioCombo) return

    // Limpieza de separadores de miles para evitar que 50.000 se convierta en 50
    const precioLimpio = parseFloat(String(precioCombo).replace(/[^0-9]/g, '')) || 0

    try {
      setError('')
      await alGuardarPaquete({
        id: packEditar ? packEditar.id : undefined,
        nombre: nombre.trim(),
        descripcion,
        precioCombo: precioLimpio,
        ahorroEstimado
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el paquete.')
      return
    }

    handleCancelarEdicion()
    await dialogAlert({
      title: 'Pack guardado',
      description: packEditar ? 'Pack modificado exitosamente.' : 'Paquete o promoción clínica creada exitosamente.',
      variant: 'success',
      confirmText: 'Entendido'
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
      {error && <p role="alert" className="col-span-full text-red-700">{error}</p>}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-6 shadow-xs space-y-3"
      >
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase">
            {packEditar ? (
              <span className="inline-flex items-center gap-1">
                <Pencil size={12} />Editar Pack / Promoción
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Plus size={12} />Crear Pack / Promoción
              </span>
            )}
          </h3>
          {packEditar && (
            <button
              type="button"
              onClick={handleCancelarEdicion}
              className="text-gray-400 dark:text-graphite-500 font-bold hover:text-black text-xs cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>

        <div>
          <label htmlFor="pack-nombre" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Nombre del Pack *
          </label>
          <input
            id="pack-nombre"
            type="text"
            required
            placeholder="Ej: Pack Ortodoncia Completa..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-bold"
          />
        </div>

        <div>
          <label htmlFor="pack-descripcion" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Descripción de lo que Incluye
          </label>
          <textarea
            id="pack-descripcion"
            rows={2}
            placeholder="Ej: Incluye instalación de aparatos + primeros 3 controles..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="pack-precio" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
              Precio Combo ($)
            </label>
            <input
              id="pack-precio"
              type="text"
              required
              placeholder="Ej: 50000"
              value={precioCombo}
              onChange={(e) => setPrecioCombo(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-black text-emerald-900 bg-emerald-50/50"
            />
          </div>
          <div>
            <label htmlFor="pack-ahorro" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
              % Ahorro
            </label>
            <input
              id="pack-ahorro"
              type="text"
              placeholder="Ej: 15%"
              value={ahorroEstimado}
              onChange={(e) => setAhorroEstimado(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-bold"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-black text-white font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors shadow-xs cursor-pointer"
        >
          {packEditar ? 'Guardar Cambios del Pack' : 'Guardar Paquete Clínico'}
        </button>
      </form>

      <div className="md:col-span-2 space-y-4">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase tracking-wider inline-flex items-center gap-2">
          <Gift size={16} />Packs y Promociones Activas ({paquetes.length})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {paquetes.map((pk) => {
            const precioMostrar = parseFloat(String(pk.precioCombo ?? pk.precio ?? 0)) || 0

            return (
              <div
                key={String(pk.id)}
                className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start border-b pb-2">
                    <h4 className="font-black text-sm text-gray-900 dark:text-graphite-50">{pk.nombre}</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAbrirEditar(pk)}
                        className="text-gray-600 dark:text-graphite-400 font-bold hover:text-black p-1 hover:bg-gray-100 dark:hover:bg-graphite-700 rounded cursor-pointer"
                        title="Editar Pack"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => { if (pk.id) void alEliminarPaquete(pk.id).catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el paquete.')) }}
                        className="text-red-500 font-bold hover:text-red-700 p-1 hover:bg-red-50 rounded cursor-pointer"
                        title="Eliminar Pack"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-graphite-400 mt-2 text-[11px] leading-relaxed">
                    {pk.descripcion}
                  </p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-black text-emerald-900 text-sm">
                    {formatearCLP(precioMostrar)}
                  </span>
                  <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg font-extrabold text-[10px]">
                    Ahorro {pk.ahorroEstimado}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

PaquetesClinicosManager.displayName = 'PaquetesClinicosManager'
