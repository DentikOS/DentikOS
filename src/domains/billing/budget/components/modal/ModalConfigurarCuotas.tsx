import React, { useState, useMemo } from 'react'
import { Calendar, CreditCard, X, Check } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'

export interface PlanCuotasConfig {
  modalidad: 'unico' | 'cuotas'
  cuotas: number
  valorCuota: number
  frecuencia: 'mensual' | 'quincenal'
  fechaPrimerPago: string
}

interface ModalConfigurarCuotasProps {
  montoTotal: number
  onConfirmar: (plan: PlanCuotasConfig) => void
  onCerrar: () => void
}

export const ModalConfigurarCuotas: React.FC<ModalConfigurarCuotasProps> = ({
  montoTotal,
  onConfirmar,
  onCerrar,
}) => {
  const [modalidad, setModalidad] = useState<'unico' | 'cuotas'>('cuotas')
  const [cuotas, setCuotas] = useState<number>(3)
  const [frecuencia, setFrecuencia] = useState<'mensual' | 'quincenal'>('mensual')
  const [fechaPrimerPago, setFechaPrimerPago] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })

  const valorCuota = useMemo(() => {
    if (modalidad === 'unico') return montoTotal
    return Math.round(montoTotal / (cuotas || 1))
  }, [montoTotal, modalidad, cuotas])

  const calendario = useMemo(() => {
    const numCuotas = modalidad === 'unico' ? 1 : cuotas
    const diasIntervalo = frecuencia === 'quincenal' ? 15 : 30
    const baseDate = new Date(fechaPrimerPago || Date.now())

    return Array.from({ length: numCuotas }, (_, idx) => {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + idx * diasIntervalo)
      return {
        cuota: idx + 1,
        fecha: d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }),
        monto: valorCuota,
      }
    })
  }, [modalidad, cuotas, frecuencia, fechaPrimerPago, valorCuota])

  const handleConfirmar = () => {
    onConfirmar({
      modalidad,
      cuotas: modalidad === 'unico' ? 1 : cuotas,
      valorCuota,
      frecuencia,
      fechaPrimerPago,
    })
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" data-testid="modal-configurar-cuotas">
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">Configurar Plan de Pagos</h3>
          </div>
          <button type="button" onClick={onCerrar} className="text-graphite-400 hover:text-graphite-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModalidad('cuotas')}
              className={`p-2.5 rounded-xl border text-left font-semibold ${modalidad === 'cuotas' ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-surface text-graphite-600'}`}
            >
              Cuotas sin interés
            </button>
            <button
              type="button"
              onClick={() => setModalidad('unico')}
              className={`p-2.5 rounded-xl border text-left font-semibold ${modalidad === 'unico' ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-surface text-graphite-600'}`}
            >
              Pago único al contado
            </button>
          </div>

          {modalidad === 'cuotas' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">N° de Cuotas</label>
                <div className="grid grid-cols-3 gap-1">
                  {[3, 6, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCuotas(n)}
                      className={`p-2 rounded-lg border text-center font-bold font-mono ${cuotas === n ? 'bg-primary text-white border-primary' : 'bg-surface border-surface'}`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">Frecuencia</label>
                <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as 'mensual' | 'quincenal')} className="w-full p-2 bg-surface border border-surface rounded-lg">
                  <option value="mensual">Mensual</option>
                  <option value="quincenal">Quincenal</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">Fecha Primer Pago</label>
            <input type="date" value={fechaPrimerPago} onChange={(e) => setFechaPrimerPago(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-lg font-mono text-xs" />
          </div>

          <div className="p-3 bg-surface-hover/70 rounded-xl border border-surface space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary" /> Calendario Proyectado</span>
              <span className="font-mono text-primary font-bold">${valorCuota.toLocaleString('es-CL')} / cuota</span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
              {calendario.map((item) => (
                <div key={item.cuota} className="flex justify-between text-[11px] p-1.5 rounded-lg bg-surface border border-surface">
                  <span className="text-graphite-600 dark:text-graphite-300">Cuota {item.cuota} ({item.fecha})</span>
                  <span className="font-mono font-bold text-graphite-900 dark:text-graphite-100">${item.monto.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
          <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button type="button" variant="primary" size="sm" icon={Check} onClick={handleConfirmar} data-testid="btn-confirmar-cuotas">Aplicar Plan</Button>
        </div>
      </div>
    </div>
  )
}
