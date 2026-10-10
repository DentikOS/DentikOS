import React, { memo } from 'react'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { BOXES_DENTALES } from '../constants/agendaConstants'

export interface DoctorOption {
  id: string | number
  nombre: string
}

export interface AgendaFiltersProps {
  doctors?: (DoctorOption | string)[]
  boxes?: { id: string; nombre: string }[]
}

export const AgendaFilters: React.FC<AgendaFiltersProps> = memo(({ doctors = [], boxes = BOXES_DENTALES }) => {
  const selectedDoctor = useAgendaStore((state) => state.selectedDoctor)
  const setDoctor = useAgendaStore((state) => state.setDoctor)
  const selectedBox = useAgendaStore((state) => state.selectedBox)
  const setBox = useAgendaStore((state) => state.setBox)

  const userProfile = useSesionStore((state) => state.userProfile)
  const esDentista = userProfile?.rol?.toLowerCase() === 'dentista'
  const nombreUsuario = userProfile?.nombreCompleto || 'Solo yo'

  const doctoresNormalizados = doctors.map((d) => (typeof d === 'string' ? { id: d, nombre: d } : d))

  return (
    <div className="flex flex-wrap items-center gap-3 bg-surface p-3 border border-surface rounded-xl text-xs">
      {/* Filtro por Doctor */}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-doctor" className="font-semibold text-graphite-600 dark:text-graphite-300">
          Doctor:
        </label>
        <select
          id="filter-doctor"
          value={selectedDoctor}
          onChange={(e) => setDoctor(e.target.value)}
          className="p-1.5 border rounded-lg bg-graphite-50 dark:bg-graphite-900 border-surface font-medium text-graphite-900 dark:text-graphite-100"
        >
          <option value="Todos">Todos los doctores</option>
          {esDentista && <option value={nombreUsuario}>Solo yo ({nombreUsuario})</option>}
          {doctoresNormalizados.map((doc) => (
            <option key={String(doc.id)} value={doc.nombre}>
              {doc.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Filtro por Box */}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-box" className="font-semibold text-graphite-600 dark:text-graphite-300">
          Box / Sillón:
        </label>
        <select
          id="filter-box"
          value={selectedBox}
          onChange={(e) => setBox(e.target.value)}
          className="p-1.5 border rounded-lg bg-graphite-50 dark:bg-graphite-900 border-surface font-medium text-graphite-900 dark:text-graphite-100"
        >
          <option value="Todos">Todos los boxes</option>
          {boxes.map((b) => (
            <option key={b.id} value={b.nombre}>
              {b.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
})

AgendaFilters.displayName = 'AgendaFilters'
