import React from 'react'
import { MessageSquare, CheckCircle2, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'

export interface WidgetComunicacionesProps {
  sinLeerWhatsapp?: number
  porConfirmar?: number
  onIrComunicaciones?: () => void
  dragHandle?: React.ReactNode
}

export const WidgetComunicaciones: React.FC<WidgetComunicacionesProps> = ({
  sinLeerWhatsapp = 0,
  porConfirmar = 0,
  onIrComunicaciones,
  dragHandle
}) => {
  return (
    <WidgetBase
      titulo="Comunicaciones & Recall"
      icono={<MessageSquare className="w-4 h-4 text-emerald-600" />}
      borderColor="#10B981"
      dragHandle={dragHandle}
      headerAction={
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          WhatsApp activo
        </span>
      }
      footer={
        <button
          type="button"
          onClick={onIrComunicaciones}
          className="w-full flex items-center justify-center gap-1 font-semibold text-emerald-600 hover:underline cursor-pointer"
        >
          Centro de Mensajes y Confirmaciones →
        </button>
      }
    >
      <div onClick={onIrComunicaciones} className="space-y-2 cursor-pointer group">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/40 hover:bg-surface-muted border border-transparent hover:border-emerald-500/40 transition-all">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-white">Mensajes WhatsApp</p>
              <p className="text-[11px] text-slate-500">Respuestas y consultas entrantes</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
            {sinLeerWhatsapp} pendientes
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/40 hover:bg-surface-muted border border-transparent hover:border-emerald-500/40 transition-all">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-white">Confirmación de Citas</p>
              <p className="text-[11px] text-slate-500">Recordatorios automáticos 24h</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
            {porConfirmar} por enviar
          </span>
        </div>

        <div className="flex items-center justify-end text-[11px] text-slate-400 group-hover:text-emerald-600 pt-1">
          <span>Abrir bitácora</span>
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </div>
      </div>
    </WidgetBase>
  )
}
