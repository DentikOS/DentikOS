import React, { useEffect, useState } from 'react'
import { Clock, FileText, CreditCard, ShieldCheck, Pill, Calendar, Activity, ShieldAlert } from 'lucide-react'
import { timelineService, type EventoTimeline } from '../../services/timelineService'
import { Badge } from '../../../../../shared/ui/ui/Badge'

interface TimelineProps {
  pacienteId: string | number
}

const ICONOS_TIPO: Record<string, React.ElementType> = {
  evolucion: FileText,
  pago: CreditCard,
  consentimiento: ShieldCheck,
  receta: Pill,
  cita: Calendar,
  presupuesto: Activity,
  cambio_estado: ShieldAlert,
  admin: ShieldAlert,
}

const BADGES_TIPO: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }> = {
  evolucion: { label: 'Evolución', variant: 'info' },
  pago: { label: 'Pago / Abono', variant: 'success' },
  consentimiento: { label: 'Consentimiento', variant: 'warning' },
  receta: { label: 'Receta', variant: 'info' },
  cita: { label: 'Cita Clínica', variant: 'neutral' },
  presupuesto: { label: 'Presupuesto', variant: 'warning' },
  cambio_estado: { label: 'Estado', variant: 'warning' },
  admin: { label: 'Administrativo', variant: 'warning' },
}

export const Timeline: React.FC<TimelineProps> = ({ pacienteId }) => {
  const [eventos, setEventos] = useState<EventoTimeline[]>(() => timelineService.obtenerTimeline(pacienteId))
  useEffect(() => {
    let vigente = true
    setEventos(timelineService.obtenerTimeline(pacienteId))
    timelineService.cargarTimeline(pacienteId).then((cargados) => {
      if (vigente) setEventos(cargados)
    }).catch(() => {})
    return () => { vigente = false }
  }, [pacienteId])

  return (
    <div className="space-y-6" data-testid="timeline-paciente">
      <div className="p-5 bg-surface/90 border border-surface rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            Línea de Tiempo y Actividades Clínicas
          </h3>
        </div>
        <p className="text-xs text-graphite-500 mt-1">
          Registro cronológico auditado de atenciones, pagos, evoluciones y consentimientos.
        </p>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-border">
        {eventos.map((evento) => {
          const Icono = ICONOS_TIPO[evento.tipo] || Activity
          const badgeConfig = BADGES_TIPO[evento.tipo] || { label: evento.tipo, variant: 'primary' }
          const fechaFormateada = new Date(evento.fecha).toLocaleDateString('es-CL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div key={evento.id} className="relative flex items-start gap-4" data-testid="item-timeline">
              <div className="absolute -left-6 top-1 w-6 h-6 rounded-full bg-surface border border-primary flex items-center justify-center text-primary shadow-xs">
                <Icono className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 p-4 bg-surface/80 border border-surface rounded-xl shadow-xs space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-graphite-900 dark:text-graphite-100">
                      {evento.titulo}
                    </span>
                    <Badge variant={badgeConfig.variant}>{badgeConfig.label}</Badge>
                  </div>
                  <span className="text-[11px] font-mono text-graphite-400">{fechaFormateada}</span>
                </div>

                {(evento.profesional || evento.usuario) && (
                  <p className="text-xs text-graphite-500 font-medium">Profesional: {evento.profesional || evento.usuario}</p>
                )}

                {evento.detalles && (
                  <p className="text-xs text-graphite-700 dark:text-graphite-300 bg-canvas/60 p-2.5 rounded-lg border border-surface">
                    {evento.detalles}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
