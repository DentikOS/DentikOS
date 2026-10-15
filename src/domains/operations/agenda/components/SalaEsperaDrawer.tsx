import React from 'react'
import { createPortal } from 'react-dom'
import { X, Users, Clock, XCircle, LogIn } from 'lucide-react'
import type { Cita } from '../schemas/citaSchema'

export interface SalaEsperaDrawerProps {
  open: boolean
  citasHoy: Cita[]
  alCerrar: () => void
  alCheckIn: (citaId: string | number) => void
  alLlamar: (citaId: string | number) => void
  alIniciar: (citaId: string | number) => void
  alNoShow: (citaId: string | number) => void
}

const minutosDesde = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number)
  const llegada = new Date()
  llegada.setHours(h, m, 0, 0)
  return Math.max(0, Math.floor((Date.now() - llegada.getTime()) / 60000))
}

export const SalaEsperaDrawer: React.FC<SalaEsperaDrawerProps> = ({
  open,
  citasHoy,
  alCerrar,
  alCheckIn,
  alLlamar,
  alIniciar,
  alNoShow,
}) => {
  if (!open) return null
  const enEspera = citasHoy.filter((c) => c.estado === 'En sala de espera')
  const confirmadas = citasHoy.filter((c) => c.estado === 'Confirmada')
  const enAtencion = citasHoy.filter((c) => c.estado === 'En atención')

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Sala de espera virtual">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={alCerrar} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-[420px] bg-surface border-l border-surface-border shadow-2xl flex flex-col h-full">
        <header className="sticky top-0 z-10 p-4 border-b border-surface-border flex items-center justify-between bg-gradient-to-r from-[#B88E3A]/10 to-transparent bg-surface">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B88E3A]" />
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">Sala de Espera</h2>
              <p className="text-[11px] text-slate-500">
                {enEspera.length} en espera · {enAtencion.length} en atención
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar sala de espera"
            className="p-2 rounded-lg hover:bg-surface-muted transition-colors active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sección: en espera */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Pacientes en espera
            </h3>
            {enEspera.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-surface-border text-center">
                <Clock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">Sin pacientes en espera</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Haz check-in a un paciente confirmado para traerlo aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {enEspera.map((c) => {
                  const min = minutosDesde(c.horaInicio)
                  const critica = min > 30
                  const alerta = min > 20 && min <= 30
                  return (
                    <div
                      key={String(c.id)}
                      className={`p-3 rounded-xl border ${
                        critica
                          ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                          : alerta
                          ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-surface-border bg-surface-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                          {c.pacienteNombre}
                        </p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            critica
                              ? 'bg-rose-100 text-rose-700'
                              : alerta
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {min} min
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {String(c.horaInicio).slice(0, 5)} · {c.boxAsignado || 'Sin box'} ·{' '}
                        {c.doctor || 'Sin doctor'}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => alLlamar(c.id)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 active:scale-95 transition-all cursor-pointer"
                        >
                          Llamar
                        </button>
                        <button
                          type="button"
                          onClick={() => alIniciar(c.id)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all cursor-pointer"
                        >
                          Iniciar
                        </button>
                        <button
                          type="button"
                          onClick={() => alNoShow(c.id)}
                          className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                          title="No-show"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Sección: confirmadas listas para check-in */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Confirmadas · listas para check-in
            </h3>
            {confirmadas.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                No hay citas confirmadas pendientes hoy.
              </p>
            ) : (
              <div className="space-y-2">
                {confirmadas.map((c) => (
                  <div
                    key={String(c.id)}
                    className="p-3 rounded-xl border border-surface-border bg-surface-muted/30 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                        {c.pacienteNombre}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {String(c.horaInicio).slice(0, 5)} · {c.boxAsignado || 'Sin box'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => alCheckIn(c.id)}
                      className="shrink-0 flex items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-bold bg-[#B88E3A] text-white hover:bg-[#a07a30] active:scale-95 transition-all cursor-pointer"
                    >
                      <LogIn className="w-3 h-3" /> Check-in
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body
  )
}
