import React, { memo, useState } from 'react'
import { Download } from 'lucide-react'
import { BOXES_DENTALES } from '../constants/agendaConstants'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'

export interface AgendaDoctorItem {
  id?: string | number
  nombre: string
}

export interface AgendaViewSelectorProps {
  fechaSeleccionadaIso: string
  setFechaSeleccionadaIso: (fecha: string) => void
  boxFiltro: string
  setBoxFiltro: (box: string) => void
  doctorFiltro?: string
  setDoctorFiltro?: (doc: string) => void
  doctoresDisponibles?: (string | AgendaDoctorItem)[]
  vista?: string
  setVista?: (vista: string) => void
  onExportarCSV?: () => void
  onBusquedaChange?: (busqueda: string) => void
}

export const AgendaViewSelector: React.FC<AgendaViewSelectorProps> = memo(({
  fechaSeleccionadaIso,
  setFechaSeleccionadaIso,
  boxFiltro,
  setBoxFiltro,
  doctorFiltro,
  setDoctorFiltro,
  doctoresDisponibles = [],
  vista = 'box',
  setVista,
  onExportarCSV,
  onBusquedaChange
}) => {
  // F7-27: Estado de búsqueda con debounce
  const [busquedaLocal, setBusquedaLocal] = useState<string>('')

  const handleBusquedaChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const valor = e.target.value
    setBusquedaLocal(valor)
    if (onBusquedaChange) onBusquedaChange(valor)
  }

  const handleHoy = (): void => {
    setFechaSeleccionadaIso(obtenerFechaLocalISO())
  }

  return (
    <div className="bg-surface p-4 border border-surface rounded-2xl flex justify-between items-center flex-wrap gap-3 text-xs print:hidden">
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        {/* F7-27: Búsqueda avanzada */}
        <input
          type="search"
          placeholder="Buscar paciente, RUT, tratamiento..."
          value={busquedaLocal}
          onChange={handleBusquedaChange}
          className="px-3 py-2 border rounded-xl bg-graphite-50 dark:bg-graphite-950 surgical:bg-white border-surface font-medium text-xs text-graphite-900 dark:text-graphite-50 surgical:text-black placeholder-graphite-400 min-w-[200px] focus:ring-2 focus:ring-clinical-info focus:border-transparent"
          aria-label="Buscar en agenda"
        />

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-600 dark:text-graphite-400 surgical:text-black">Fecha:</span>
          <input
            type="date"
            value={fechaSeleccionadaIso}
            onChange={(e) => setFechaSeleccionadaIso(e.target.value)}
            className="p-2 border rounded-xl bg-graphite-50 dark:bg-graphite-950 surgical:bg-white border-surface font-bold text-xs text-graphite-900 dark:text-graphite-50 surgical:text-black"
          />
          <button
            type="button"
            onClick={handleHoy}
            className="px-3 py-2 bg-graphite-50 dark:bg-graphite-950 surgical:bg-white border border-surface rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-graphite-800 text-gray-800 dark:text-graphite-100 surgical:text-black transition-colors duration-150 cursor-pointer"
          >
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
          <span className="font-semibold text-gray-600 dark:text-graphite-400 surgical:text-black">Sillón / Box:</span>
          <select
            value={boxFiltro}
            onChange={(e) => setBoxFiltro(e.target.value)}
            className="p-2 border rounded-xl bg-graphite-50 dark:bg-graphite-950 surgical:bg-white border-surface font-bold text-xs text-graphite-900 dark:text-graphite-50 surgical:text-black"
          >
            <option value="Todos">Todos los Boxes Sillones</option>
            {BOXES_DENTALES.map(b => (
              <option key={b.id} value={b.nombre}>{b.nombre}</option>
            ))}
          </select>
        </div>

        {doctoresDisponibles.length > 0 && setDoctorFiltro && (
          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <span className="font-semibold text-gray-600 dark:text-graphite-400 surgical:text-black">Doctor:</span>
            <select
              value={doctorFiltro}
              onChange={(e) => setDoctorFiltro(e.target.value)}
              className="p-2 border rounded-xl bg-graphite-50 dark:bg-graphite-950 surgical:bg-white border-surface font-bold text-xs text-graphite-900 dark:text-graphite-50 surgical:text-black"
            >
              <option value="Todos">Todos los Odontólogos</option>
              {doctoresDisponibles.map(doc => {
                const nombreDoc = typeof doc === 'string' ? doc : doc.nombre
                return (
                  <option key={nombreDoc} value={nombreDoc}>{nombreDoc}</option>
                )
              })}
            </select>
          </div>
        )}
      </div>

      {/* F7-27: Selector de vista y botón exportar */}
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-600 dark:text-graphite-400 surgical:text-black">Vista:</span>
          <select
            value={vista}
            onChange={(e) => setVista && setVista(e.target.value)}
            className="p-2 border rounded-xl bg-graphite-50 dark:bg-graphite-950 surgical:bg-white border-surface font-bold text-xs text-graphite-900 dark:text-graphite-50 surgical:text-black"
            aria-label="Seleccionar vista de agenda"
          >
            <option value="day">Vista Día (Timeline)</option>
            <option value="box">Por Box</option>
            <option value="lista">Lista</option>
            <option value="profesional">Por Profesional</option>
          </select>
        </div>

        {onExportarCSV && (
          <button
            type="button"
            onClick={onExportarCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-graphite-50 dark:bg-graphite-950 surgical:bg-white border border-surface rounded-xl font-bold text-xs text-gray-800 dark:text-graphite-100 surgical:text-black hover:bg-gray-50 dark:hover:bg-graphite-800 transition-colors cursor-pointer"
            aria-label="Exportar agenda a CSV"
          >
            <Download size={12} />
            Exportar
          </button>
        )}
      </div>
    </div>
  )
})

AgendaViewSelector.displayName = 'AgendaViewSelector'
