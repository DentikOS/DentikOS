/**
 * Barra de filtros para el vademécum.
 * Incluye búsqueda por texto, filtro por familia y toggle de activos.
 * F4-03f-2 (refactorización)
 */
import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'

export interface FiltrosVademecumProps {
  familiasDisponibles: string[]
  familiaSeleccionada: string
  setFamiliaSeleccionada: (familia: string) => void
  textoBusqueda: string
  setTextoBusqueda: (texto: string) => void
  soloActivos: boolean
  setSoloActivos: (activos: boolean) => void
  onCrearNuevo?: () => void
}

export const FiltrosVademecum: React.FC<FiltrosVademecumProps> = ({
  familiasDisponibles,
  familiaSeleccionada,
  setFamiliaSeleccionada,
  textoBusqueda,
  setTextoBusqueda,
  soloActivos,
  setSoloActivos,
  onCrearNuevo
}) => {
  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-graphite-700 bg-gray-50 dark:bg-graphite-800 space-y-3">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-graphite-50">
          Vademécum Odontológico Regular
        </h3>
        {onCrearNuevo && (
          <Button
            onClick={onCrearNuevo}
            icon={Plus}
            size="sm"
          >
            Nuevo fármaco
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Búsqueda */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={textoBusqueda}
            onChange={(e) => {
              setTextoBusqueda(e.target.value)
            }}
            placeholder="Buscar por nombre genérico, comercial o presentación..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-graphite-600 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Filtro de familia */}
        <select
          value={familiaSeleccionada}
          onChange={(e) => setFamiliaSeleccionada(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-graphite-600 rounded-lg text-sm bg-white dark:bg-graphite-800 focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Todas las familias</option>
          {familiasDisponibles.map((familia) => (
            <option key={familia} value={familia}>
              {familia.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        {/* Toggle activos */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-graphite-300 cursor-pointer">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={() => setSoloActivos(!soloActivos)}
            className="rounded border-gray-300 dark:border-graphite-600 text-primary focus:ring-primary"
          />
          <span>Solo activos</span>
        </label>
      </div>
    </div>
  )
}
