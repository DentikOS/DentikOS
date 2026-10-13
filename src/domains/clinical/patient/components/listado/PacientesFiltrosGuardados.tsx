import React, { useState } from 'react'
import { Star, Trash2, Plus } from 'lucide-react'
import { useFiltrosGuardados } from '../../hooks/useFiltrosGuardados'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Input } from '../../../../../shared/ui/ui/Input'

export const PacientesFiltrosGuardados: React.FC = () => {
  const { filtrosGuardados, guardarFiltro, aplicarFiltro, eliminarFiltro } = useFiltrosGuardados()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombreFiltro, setNombreFiltro] = useState('')

  const handleGuardar = () => {
    if (nombreFiltro.trim()) {
      guardarFiltro(nombreFiltro.trim())
      setNombreFiltro('')
      setMostrarForm(false)
    }
  }

  return (
    <div className="p-4 bg-surface border border-surface rounded-xl space-y-3" data-testid="filtros-guardados">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-graphite-700 dark:text-graphite-300 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
          Filtros guardados
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={Plus}
          onClick={() => setMostrarForm((prev) => !prev)}
        >
          Guardar filtro actual
        </Button>
      </div>

      {mostrarForm && (
        <div className="flex gap-2">
          <Input
            type="text"
            value={nombreFiltro}
            onChange={(e) => setNombreFiltro(e.target.value)}
            placeholder="Nombre del filtro (ej: VIP Activos)"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleGuardar()}
          />
          <Button type="button" variant="primary" size="sm" onClick={handleGuardar}>
            Guardar
          </Button>
        </div>
      )}

      {filtrosGuardados.length > 0 && (
        <div className="space-y-2">
          {filtrosGuardados.map((filtro) => (
            <div
              key={filtro.id}
              className="flex items-center justify-between px-3 py-2 bg-surface-hover rounded-lg group"
            >
              <button
                type="button"
                onClick={() => aplicarFiltro(filtro.id)}
                className="flex-1 text-left text-sm text-graphite-700 dark:text-graphite-300 hover:text-primary transition-colors"
              >
                {filtro.nombre}
              </button>
              <button
                type="button"
                onClick={() => eliminarFiltro(filtro.id)}
                className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-600 transition-opacity p-1"
                aria-label={`Eliminar filtro ${filtro.nombre}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {filtrosGuardados.length === 0 && !mostrarForm && (
        <p className="text-xs text-graphite-400">No tienes filtros guardados</p>
      )}
    </div>
  )
}
