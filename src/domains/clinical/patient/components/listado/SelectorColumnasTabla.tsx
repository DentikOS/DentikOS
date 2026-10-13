import React from 'react'
import { Settings2, Check } from 'lucide-react'

export interface ColumnaOpcional {
  id: string
  label: string
}

export const COLUMNAS_OPCIONALES: ColumnaOpcional[] = [
  { id: 'doctorTratante', label: 'Doctor tratante' },
  { id: 'tratamientosActivos', label: 'Tratamientos activos' },
  { id: 'estado', label: 'Estado' },
  { id: 'saldoPendiente', label: 'Saldo pendiente' },
  { id: 'email', label: 'Email' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'prevision', label: 'Previsión' },
  { id: 'alertasMedicas', label: 'Alertas Médicas' },
]

interface SelectorColumnasTablaProps {
  columnasVisibles: Record<string, boolean>
  onToggleColumna: (id: string) => void
  isOpen: boolean
  onClose: () => void
}

export const SelectorColumnasTabla: React.FC<SelectorColumnasTablaProps> = ({
  columnasVisibles,
  onToggleColumna,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full mt-2 z-50 w-60 p-3 bg-surface border border-surface rounded-2xl shadow-xl text-xs backdrop-blur-md animate-in fade-in zoom-in-95"
        data-testid="popover-columnas-personalizables"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 pb-2 border-b border-surface font-bold text-graphite-900 dark:text-graphite-50">
          <Settings2 className="w-3.5 h-3.5 text-primary" />
          <span>Personalizar Columnas</span>
        </div>

        <p className="text-[11px] text-graphite-400 py-1.5">
          Selecciona las columnas opcionales a visualizar:
        </p>

        <div className="space-y-1 max-h-56 overflow-y-auto">
          {COLUMNAS_OPCIONALES.map((col) => {
            const activa = Boolean(columnasVisibles[col.id])
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => onToggleColumna(col.id)}
                className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-hover text-graphite-700 dark:text-graphite-300 transition-colors text-left cursor-pointer"
                data-testid={`toggle-columna-${col.id}`}
              >
                <span>{col.label}</span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    activa ? 'bg-primary border-primary text-white' : 'border-graphite-300 dark:border-graphite-600'
                  }`}
                >
                  {activa && <Check className="w-3 h-3" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
