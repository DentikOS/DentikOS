import React, { useMemo } from 'react'
import type { Cita } from '../schemas/citaSchema'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'

export interface AgendaMonthViewProps {
  appointments: Cita[]
  currentDateIso: string
  onDayClick?: (dateIso: string) => void
}

const DIAS_CABECERA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const AgendaMonthView: React.FC<AgendaMonthViewProps> = ({
  appointments,
  currentDateIso,
  onDayClick
}) => {
  const { celdas, mesNombre, anio } = useMemo(() => {
    const fecha = new Date(currentDateIso + 'T00:00:00')
    const anio = fecha.getFullYear()
    const mes = fecha.getMonth()

    const mesNombre = fecha.toLocaleDateString('es-CL', { month: 'long' })

    const primerDiaMes = new Date(anio, mes, 1)
    const ultimoDiaMes = new Date(anio, mes + 1, 0)

    // Ajustar primer día de semana a Lunes (1 = Lun ... 0 = Dom -> 7)
    const primerDiaSemana = primerDiaMes.getDay() === 0 ? 7 : primerDiaMes.getDay()
    const diasEnMes = ultimoDiaMes.getDate()

    const celdas = []

    // Celdas de relleno del mes anterior
    for (let i = 1; i < primerDiaSemana; i++) {
      celdas.push({ dia: null, iso: null, esMesActual: false })
    }

    // Días del mes
    for (let d = 1; d <= diasEnMes; d++) {
      const dObj = new Date(anio, mes, d)
      const iso = obtenerFechaLocalISO(dObj)
      celdas.push({
        dia: d,
        iso,
        esMesActual: true,
        esHoy: iso === obtenerFechaLocalISO()
      })
    }

    return { celdas, mesNombre, anio }
  }, [currentDateIso])

  return (
    <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xs flex flex-col">
      {/* Cabecera del mes */}
      <div className="p-3 border-b border-surface-border bg-surface-muted/30 flex items-center justify-between">
        <h3 className="font-bold text-sm text-[#0F172A] dark:text-white capitalize">
          {mesNombre} {anio}
        </h3>
        <span className="text-xs font-semibold text-slate-500">
          {appointments.length} citas registradas
        </span>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 border-b border-surface-border bg-surface-muted/50 text-center text-xs font-bold text-slate-500 py-2">
        {DIAS_CABECERA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Grid del calendario */}
      <div className="grid grid-cols-7 divide-x divide-y divide-surface-border border-b border-surface-border">
        {celdas.map((celda, idx) => {
          if (!celda.esMesActual || !celda.iso) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[90px] bg-surface-muted/10 p-2 opacity-30 select-none"
              />
            )
          }

          const citasDia = appointments.filter((c) => c.fecha === celda.iso)
          const confirmadas = citasDia.filter((c) => c.estado === 'Confirmada' || c.estado === 'Confirmado').length
          const pendientes = citasDia.filter((c) => c.estado === 'Pendiente' || c.estado === 'Agendado').length
          const canceladas = citasDia.filter((c) => c.estado === 'Cancelada' || c.estado === 'Anulado').length

          return (
            <div
              key={celda.iso}
              onClick={() => onDayClick?.(celda.iso!)}
              className={`min-h-[90px] p-2 flex flex-col justify-between hover:bg-surface-muted/30 cursor-pointer transition-colors ${
                celda.esHoy ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    celda.esHoy
                      ? 'w-6 h-6 rounded-full bg-[#B88E3A] text-white flex items-center justify-center'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {celda.dia}
                </span>

                {citasDia.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {citasDia.length}
                  </span>
                )}
              </div>

              {/* Indicadores de semáforo */}
              {citasDia.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  {confirmadas > 0 && (
                    <span className="w-2 h-2 rounded-full bg-teal-500" title={`${confirmadas} confirmadas`} />
                  )}
                  {pendientes > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" title={`${pendientes} pendientes`} />
                  )}
                  {canceladas > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500" title={`${canceladas} canceladas`} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
