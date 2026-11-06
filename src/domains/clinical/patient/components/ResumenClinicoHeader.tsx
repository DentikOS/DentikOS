import React from 'react'
import {
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { Icon } from '../../../../shared/ui/Icon'

import type { UseMetricasClinicasReturn, ProximaCitaResumen, AlertaClinica } from '../hooks/useMetricasClinicas'

export type AlertaClinicaActiva = AlertaClinica
export type ProximaCitaRef = ProximaCitaResumen
export type MetricasClinicasRef = UseMetricasClinicasReturn

export interface ResumenClinicoHeaderProps {
  metricas?: MetricasClinicasRef | null
  onNavegarTab?: (tab: string) => void
}

interface TarjetaMetricaProps {
  icono: LucideIcon
  label: string
  valor: React.ReactNode
  sublabel?: string
  color?: 'graphite' | 'azul' | 'verde' | 'ambar' | 'rojo'
  ariaLabel?: string
  onClick?: () => void
}

const TarjetaMetrica: React.FC<TarjetaMetricaProps> = ({
  icono,
  label,
  valor,
  sublabel,
  color = 'graphite',
  ariaLabel,
  onClick
}) => {
  const colorClasses = {
    graphite: 'text-graphite-700 dark:text-graphite-300 bg-graphite-100 dark:bg-graphite-800',
    azul: 'text-clinical-info dark:text-sky-300 bg-clinical-info/10 dark:bg-sky-400/15',
    verde: 'text-clinical-success dark:text-emerald-300 bg-clinical-success/10 dark:bg-emerald-400/15',
    ambar: 'text-clinical-warning dark:text-amber-300 bg-clinical-warning/10 dark:bg-amber-400/15',
    rojo: 'text-clinical-error dark:text-red-300 bg-clinical-error/10 dark:bg-red-400/15',
  }

  const esClickeable = typeof onClick === 'function'

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (esClickeable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick!()
    }
  }

  return (
    <div
      role={esClickeable ? 'button' : 'region'}
      tabIndex={esClickeable ? 0 : undefined}
      aria-label={ariaLabel || label}
      onClick={esClickeable ? onClick : undefined}
      onKeyDown={esClickeable ? handleKeyDown : undefined}
      className={`relative overflow-hidden bg-surface/90 backdrop-blur-md border border-surface rounded-2xl p-3.5 flex items-start gap-3 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A]/30 before:to-transparent ${
        esClickeable ? 'cursor-pointer' : ''
      }`}
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
        <Icon icon={icono} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-graphite-500 dark:text-graphite-400  mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold text-graphite-900 dark:text-graphite-50  truncate tabular-nums">
          {valor}
        </p>
        {sublabel && (
          <p className="text-[10px] text-graphite-500 dark:text-graphite-400  truncate mt-0.5 tabular-nums">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  )
}

export const ResumenClinicoHeader: React.FC<ResumenClinicoHeaderProps> = ({ metricas, onNavegarTab }) => {
  if (!metricas) return null

  const {
    ultimaVisita,
    diasDesdeUltimaVisita = null,
    totalVisitas = 0,
    proximaCita,
    presupuestoPendienteFormateado = '$0',
    progresoTratamiento = 0,
    itemsRealizados = 0,
    totalItems = 0,
    alertasActivas = [],
  } = metricas

  // Formato de fecha para mostrar
  const formatoFecha = (fecha?: Date | null): string => {
    if (!fecha) return '—'
    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  // Determinar color de "última visita" según antigüedad
  const colorUltimaVisita =
    diasDesdeUltimaVisita === null || diasDesdeUltimaVisita === undefined
      ? 'graphite'
      : diasDesdeUltimaVisita <= 30
      ? 'verde'
      : diasDesdeUltimaVisita <= 180
      ? 'ambar'
      : 'rojo'

  const textoUltimaVisita =
    diasDesdeUltimaVisita === null || diasDesdeUltimaVisita === undefined
      ? 'Sin registros'
      : diasDesdeUltimaVisita === 0
      ? 'Hoy'
      : diasDesdeUltimaVisita === 1
      ? 'Ayer'
      : `Hace ${diasDesdeUltimaVisita} días`

  // Color de presupuesto pendiente
  const colorPresupuesto =
    progresoTratamiento === 100
      ? 'verde'
      : progresoTratamiento >= 50
      ? 'ambar'
      : 'graphite'

  return (
    <div
      className="mb-6 print:hidden"
      role="region"
      aria-label="Resumen clínico del paciente"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Última visita → Línea de Tiempo (F7-26 P1) */}
        <TarjetaMetrica
          icono={Clock}
          label="Última visita"
          valor={textoUltimaVisita}
          sublabel={formatoFecha(ultimaVisita)}
          color={colorUltimaVisita}
          ariaLabel={`Última visita: ${textoUltimaVisita}. Click para ver línea de tiempo`}
          onClick={onNavegarTab ? () => onNavegarTab('Línea de Tiempo') : undefined}
        />

        {/* 2. Próxima cita (NO clickeable - módulo Agenda externo) */}
        <TarjetaMetrica
          icono={Calendar}
          label="Próxima cita"
          valor={proximaCita ? formatoFecha(new Date(proximaCita.fecha)) : 'Sin agendar'}
          sublabel={
            proximaCita
              ? `${proximaCita.hora || '—'} · ${proximaCita.box || 'Box'}`
              : 'Agendar cita'
          }
          color={proximaCita ? 'azul' : 'graphite'}
          ariaLabel={
            proximaCita
              ? `Próxima cita el ${formatoFecha(new Date(proximaCita.fecha))}`
              : 'Sin citas agendadas'
          }
        />

        {/* 3. Presupuesto pendiente → Plan de Tratamiento (F7-26 P1) */}
        <TarjetaMetrica
          icono={DollarSign}
          label="Pendiente"
          valor={presupuestoPendienteFormateado}
          sublabel={`${progresoTratamiento}% pagado`}
          color={colorPresupuesto}
          ariaLabel={`Presupuesto pendiente: ${presupuestoPendienteFormateado}. Click para ver plan de tratamiento`}
          onClick={onNavegarTab ? () => onNavegarTab('Plan de Tratamiento') : undefined}
        />

        {/* 4. Tratamiento → Plan de Tratamiento (F7-26 P1) */}
        <TarjetaMetrica
          icono={CheckCircle2}
          label="Tratamiento"
          valor={`${itemsRealizados} / ${totalItems}`}
          sublabel={totalItems > 0 ? `${progresoTratamiento}% completado` : 'Sin plan'}
          color={progresoTratamiento === 100 ? 'verde' : 'graphite'}
          ariaLabel={`Progreso de tratamiento: ${itemsRealizados} de ${totalItems} realizados. Click para ver plan`}
          onClick={onNavegarTab ? () => onNavegarTab('Plan de Tratamiento') : undefined}
        />

        {/* 5. Alertas clínicas → Ficha Clínica (F7-26 P1) */}
        <TarjetaMetrica
          icono={alertasActivas.length > 0 ? AlertTriangle : Activity}
          label="Alertas clínicas"
          valor={alertasActivas.length > 0 ? `${alertasActivas.length} activa${alertasActivas.length === 1 ? '' : 's'}` : 'Sin alertas'}
          sublabel={
            alertasActivas.length > 0
              ? alertasActivas[0].texto.substring(0, 30) + (alertasActivas[0].texto.length > 30 ? '…' : '')
              : 'Paciente sano'
          }
          color={alertasActivas.length > 0 ? 'rojo' : 'verde'}
          ariaLabel={
            alertasActivas.length > 0
              ? `${alertasActivas.length} alertas clínicas activas. Click para ver ficha clínica`
              : 'Sin alertas clínicas'
          }
          onClick={onNavegarTab ? () => onNavegarTab('Ficha Clínica') : undefined}
        />
      </div>

      {/* Contador de evoluciones registradas (inline, sutil) */}
      <div className="mt-2 flex items-center justify-end gap-3 text-[10px] text-graphite-500 dark:text-graphite-400">
        <span>
          <strong className="font-semibold text-graphite-700 dark:text-graphite-300">
            {totalVisitas}
          </strong>{' '}
          {totalVisitas === 1 ? 'evolución registrada' : 'evoluciones registradas'}
        </span>
      </div>
    </div>
  )
}

ResumenClinicoHeader.displayName = 'ResumenClinicoHeader'
