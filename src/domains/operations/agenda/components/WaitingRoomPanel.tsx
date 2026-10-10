import React, { memo, useMemo } from 'react'
import { Users, AlertCircle, CheckCircle2, Megaphone, Play, XCircle, Clock, Check } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { EmptyState } from '../../../../shared/ui/ui/EmptyState'

export interface PacienteEsperaItem {
  id: string | number
  citaId: string | number
  nombre: string
  horaLlegada: string
  boxAsignado?: string
  doctor?: string
  confirmadoWhatsApp?: boolean
  notificado?: boolean
  enAtencion?: boolean
}

export interface WaitingRoomPanelProps {
  pacientes: PacienteEsperaItem[]
  totalEnAtencion?: number
  totalCompletadasHoy?: number
  onAvisarPaciente?: (citaId: string | number) => void
  onIniciarAtencion?: (citaId: string | number) => void
  onMarcarNoShow?: (citaId: string | number) => void
  onLlamarSiguiente?: (citaId: string | number) => void
}

export const WaitingRoomPanel: React.FC<WaitingRoomPanelProps> = memo(({
  pacientes,
  totalEnAtencion = 0,
  totalCompletadasHoy = 0,
  onAvisarPaciente,
  onIniciarAtencion,
  onMarcarNoShow,
  onLlamarSiguiente
}) => {
  const calcularMinutosEspera = (horaLlegada: string): number => {
    try {
      const ahora = new Date()
      const [h, m] = horaLlegada.split(':').map(Number)
      const llegada = new Date()
      llegada.setHours(h, m, 0, 0)
      const diffMs = ahora.getTime() - llegada.getTime()
      return Math.max(0, Math.floor(diffMs / 60000))
    } catch {
      return 0
    }
  }

  const enEspera = useMemo(() => pacientes.filter(p => !p.enAtencion), [pacientes])

  return (
    <div className="bg-surface border border-surface-border rounded-2xl p-4 sm:p-6 space-y-6 shadow-xs" role="region" aria-label="Sala de Espera Virtual">
      {/* Encabezado y Resumen */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-surface-border pb-4">
        <div>
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B88E3A]" />
            Sala de Espera Virtual
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Control asistencial de flujo de llegada y llamada a box</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300">
            {enEspera.length} en espera
          </span>
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300">
            {totalEnAtencion} en atención
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
            {totalCompletadasHoy} completadas hoy
          </span>
        </div>
      </div>

      {/* Lista de Pacientes en Espera */}
      <div className="space-y-3">
        {enEspera.length === 0 ? (
          <EmptyState
            compact
            icon={CheckCircle2}
            title="No hay pacientes en sala de espera"
            description="Todos los pacientes han sido atendidos o no registran llegada activa."
          />
        ) : (
          enEspera.map((paciente) => {
            const minutos = calcularMinutosEspera(paciente.horaLlegada)
            const esAlertaCritica = minutos > 20

            return (
              <div
                key={String(paciente.id || paciente.citaId)}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  esAlertaCritica
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 shadow-xs'
                    : 'bg-surface-muted/30 border-surface-border hover:bg-surface-muted/60'
                }`}
              >
                {/* Info del paciente */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-[#0F172A] dark:text-white truncate">
                      {paciente.nombre}
                    </h3>
                    {paciente.confirmadoWhatsApp ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Confirmada WhatsApp
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                        Sin confirmación
                      </span>
                    )}
                    {esAlertaCritica && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3" /> &gt;20 min espera
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#B88E3A]" />
                      Llegada: <strong>{paciente.horaLlegada}</strong> ({minutos} min)
                    </span>
                    <span>Box: <strong>{paciente.boxAsignado || 'Box asignado'}</strong></span>
                    {paciente.doctor && <span>Doctor: <strong>{paciente.doctor}</strong></span>}
                  </div>
                </div>

                {/* Acciones de flujo de 3 pasos */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onLlamarSiguiente?.(paciente.citaId)}
                    icon={Megaphone}
                    title="Paso 1: Llamar paciente al box"
                  >
                    Llamar
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={paciente.notificado ? 'outline' : 'primary'}
                    onClick={() => onAvisarPaciente?.(paciente.citaId)}
                    icon={CheckCircle2}
                    title="Paso 2: Confirmar aviso de recepción"
                  >
                    {paciente.notificado ? 'Avisado' : 'Paciente avisado'}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onIniciarAtencion?.(paciente.citaId)}
                    icon={Play}
                    title="Paso 3: Pasar a En atención"
                  >
                    Iniciar atención
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => onMarcarNoShow?.(paciente.citaId)}
                    icon={XCircle}
                    title="Marcar No-show"
                  >
                    No-show
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})

WaitingRoomPanel.displayName = 'WaitingRoomPanel'
