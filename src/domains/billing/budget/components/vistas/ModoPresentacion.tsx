import React, { useEffect } from 'react'
import { X, CheckCircle2, FileDown, Sparkles } from 'lucide-react'
import type { Presupuesto } from '../../schemas/presupuestoSchema'

interface ModoPresentacionProps {
  presupuesto: Presupuesto
  onAprobar?: () => void
  onSalir: () => void
}

export const ModoPresentacion: React.FC<ModoPresentacionProps> = ({
  presupuesto,
  onAprobar,
  onSalir,
}) => {
  // Fullscreen API & Salida con ESC
  useEffect(() => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch {
      // Fullscreen not supported or blocked in iframe
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSalir()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
      } catch {
        // Ignorar
      }
    }
  }, [onSalir])

  const total = presupuesto.totalAPagar || presupuesto.total || presupuesto.montoTotal || 0

  return (
    <div
      className="fullscreen-mode fixed inset-0 z-[9999] bg-graphite-950 text-white overflow-y-auto p-8 flex flex-col justify-between backdrop-blur-xl animate-in fade-in duration-200"
      data-testid="modo-presentacion-presupuesto"
    >
      {/* Header Presentación */}
      <div className="flex items-center justify-between pb-8 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Sparkles className="w-10 h-10 text-gold-satin animate-pulse" />
          <div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Propuesta Clínica & Plan de Tratamiento
            </h1>
            <p className="text-lg sm:text-2xl text-graphite-400 mt-1 font-medium">
              Paciente: {presupuesto.pacienteNombre} &bull; Folio: {presupuesto.folio}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSalir}
          className="min-h-[64px] min-w-[64px] px-6 rounded-2xl bg-white/10 hover:bg-rose-600/80 text-white font-extrabold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer border border-white/20 active:scale-95 shadow-xl"
          aria-label="Cerrar presentación (ESC)"
        >
          <X className="w-7 h-7" />
          <span className="hidden sm:inline">Salir (ESC)</span>
        </button>
      </div>

      <div className="my-8 max-w-4xl mx-auto w-full">
        {/* Total Inversión */}
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-gold-satin">
            Inversión Total del Plan
          </span>
          <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
            ${total.toLocaleString('es-CL')}
          </div>
        </div>
      </div>

      {/* Botones Grandes de Decisión */}
      <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs text-graphite-400">
          Presione <kbd className="px-2 py-0.5 rounded-md bg-white/10 font-mono text-[11px]">ESC</kbd> para salir
        </span>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial min-h-[64px] px-6 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors border border-white/20"
          >
            <FileDown className="w-5 h-5" /> Imprimir o guardar PDF
          </button>

          {onAprobar && (
            <button
              type="button"
              onClick={onAprobar}
              className="flex-1 sm:flex-initial min-h-[64px] px-8 rounded-2xl bg-primary hover:bg-primary/90 font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer shadow-xl transition-transform active:scale-95"
              data-testid="btn-aprobar-presentacion"
            >
              <CheckCircle2 className="w-5 h-5" /> Aprobar Plan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
