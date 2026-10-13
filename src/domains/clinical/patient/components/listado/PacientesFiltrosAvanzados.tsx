import React from 'react'
import { Filter, X, User, Calendar, Tag, Activity, DollarSign } from 'lucide-react'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { useDoctoresClinica } from '../../hooks/useDoctoresClinica'
import { Input } from '../../../../../shared/ui/ui/Input'
import { Button } from '../../../../../shared/ui/ui/Button'

export const PacientesFiltrosAvanzados: React.FC = () => {
  const filtros = usePacientesStore((s) => s.filtros)
  const setFiltros = usePacientesStore((s) => s.setFiltros)
  const { doctores } = useDoctoresClinica()

  const handleLimpiar = () => {
    setFiltros({
      estado: [],
      doctor: [],
      ultimaVisita: '',
      proximaCita: '',
      edadMin: '',
      edadMax: '',
      prevision: [],
      etiquetas: [],
      tratamiento: '',
    })
  }

  const estadosSeleccionados = filtros.estado || []
  const previsionSeleccionada = filtros.prevision || []

  return (
    <div className="p-4 bg-surface border border-surface rounded-xl space-y-4" data-testid="filtros-avanzados">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-graphite-900 dark:text-graphite-50 flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Filtros avanzados
        </h3>
        <Button type="button" variant="ghost" size="sm" icon={X} onClick={handleLimpiar}>
          Limpiar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Estado */}
        <div>
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2">
            Estado
          </label>
          <div className="flex flex-wrap gap-2">
            {['activo', 'nuevo', 'bloqueado', 'inactivo', 'desactivado'].map((est) => (
              <button
                key={est}
                type="button"
                onClick={() => {
                  const nuevos = estadosSeleccionados.includes(est)
                    ? estadosSeleccionados.filter((e) => e !== est)
                    : [...estadosSeleccionados, est]
                  setFiltros({ estado: nuevos })
                }}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors ${
                  estadosSeleccionados.includes(est)
                    ? 'bg-primary text-white font-medium'
                    : 'bg-surface-hover text-graphite-600 dark:text-graphite-400'
                }`}
              >
                {est}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Doctor tratante */}
        <div>
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2 flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            Doctor tratante
          </label>
          <select
            value={filtros.doctor?.[0] || ''}
            onChange={(e) => setFiltros({ doctor: e.target.value ? [e.target.value] : [] })}
            className="w-full px-3 py-2 text-sm border border-surface rounded-lg bg-surface text-graphite-900 dark:text-graphite-100"
          >
            <option value="">Todos</option>
            {doctores.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Última visita */}
        <div>
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Última visita antes de
          </label>
          <Input
            type="date"
            value={filtros.ultimaVisita || ''}
            onChange={(e) => setFiltros({ ultimaVisita: e.target.value })}
            className="w-full"
          />
        </div>

        {/* 4. Próxima cita */}
        <div>
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Próxima cita después de
          </label>
          <Input
            type="date"
            value={filtros.proximaCita || ''}
            onChange={(e) => setFiltros({ proximaCita: e.target.value })}
            className="w-full"
          />
        </div>

        {/* 5. Edad */}
        <div>
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2">
            Edad (años)
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Mín"
              min={0}
              max={120}
              value={filtros.edadMin || ''}
              onChange={(e) => setFiltros({ edadMin: e.target.value })}
              className="w-1/2"
            />
            <Input
              type="number"
              placeholder="Máx"
              min={0}
              max={120}
              value={filtros.edadMax || ''}
              onChange={(e) => setFiltros({ edadMax: e.target.value })}
              className="w-1/2"
            />
          </div>
        </div>

        {/* 6. Previsión */}
        <div>
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            Previsión
          </label>
          <div className="flex flex-wrap gap-2">
            {['Fonasa', 'Isapre', 'Particular'].map((prevision) => (
              <button
                key={prevision}
                type="button"
                onClick={() => {
                  const nuevos = previsionSeleccionada.includes(prevision)
                    ? previsionSeleccionada.filter((p) => p !== prevision)
                    : [...previsionSeleccionada, prevision]
                  setFiltros({ prevision: nuevos })
                }}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  previsionSeleccionada.includes(prevision)
                    ? 'bg-primary text-white font-medium'
                    : 'bg-surface-hover text-graphite-600 dark:text-graphite-400'
                }`}
              >
                {prevision}
              </button>
            ))}
          </div>
        </div>

        {/* 7. Etiquetas */}
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            Etiquetas
          </label>
          <Input
            type="text"
            placeholder="Filtrar por etiqueta (ej: VIP, Control)"
            value={filtros.etiquetas?.[0] || ''}
            onChange={(e) => setFiltros({ etiquetas: e.target.value ? [e.target.value] : [] })}
            className="w-full"
          />
        </div>

        {/* 8. Tratamiento activo */}
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-graphite-600 dark:text-graphite-400 block mb-2 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            Tratamiento activo
          </label>
          <Input
            type="text"
            placeholder="Filtrar por tratamiento (ej: Ortodoncia, Endodoncia)"
            value={filtros.tratamiento || ''}
            onChange={(e) => setFiltros({ tratamiento: e.target.value })}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
