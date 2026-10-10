import React from 'react'
import { X, Check } from 'lucide-react'
import { useDashboardStore } from '../../../app/stores/useDashboardStore'
import { WIDGET_CONFIG, WIDGETS_POR_ROL } from '../../../application/analytics/dashboard/constants/dashboardConstants'
import type { WidgetType } from '../../types/dashboardTypes'

export interface ConfigurarWidgetsModalProps {
  isOpen: boolean
  onClose: () => void
  userRole?: string
}

export const ConfigurarWidgetsModal: React.FC<ConfigurarWidgetsModalProps> = ({
  isOpen,
  onClose,
  userRole = 'admin'
}) => {
  const { widgets, toggleWidget } = useDashboardStore()
  if (!isOpen) return null

  const permitidos = new Set(WIDGETS_POR_ROL[userRole] || WIDGETS_POR_ROL.admin || [])
  const widgetsDisponibles = widgets.filter((w) => permitidos.has(w.tipo as WidgetType))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface border border-surface-border rounded-2xl shadow-xl overflow-hidden p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
              Personalizar Dashboard
            </h3>
            <p className="text-xs text-slate-500">Selecciona los widgets que deseas ver en pantalla</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-surface-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {widgetsDisponibles.map((widget) => {
            const config = WIDGET_CONFIG[widget.tipo as WidgetType]
            const titulo = config?.titulo || widget.id

            return (
              <label
                key={widget.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-surface-border hover:bg-surface-muted/50 cursor-pointer transition-colors"
              >
                <span className="text-xs font-semibold text-[#0F172A] dark:text-white truncate">
                  {titulo}
                </span>
                <input
                  type="checkbox"
                  checked={widget.visible}
                  onChange={() => toggleWidget(widget.id)}
                  className="w-4 h-4 text-[#B88E3A] rounded border-surface-border focus:ring-[#B88E3A]"
                />
              </label>
            )
          })}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#B88E3A] hover:bg-[#a07a30] transition-colors cursor-pointer"
          >
            Guardar y cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
