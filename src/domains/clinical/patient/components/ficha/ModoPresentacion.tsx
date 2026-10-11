import React, { useEffect } from 'react'
import { Sparkles, X, HeartPulse, Check, LogOut, Phone, Calendar } from 'lucide-react'
import type { Paciente } from '../../schemas/pacienteSchema'

interface ModoPresentacionProps {
  paciente: Paciente
  onSalir: () => void
}

export const ModoPresentacion: React.FC<ModoPresentacionProps> = ({ paciente, onSalir }) => {
  useEffect(() => {
    const entrarFullscreen = async () => {
      try {
        const elem = document.documentElement
        if (elem.requestFullscreen && !document.fullscreenElement) {
          await elem.requestFullscreen()
        }
      } catch {
        // Fullscreen bloqueado o no soportado en contexto de test
      }
    }
    entrarFullscreen()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSalir()
      }
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

  const nombre = paciente.nombreCompleto || paciente.nombre || 'Paciente'
  const rut = paciente.rut || 'Sin RUT'
  const edad = paciente.edad ? `${paciente.edad} años` : ''
  const prevision = paciente.prevision || 'Particular'

  return (
    <div
      className="fullscreen-mode fixed inset-0 z-[9999] bg-graphite-950 text-white overflow-y-auto p-8 flex flex-col justify-between backdrop-blur-xl animate-in fade-in duration-200"
      data-testid="modo-presentacion-fullscreen"
    >
      {/* Header Presentación — Título 32-48px */}
      <div className="flex items-center justify-between pb-8 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-9 h-9 text-gold-satin animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Studio Dental &bull; Ficha Clínica
            </h1>
            <p className="text-lg sm:text-2xl text-graphite-400 mt-1 font-medium">
              Modo Exposición Box Clínico &bull; {nombre} ({rut})
            </p>
          </div>
        </div>

        {/* Botón Salir Grande (Mínimo 64x64px) */}
        <button
          type="button"
          onClick={onSalir}
          className="min-h-[64px] min-w-[64px] px-6 rounded-2xl bg-white/10 hover:bg-rose-600/80 text-white font-extrabold text-base flex items-center gap-3 transition-all cursor-pointer border border-white/20 active:scale-95 shadow-xl"
          data-testid="btn-salir-presentacion"
          aria-label="Salir del Modo Presentación (ESC)"
        >
          <LogOut className="w-7 h-7" />
          <span className="hidden sm:inline">Salir (ESC)</span>
        </button>
      </div>

      {/* Contenido Central 24px */}
      <div className="my-8 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Tarjeta Identificación */}
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-gold-satin">
            Identificación del Paciente
          </span>
          <p className="text-2xl sm:text-3xl font-black text-white">{nombre}</p>
          <div className="space-y-2 text-lg text-graphite-300">
            <p>RUT: <span className="font-mono font-bold text-white">{rut}</span></p>
            {edad && <p>Edad: <span className="font-bold text-white">{edad}</span></p>}
            <p>Convenio: <span className="font-bold text-emerald-400">{prevision}</span></p>
          </div>
        </div>

        {/* Alertas Críticas Médicas */}
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-rose-400 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-rose-500" /> Alertas Médicas
          </span>
          <div className="space-y-3 text-lg">
            {paciente.alergias ? (
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-200 font-bold">
                Alergias: {Array.isArray(paciente.alergias) ? paciente.alergias.join(', ') : paciente.alergias}
              </div>
            ) : (
              <p className="text-graphite-400 text-base">Sin alergias severas registradas</p>
            )}
            {paciente.anticoagulantes && (
              <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-200 font-bold">
                ⚠️ Uso de Anticoagulantes
              </div>
            )}
          </div>
        </div>

        {/* Estado Clínico */}
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Atención Dental Activa
          </span>
          <p className="text-2xl font-bold text-white">Consulta Odontológica</p>
          <p className="text-base text-graphite-300 leading-relaxed">
            Visualización adaptada a pantalla completa para explicación interactiva junto al sillón dental.
          </p>
        </div>
      </div>

      {/* Footer con Botones Grandes (mínimo 64px) */}
      <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-base text-graphite-400">
          Pulse <kbd className="px-3 py-1 rounded-lg bg-white/15 font-mono text-sm text-white">ESC</kbd> para salir en cualquier momento
        </span>

        <button
          type="button"
          onClick={onSalir}
          className="min-h-[64px] px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white font-extrabold text-lg flex items-center justify-center gap-3 cursor-pointer shadow-2xl transition-transform active:scale-95"
        >
          <Check className="w-6 h-6" /> Entendido & Salir
        </button>
      </div>
    </div>
  )
}
