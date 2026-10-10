import React, { memo } from 'react'
import { DollarSign, Users, Armchair, TrendingUp, Sparkles } from 'lucide-react'
import type { ResumenJornada } from '../hooks/useDashboard'

export interface DashboardKpiCardsProps {
  resumen: ResumenJornada
}

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = memo(({ resumen }) => {
  // Proyección de meta mensual (basado en días hábiles ~22)
  const metaMensualEstimada = resumen.proyeccionMensual || (resumen.recaudacionHoy * 22)
  const progresoMeta = metaMensualEstimada > 0
    ? Math.min(100, Math.round((resumen.recaudacionHoy / (metaMensualEstimada / 22)) * 100))
    : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
      {/* TARJETA HERO PRINCIPAL (Bento Col-Span-2): Recaudación & Facturación Clínica Boutique */}
      <div className="group relative overflow-hidden p-6 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-lg hover:border-gold-satin/40 hover:-translate-y-0.5 transition-all duration-180 md:col-span-2 lg:col-span-2 space-y-3 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#E5C378] before:to-transparent">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-gold-satin">
            <div className="p-1.5 rounded-lg bg-gold-satin/10 border border-gold-satin/30">
              <DollarSign size={14} className="text-gold-satin" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider block text-graphite-900 dark:text-gold-satin">
                Recaudación & Flujo Quirúrgico
              </span>
              <span className="text-[9px] text-graphite-500 dark:text-graphite-400 font-medium">
                Facturación clínica consolidada de la jornada
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] bg-gold-satin/10 dark:bg-gold-satin/15 text-graphite-900 dark:text-gold-satin font-bold px-2.5 py-1 rounded-full border border-gold-satin/30 tabular-nums">
            <Sparkles size={11} className="text-gold-satin" />
            Boutique Cockpit
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-1">
          <div>
            <span className="text-3xl lg:text-4xl font-black text-graphite-900 dark:text-graphite-50 block tabular-nums tracking-tight">
              ${resumen.recaudacionHoy.toLocaleString('es-CL')}{' '}
              <span className="text-xs font-bold text-graphite-500 dark:text-gold-satin/80">CLP</span>
            </span>
            <span className="text-[11px] text-graphite-600 dark:text-graphite-300 font-medium mt-0.5 block">
              Recaudado hoy en atenciones clínicas y abonos
            </span>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] text-graphite-500 dark:text-graphite-400 block font-semibold uppercase tracking-wider">
              Proyección Mensual
            </span>
            <span className="text-base font-extrabold text-gold-solid dark:text-gold-satin tabular-nums">
              ${resumen.proyeccionMensual.toLocaleString('es-CL')} CLP
            </span>
          </div>
        </div>

        {/* Micro-gráfico de progreso de meta mensual */}
        <div className="space-y-1.5 pt-2 border-t border-surface">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-graphite-600 dark:text-graphite-300 font-semibold flex items-center gap-1">
              <TrendingUp size={11} className="text-gold-solid dark:text-gold-satin" />
              Ritmo de Cumplimiento Jornada
            </span>
            <span className="tabular-nums font-bold text-gold-solid dark:text-gold-satin">
              {progresoMeta}% alcanzado hoy
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-graphite-800 surgical:bg-graphite-300 rounded-full h-2 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-[#B88E3A] via-[#E5C378] to-[#FFF5DF] h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progresoMeta, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[9px] text-graphite-500 dark:text-graphite-400">
            <span>Conversión presupuestos: <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{resumen.tasaConversionPresupuestos}%</strong></span>
            <span>Aceptado: <strong className="tabular-nums text-graphite-700 dark:text-graphite-200">${resumen.montoTotalAceptado.toLocaleString('es-CL')} CLP</strong></span>
          </div>
        </div>
      </div>

      {/* TARJETA SECUNDARIA 1 (1 col): Monitor Quirúrgico de Sillones / Boxes */}
      <div className="group relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:border-sky-500/40 hover:-translate-y-0.5 transition-all duration-180 space-y-2.5 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9] before:to-transparent">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-graphite-400">
            <div className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/50 border border-sky-500/30">
              <Armchair size={13} className="text-[#0EA5E9]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-800 dark:text-graphite-200">
              Ocupación de Sillones
            </span>
          </div>
          <span className="text-[10px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-[#38BDF8] font-bold px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800/50 tabular-nums">
            {resumen.tasaOcupacionAgenda}% Capacidad
          </span>
        </div>

        <div className="pt-1">
          <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50 block tabular-nums tracking-tight">
            {resumen.citasHoyCount} <span className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">Atenciones</span>
          </span>
          <span className="text-[10px] text-graphite-600 dark:text-graphite-400 font-medium block truncate">
            {resumen.enAtencion.length > 0 ? (
              <span className="text-[#0EA5E9] font-bold">● {resumen.enAtencion.length} en box activo</span>
            ) : (
              'Boxes listos para ingreso'
            )}
          </span>
        </div>

        {/* Barra de progreso en Cian Quirúrgico (#0EA5E9) */}
        <div className="pt-1 space-y-1">
          <div className="w-full bg-slate-100 dark:bg-graphite-800 surgical:bg-graphite-300 rounded-full h-2 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8] h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(resumen.tasaOcupacionAgenda, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-graphite-500 dark:text-graphite-400">
            <span>Agenda diaria</span>
            <span className="tabular-nums font-semibold">{resumen.citasHoyCount} programadas</span>
          </div>
        </div>
      </div>

      {/* TARJETA SECUNDARIA 2 (1 col): Directorio & Flujo Clínico */}
      <div className="group relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all duration-180 space-y-2.5 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/60 before:to-transparent">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-graphite-400">
            <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/30">
              <Users size={13} className="text-emerald-500" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-800 dark:text-graphite-200">
              Flujo de Pacientes
            </span>
          </div>
          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 tabular-nums">
            {resumen.enEspera.length} En Espera
          </span>
        </div>

        <div className="pt-1">
          <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50 block tabular-nums tracking-tight">
            {resumen.totalPacientes} <span className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">Pacientes</span>
          </span>
          <span className="text-[10px] text-graphite-600 dark:text-graphite-300 font-medium block truncate">
            {resumen.finalizadas.length} atenciones finalizadas hoy
          </span>
        </div>

        <div className="pt-1 space-y-1">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100/70 dark:bg-graphite-800/60 border border-surface text-[10px]">
            <span className="text-graphite-600 dark:text-graphite-400 font-medium">Recepción:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {resumen.enEspera.length === 0 ? 'Sin demora' : `${resumen.enEspera.length} esperando`}
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-graphite-500 dark:text-graphite-400">
            <span>Directorio activo</span>
            <span className="tabular-nums font-semibold">{resumen.totalPacientes} registros</span>
          </div>
        </div>
      </div>
    </div>
  )
})

DashboardKpiCards.displayName = 'DashboardKpiCards'
