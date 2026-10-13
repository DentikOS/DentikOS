import React, { useState, useEffect } from 'react'
import { Search, LayoutList, Table, LayoutGrid, Filter, X } from 'lucide-react'
import { Input } from '../../../../../shared/ui/ui/Input'
import { Button } from '../../../../../shared/ui/ui/Button'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'

export interface PacientesBusquedaProps {
  busqueda: string
  onBusquedaChange: (valor: string) => void
  totalResultados: number
  inputRef?: React.RefObject<HTMLInputElement | null>
  mostrarFiltros?: boolean
  onToggleFiltros?: () => void
  historial?: string[]
  onLimpiarHistorial?: () => void
}

export const PacientesBusqueda: React.FC<PacientesBusquedaProps> = ({
  busqueda,
  onBusquedaChange,
  totalResultados,
  inputRef,
  mostrarFiltros: mostrarFiltrosProp,
  onToggleFiltros,
  historial = [],
  onLimpiarHistorial,
}) => {
  const [localInput, setLocalInput] = useState(busqueda)
  const [mostrarDropdownHistorial, setMostrarDropdownHistorial] = useState(false)
  const [mostrarFiltrosInterno, setMostrarFiltrosInterno] = useState(false)

  const vistaActual = usePacientesStore((s) => s.vistaActual)
  const setVista = usePacientesStore((s) => s.setVista)
  const filtros = usePacientesStore((s) => s.filtros)
  const setFiltros = usePacientesStore((s) => s.setFiltros)

  const mostrarFiltros = mostrarFiltrosProp !== undefined ? mostrarFiltrosProp : mostrarFiltrosInterno
  const handleToggleFiltros = onToggleFiltros || (() => setMostrarFiltrosInterno((prev) => !prev))

  useEffect(() => {
    const handler = setTimeout(() => {
      onBusquedaChange(localInput)
    }, 150)
    return () => clearTimeout(handler)
  }, [localInput, onBusquedaChange])

  useEffect(() => {
    setLocalInput(busqueda)
  }, [busqueda])

  const filtroEstadoActivo = filtros.estado[0] || 'todos'

  const handleCambiarEstado = (estado: string) => {
    if (estado === 'todos') {
      setFiltros({ estado: [] })
    } else {
      setFiltros({ estado: [estado] })
    }
  }

  const tieneFiltrosActivos =
    (filtros.estado && filtros.estado.length > 0) ||
    Boolean(filtros.ultimaVisita) ||
    Boolean(filtros.proximaCita) ||
    (filtros.doctor && filtros.doctor.length > 0) ||
    Boolean(filtros.edadMin) ||
    Boolean(filtros.edadMax) ||
    (filtros.prevision && filtros.prevision.length > 0) ||
    (filtros.etiquetas && filtros.etiquetas.length > 0) ||
    Boolean(filtros.tratamiento)

  return (
    <div className="space-y-3 mb-6" data-testid="pacientes-busqueda-container">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-xl relative">
          <Input
            ref={inputRef}
            data-testid="input-busqueda-paciente"
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onFocus={() => setMostrarDropdownHistorial(true)}
            onBlur={() => setMostrarDropdownHistorial(false)}
            placeholder="Buscar por nombre, RUT, teléfono, email o ID (⌘K)..."
            icon={Search}
            iconPosition="left"
            className="w-full"
          />

          {mostrarDropdownHistorial && historial.length > 0 && !localInput && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold text-graphite-500 border-b border-surface">
                Búsquedas recientes
              </div>
              {historial.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setLocalInput(b)
                    onBusquedaChange(b)
                    setMostrarDropdownHistorial(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-graphite-700 dark:text-graphite-300 hover:bg-surface-hover transition-colors"
                >
                  {b}
                </button>
              ))}
              {onLimpiarHistorial && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onLimpiarHistorial()
                    setMostrarDropdownHistorial(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-rose-500 hover:text-rose-600 border-t border-surface transition-colors"
                >
                  Limpiar historial
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant={tieneFiltrosActivos ? 'primary' : 'secondary'}
            size="sm"
            icon={Filter}
            onClick={handleToggleFiltros}
            data-testid="btn-toggle-filtros"
          >
            Filtros
            {tieneFiltrosActivos && <span className="ml-1 w-2 h-2 rounded-full bg-amber-400" />}
          </Button>

          <div className="flex items-center p-1 bg-surface-hover/80 border border-surface rounded-xl">
            <button
              type="button"
              onClick={() => setVista('lista')}
              className={`p-1.5 rounded-lg transition-colors ${
                vistaActual === 'lista'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-graphite-500 hover:text-graphite-900 dark:hover:text-white'
              }`}
              title="Vista Lista"
              aria-label="Vista Lista"
              data-testid="vista-btn-lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setVista('tabla')}
              className={`p-1.5 rounded-lg transition-colors ${
                vistaActual === 'tabla'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-graphite-500 hover:text-graphite-900 dark:hover:text-white'
              }`}
              title="Vista Tabla"
              aria-label="Vista Tabla"
              data-testid="vista-btn-tabla"
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setVista('tarjetas')}
              className={`p-1.5 rounded-lg transition-colors ${
                vistaActual === 'tarjetas'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-graphite-500 hover:text-graphite-900 dark:hover:text-white'
              }`}
              title="Vista Tarjetas"
              aria-label="Vista Tarjetas"
              data-testid="vista-btn-tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {mostrarFiltros && onToggleFiltros === undefined && (
        <div className="p-3 bg-surface/90 border border-surface rounded-xl flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-graphite-700 dark:text-graphite-300">Estado:</span>
          {['todos', 'activo', 'nuevo', 'bloqueado', 'inactivo', 'desactivado'].map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => handleCambiarEstado(est)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                filtroEstadoActivo === est
                  ? 'bg-primary text-white font-medium'
                  : 'bg-surface-hover text-graphite-600 dark:text-graphite-400 hover:text-graphite-900'
              }`}
            >
              {est}
            </button>
          ))}

          {tieneFiltrosActivos && (
            <button
              type="button"
              onClick={() => setFiltros({ estado: [], ultimaVisita: '' })}
              className="ml-auto flex items-center gap-1 text-rose-500 hover:text-rose-600 font-medium"
            >
              <X className="w-3.5 h-3.5" /> Limpiar filtros
            </button>
          )}
        </div>
      )}

      <div className="text-xs text-graphite-400 dark:text-graphite-500">
        Mostrando <span className="font-semibold text-graphite-700 dark:text-graphite-300">{totalResultados}</span> pacientes
      </div>
    </div>
  )
}
