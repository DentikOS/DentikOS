import React, { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'

export type MedioPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque'

export interface PagoRegistrado {
  id: string
  monto: number
  medioPago: MedioPago
  referencia: string
  recibidoPor: string
  fecha: string
  nuevoEstado: 'en_curso' | 'completado'
}

interface ModalRegistrarPagoProps {
  saldoPendiente: number
  totalPresupuesto: number
  folioPresupuesto?: string
  pacienteNombre?: string
  onRegistrarPago: (pago: PagoRegistrado) => void
  onCerrar: () => void
}

export const ModalRegistrarPago: React.FC<ModalRegistrarPagoProps> = ({
  saldoPendiente = 450000,
  totalPresupuesto = 650000,
  folioPresupuesto = 'PRE-2026-0042',
  pacienteNombre = 'Paciente',
  onRegistrarPago,
  onCerrar,
}) => {
  const [monto, setMonto] = useState<number>(saldoPendiente)
  const [medioPago, setMedioPago] = useState<MedioPago>('tarjeta')
  const [referencia, setReferencia] = useState('')
  const [recibidoPor, setRecibidoPor] = useState('Recepción Clínica')
  const [errorMonto, setErrorMonto] = useState('')

  const handleMontoChange = (val: number) => {
    setMonto(val)
    if (val <= 0) {
      setErrorMonto('El monto debe ser mayor a $0.')
    } else if (val > saldoPendiente) {
      setErrorMonto(`El monto no puede exceder el saldo pendiente ($${saldoPendiente.toLocaleString('es-CL')}).`)
    } else {
      setErrorMonto('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (monto <= 0 || monto > saldoPendiente) return

    const nuevoSaldo = saldoPendiente - monto
    const nuevoEstado: 'en_curso' | 'completado' = nuevoSaldo === 0 ? 'completado' : 'en_curso'

    const pago: PagoRegistrado = {
      id: crypto.randomUUID(),
      monto,
      medioPago,
      referencia: referencia.trim() || `Transacción ${medioPago}`,
      recibidoPor,
      fecha: new Date().toISOString(),
      nuevoEstado,
    }

    onRegistrarPago(pago)
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" data-testid="modal-registrar-pago">
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface">
          <div>
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">
              Registrar Pago Manual (BP07 §19)
            </h3>
            <p className="text-xs text-graphite-500">
              {pacienteNombre} &bull; Folio: <span className="font-mono">{folioPresupuesto}</span>
            </p>
          </div>
          <button onClick={onCerrar} className="p-1 rounded-lg hover:bg-surface-hover text-graphite-400" aria-label="Cerrar modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-surface/50 border border-surface rounded-xl text-xs">
          <div>
            <span className="text-graphite-400 block text-[11px]">Total Presupuesto</span>
            <span className="font-mono font-bold text-graphite-700 dark:text-graphite-300 text-sm">
              ${totalPresupuesto.toLocaleString('es-CL')}
            </span>
          </div>
          <div>
            <span className="text-graphite-400 block text-[11px]">Saldo Pendiente</span>
            <span className="font-mono font-bold text-primary text-sm">
              ${saldoPendiente.toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Monto a Pagar ($ CLP)
            </label>
            <input
              type="number"
              min="1"
              max={saldoPendiente}
              value={monto}
              onChange={(e) => handleMontoChange(Number(e.target.value))}
              className="w-full p-2.5 bg-surface border border-surface rounded-xl font-mono text-base font-bold text-primary"
              data-testid="input-monto-pago"
              required
            />
            {errorMonto && <p className="text-xs text-rose-500 mt-1 font-medium">{errorMonto}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
                Medio de Pago
              </label>
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
                data-testid="select-medio-pago"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta (Débito/Crédito)</option>
                <option value="transferencia">Transferencia Electrónica</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
                Recibido Por
              </label>
              <input
                type="text"
                value={recibidoPor}
                onChange={(e) => setRecibidoPor(e.target.value)}
                className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Referencia / Comprobante
            </label>
            <input
              type="text"
              placeholder="Ej: Transbank Op. #84920 o Transf. BancoEstado"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
              data-testid="input-referencia-pago"
            />
          </div>

          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs flex items-center justify-between">
            <span className="text-graphite-600 dark:text-graphite-300">Transición de Estado Automática:</span>
            <span className="font-bold uppercase tracking-wider text-primary">
              {monto >= saldoPendiente ? 'COMPLETADO (100% Pagado)' : 'EN CURSO (Pago Parcial)'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
            <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              disabled={Boolean(errorMonto) || monto <= 0}
              data-testid="btn-confirmar-registro-pago"
            >
              Registrar Pago (${monto.toLocaleString('es-CL')})
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
