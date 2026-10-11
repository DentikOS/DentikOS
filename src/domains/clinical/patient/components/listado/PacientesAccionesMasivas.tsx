import React from 'react'
import { CheckSquare, X, Download } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'

export const PacientesAccionesMasivas: React.FC = () => {
  const seleccion = usePacientesStore((s) => s.seleccion)
  const limpiarSeleccion = usePacientesStore((s) => s.limpiarSeleccion)

  if (seleccion.length === 0) return null

  const handleExportarSeleccion = () => {
    const todos = usePacientesStore.getState().pacientes
    const seleccionados = todos.filter((p) => seleccion.includes(String(p.id)))
    const lineas = [
      'Nombre,RUT,Telefono,Email,Estado',
      ...seleccionados.map(
        (p) =>
          `"${p.nombre || p.nombreCompleto || ''}","${p.rut}","${p.telefono || ''}","${p.email || ''}","${p.estado || 'activo'}"`
      ),
    ]
    const blob = new Blob([lineas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pacientes_export_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-graphite-900/95 dark:bg-graphite-800/95 text-white px-5 py-3 rounded-2xl shadow-xl backdrop-blur-md border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
      data-testid="acciones-masivas-bar"
    >
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold tabular-nums">
          {seleccion.length} seleccionado{seleccion.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="h-4 w-px bg-white/20" />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={Download}
          onClick={handleExportarSeleccion}
        >
          Exportar
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          icon={X}
          onClick={limpiarSeleccion}
          className="text-white/80 hover:text-white"
        >
          Deseleccionar
        </Button>
      </div>
    </div>
  )
}
