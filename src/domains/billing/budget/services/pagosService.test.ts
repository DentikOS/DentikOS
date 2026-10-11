import { describe, it, expect, beforeEach } from 'vitest'
import { pagosService } from './pagosService'
import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'
import { timelineService } from '../../../clinical/patient/services/timelineService'

describe('pagosService (BP07)', () => {
  beforeEach(() => {
    usePresupuestosStore.setState({
      presupuestos: [
        {
          id: 'pres-1',
          folio: 'P-101',
          pacienteId: 'pac-1',
          pacienteNombre: 'Ana Valenzuela',
          estado: 'aprobado',
          totalAPagar: 100000,
          total: 100000,
          montoAbonado: 0,
        } as any,
      ],
    })
  })

  it('registra pago manual parcial cambiando estado a en-curso', () => {
    const res = pagosService.registrarPagoManual({
      presupuestoId: 'pres-1',
      pacienteId: 'pac-1',
      monto: 40000,
      medioPago: 'transferencia',
      recibidoPor: 'Dra. Martínez',
      generarBoletaSII: true,
    })

    expect(res.exito).toBe(true)
    expect(res.boletaSii?.emitida).toBe(true)
    const p = usePresupuestosStore.getState().presupuestos[0]
    expect(p.montoAbonado).toBe(40000)
    expect(p.estado).toBe('en-curso')

    const tl = timelineService.obtenerTimeline('pac-1')
    expect(tl.some((ev) => ev.tipo === 'pago' && ev.titulo.includes('40.000'))).toBe(true)
  })

  it('registra pago total cambiando estado a completado', () => {
    pagosService.registrarPagoManual({
      presupuestoId: 'pres-1',
      pacienteId: 'pac-1',
      monto: 100000,
      medioPago: 'efectivo',
      recibidoPor: 'Recepción Central',
    })

    const p = usePresupuestosStore.getState().presupuestos[0]
    expect(p.montoAbonado).toBe(100000)
    expect(p.estado).toBe('completado')
  })

  it('rechaza pago con monto superior al saldo pendiente', () => {
    expect(() => {
      pagosService.registrarPagoManual({
        presupuestoId: 'pres-1',
        pacienteId: 'pac-1',
        monto: 150000,
        medioPago: 'efectivo',
        recibidoPor: 'Recepción Central',
      })
    }).toThrow('El monto excede el saldo pendiente')
  })
})
