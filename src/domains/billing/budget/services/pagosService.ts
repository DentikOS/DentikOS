import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'

export interface RegistrarPagoInput {
  presupuestoId: string | number
  pacienteId?: string | number
  monto: number
  medioPago: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'
  referencia?: string
  recibidoPor: string
  generarBoletaSII?: boolean
}

export const pagosService = {
  registrarPagoManual: (input: RegistrarPagoInput) => {
    const store = usePresupuestosStore.getState()
    const presupuesto = store.presupuestos.find((p) => String(p.id) === String(input.presupuestoId))
    if (!presupuesto) throw new Error('Presupuesto no encontrado')

    const total = presupuesto.totalAPagar || presupuesto.total || presupuesto.montoTotal || 0
    const saldoPendiente = total - (presupuesto.montoAbonado || 0)
    if (input.monto <= 0) throw new Error('El monto debe ser mayor a 0')
    if (input.monto > saldoPendiente) throw new Error('El monto excede el saldo pendiente')

    const randomHash = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()

    const boletaSii = input.generarBoletaSII ? {
      folio: `DTE-${Date.now().toString().slice(-6)}`,
      hash: `SII-SHA256-${randomHash}`,
      emitida: true,
    } : undefined

    store.registrarPago(input.presupuestoId, {
      monto: input.monto,
      fecha: new Date().toISOString(),
      metodoPago: input.medioPago as any,
      medioPago: input.medioPago,
      referencia: input.referencia || `Pago ${input.medioPago}`,
      recibidoPor: input.recibidoPor,
      boletaSii,
    } as any)

    return { exito: true, boletaSii }
  },
}
