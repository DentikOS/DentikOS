import React from 'react'
import { 
  X, 
  Calendar, 
  Users, 
  UserCheck, 
  AlertTriangle, 
  Sparkles, 
  Package, 
  DollarSign, 
  MessageSquare, 
  PlayCircle,
  LayoutGrid,
  CheckCircle2,
  Info,
  Clock
} from 'lucide-react'
import { useDashboardStore } from '../../../app/stores/useDashboardStore'
import { WIDGET_CONFIG, WIDGETS_POR_ROL } from '../../../application/analytics/dashboard/constants/dashboardConstants'
import type { WidgetType } from '../../types/dashboardTypes'

/**
 * Mapeo de tipo de widget a icono Lucide.
 * Coherente con el patrón usado en MorningBrief.tsx y AccionesRapidas.tsx.
 */
const WIDGET_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  agenda: Calendar,
  pacientes_recientes: Users,
  sala_espera: UserCheck,
  alertas_clinicas: AlertTriangle,
  esterilizacion: Sparkles,
  inventario_critico: Package,
  pagos_pendientes: DollarSign,
  comunicaciones: MessageSquare,
  quick_resume: PlayCircle,
}

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
  const visibles = widgetsDisponibles.filter((w) => w.visible).length
  const total = widgetsDisponibles.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface border border-surface-border rounded-2xl shadow-xl overflow-hidden p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B88E3A]/10 text-[#B88E3A] flex items-center justify-center shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                Personalizar Dashboard
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#B88E3A]/10 text-[#B88E3A]">
                  {visibles}/{total} visibles
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Activa o desactiva los widgets que verás en tu panel de control.
                Los cambios se guardan automáticamente y se sincronizan entre dispositivos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-surface-muted transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {widgetsDisponibles.map((widget) => {
            const config = WIDGET_CONFIG[widget.tipo as WidgetType]
            const titulo = config?.titulo || widget.id
            const IconComp = WIDGET_ICON_MAP[widget.tipo] || LayoutGrid

            // BP04 §09: Quick Resume solo aparece si hay una ficha sin cerrar < 30 min
            const esCondicional = widget.tipo === 'quick_resume'

            return (
              <label
                key={widget.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  widget.visible
                    ? 'border-[#B88E3A]/30 bg-[#B88E3A]/5 hover:bg-[#B88E3A]/10'
                    : 'border-surface-border hover:bg-surface-muted/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      widget.visible
                        ? 'bg-[#B88E3A]/10 text-[#B88E3A]'
                        : 'bg-surface-muted text-slate-400'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold truncate ${
                          widget.visible
                            ? 'text-[#0F172A] dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {titulo}
                      </span>
                      {esCondicional && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 shrink-0 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Condicional
                        </span>
                      )}
                    </div>
                    {widget.visible && !esCondicional && (
                      <span className="text-[10px] text-[#B88E3A] font-medium flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Visible en Dashboard
                      </span>
                    )}
                    {widget.visible && esCondicional && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5 block">
                        Solo visible al editar una ficha reciente
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={widget.visible}
                  onChange={() => toggleWidget(widget.id)}
                  className="w-4 h-4 text-[#B88E3A] rounded border-surface-border focus:ring-[#B88E3A] cursor-pointer shrink-0"
                />
              </label>
            )
          })}
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-surface-border mt-2">
          <div className="flex items-start gap-1.5 text-[10px] text-slate-400 max-w-[200px]">
            <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
            <span>
              También puedes arrastrar los widgets directamente en el Dashboard para reordenarlos.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#B88E3A] hover:bg-[#a07a30] transition-colors cursor-pointer shadow-xs"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
