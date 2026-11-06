import React, { useState, useMemo } from 'react'
import { CreditCard, Calendar, Check, Zap } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'

interface SimuladorCuotasProps {
  montoTotal: number
  onSeleccionarPlan?: (plan: { cuotas: number; valorCuota: number; total: number }) => void
}

export const SimuladorCuotas: React.FC<SimuladorCuotasProps> = ({
  montoTotal,
  onSeleccionarPlan,
}) => {
  const [cuotasSeleccionadas, setCuotasSeleccionadas] = useState<number>(3)

  const planes = useMemo(() => {
    return [
      {
        cuotas: 1,
        titulo: 'Pago Único Contado',
        descripcion: 'Proyección de un único pago manual',
        valorCuota: montoTotal,
        sinInteres: true,
      },
      {
        cuotas: 3,
        titulo: '3 cuotas iguales',
        descripcion: 'Proyección matemática para revisión de la clínica',
        valorCuota: Math.round(montoTotal / 3),
        sinInteres: true,
      },
      {
        cuotas: 6,
        titulo: '6 cuotas iguales',
        descripcion: 'Proyección matemática para revisión de la clínica',
        valorCuota: Math.round(montoTotal / 6),
        sinInteres: true,
      },
    ]
  }, [montoTotal])

  const calendarioPagos = useMemo(() => {
    const cuotaMonto = Math.round(montoTotal / cuotasSeleccionadas)
    const fechaActual = new Date()

    return Array.from({ length: cuotasSeleccionadas }, (_, i) => {
      const fechaCuota = new Date(fechaActual)
      fechaCuota.setMonth(fechaActual.getMonth() + i)
      return {
        numero: i + 1,
        fecha: fechaCuota.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }),
        monto: i === cuotasSeleccionadas - 1 ? montoTotal - cuotaMonto * (cuotasSeleccionadas - 1) : cuotaMonto,
      }
    })
  }, [montoTotal, cuotasSeleccionadas])

  const planActivo = planes.find((p) => p.cuotas === cuotasSeleccionadas) || planes[1]

  const handleElegir = () => {
    onSeleccionarPlan?.({
      cuotas: cuotasSeleccionadas,
      valorCuota: planActivo.valorCuota,
      total: montoTotal,
    })
  }

  return (
    <div className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-5 shadow-xs" data-testid="simulador-cuotas">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-surface">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">
              Simulación de cuotas
            </h3>
          </div>
          <p className="text-xs text-graphite-500 mt-0.5">
            Proyección informativa; la clínica debe confirmar cualquier plan de pago.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-graphite-400 uppercase font-semibold">Total a Financiar</span>
          <p className="text-lg font-black font-mono text-primary">${montoTotal.toLocaleString('es-CL')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {planes.map((p) => {
          const isActivo = cuotasSeleccionadas === p.cuotas
          return (
            <div
              key={p.cuotas}
              onClick={() => setCuotasSeleccionadas(p.cuotas)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isActivo
                  ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs'
                  : 'bg-surface border-surface hover:bg-surface-hover text-graphite-700'
              }`}
              data-testid={`plan-cuotas-${p.cuotas}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-graphite-900 dark:text-graphite-100">{p.titulo}</span>
                </div>
                <p className="text-[11px] text-graphite-500 mb-3">{p.descripcion}</p>
              </div>

              <div className="pt-3 border-t border-surface flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-graphite-400">{p.cuotas}x </span>
                  <span className="text-base font-extrabold font-mono text-graphite-900 dark:text-graphite-50">
                    ${p.valorCuota.toLocaleString('es-CL')}
                  </span>
                </div>
                {isActivo && <Check className="w-4 h-4 text-primary stroke-[3]" />}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 bg-surface rounded-xl border border-surface space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-graphite-700 dark:text-graphite-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" /> Calendario Proyectado de Vencimientos ({calendarioPagos.length} cuotas)
          </span>
          <span className="text-[11px] text-graphite-400 font-mono">Proyección, no cobro programado</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {calendarioPagos.map((c) => (
            <div key={c.numero} className="p-2.5 rounded-lg bg-surface-hover/70 border border-surface flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-graphite-800 dark:text-graphite-200">Cuota {c.numero}</span>
                <p className="text-[10px] text-graphite-400">{c.fecha}</p>
              </div>
              <span className="font-mono font-bold text-primary">${c.monto.toLocaleString('es-CL')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button type="button" variant="primary" icon={Zap} onClick={handleElegir} data-testid="btn-confirmar-plan-cuotas">
          Confirmar Plan {cuotasSeleccionadas} {cuotasSeleccionadas === 1 ? 'Cuota' : 'Cuotas'}
        </Button>
      </div>
    </div>
  )
}
