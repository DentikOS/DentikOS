import React, { useState, useMemo } from 'react'
import { CreditCard, Calendar, Check, DollarSign } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import type { PlanPago as PlanPagoType } from '../../schemas/presupuestoSchema'

interface PlanPagoProps {
  totalAPagar: number
  onConfirmarPlan: (plan: PlanPagoType) => void
}

export const PlanPago: React.FC<PlanPagoProps> = ({ totalAPagar, onConfirmarPlan }) => {
  const [modalidad, setModalidad] = useState<'pago-unico' | 'cuotas-sin-interes'>('cuotas-sin-interes')
  const [numeroCuotas, setNumeroCuotas] = useState<number>(6)

  const { valorCuota, calendario } = useMemo(() => {
    if (modalidad === 'pago-unico') {
      return {
        valorCuota: totalAPagar,
        calendario: [
          {
            numero: 1,
            fechaVencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            monto: totalAPagar,
            estado: 'pendiente' as const,
          },
        ],
      }
    }

    const cuota = Math.round(totalAPagar / (numeroCuotas || 1))
    const fechas = Array.from({ length: numeroCuotas }, (_, idx) => {
      const fecha = new Date(Date.now() + (idx + 1) * 30 * 24 * 60 * 60 * 1000).toISOString()
      return {
        numero: idx + 1,
        fechaVencimiento: fecha,
        monto: cuota,
        estado: 'pendiente' as const,
      }
    })

    return { valorCuota: cuota, calendario: fechas }
  }, [modalidad, numeroCuotas, totalAPagar])

  const handleConfirmar = () => {
    onConfirmarPlan({
      modalidad,
      numeroCuotas: modalidad === 'pago-unico' ? 1 : numeroCuotas,
      valorCuota,
      calendario,
    })
  }

  return (
    <div
      className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs"
      data-testid="plan-pago-modulo"
    >
      <div className="flex items-center justify-between pb-2 border-b border-surface">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            Planes de Pago & Simulador de Cuotas
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-graphite-700 dark:text-graphite-300">
          Total: ${totalAPagar.toLocaleString('es-CL')}
        </span>
      </div>

      {/* Selector de Modalidad */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <button
          type="button"
          onClick={() => setModalidad('pago-unico')}
          className={`p-3 rounded-xl border font-bold transition-all ${
            modalidad === 'pago-unico'
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-surface border-surface hover:bg-surface-hover text-graphite-600'
          }`}
          data-testid="btn-pago-unico"
        >
          Pago Único Contado
        </button>

        <button
          type="button"
          onClick={() => setModalidad('cuotas-sin-interes')}
          className={`p-3 rounded-xl border font-bold transition-all ${
            modalidad === 'cuotas-sin-interes'
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-surface border-surface hover:bg-surface-hover text-graphite-600'
          }`}
          data-testid="btn-cuotas-sin-interes"
        >
          Cuotas Sin Interés
        </button>
      </div>

      {/* Selector de N° de Cuotas */}
      {modalidad === 'cuotas-sin-interes' && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-graphite-700 dark:text-graphite-300 block">
            Selecciona el plazo de pago:
          </span>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {[3, 6, 10, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumeroCuotas(n)}
                className={`p-2.5 rounded-xl border font-mono font-bold transition-all ${
                  numeroCuotas === n
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface border-surface hover:bg-surface-hover text-graphite-700 dark:text-graphite-300'
                }`}
              >
                {n} cuotas
              </button>
            ))}
          </div>

          <div className="p-3 bg-surface-hover/60 border border-surface rounded-xl flex items-center justify-between text-xs">
            <span className="text-graphite-600 dark:text-graphite-400">
              Valor estimado de cada cuota:
            </span>
            <span className="font-mono font-bold text-primary text-sm">
              ${valorCuota.toLocaleString('es-CL')} / mes
            </span>
          </div>
        </div>
      )}

      {/* Calendario de Cuotas */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        <span className="text-[11px] font-bold uppercase text-graphite-500 tracking-wider block">
          Calendario de Vencimientos:
        </span>
        {calendario?.map((c) => (
          <div
            key={c.numero}
            className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface text-xs"
          >
            <span className="font-semibold text-graphite-700 dark:text-graphite-300">
              Cuota #{c.numero}
            </span>
            <div className="flex items-center gap-3 text-graphite-500 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(c.fechaVencimiento).toLocaleDateString()}
              </span>
              <span className="font-bold text-graphite-900 dark:text-graphite-50">
                ${c.monto.toLocaleString('es-CL')}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button type="button" variant="primary" size="sm" icon={Check} onClick={handleConfirmar}>
          Confirmar Plan de Pagos
        </Button>
      </div>
    </div>
  )
}
