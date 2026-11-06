import { describe, expect, it } from 'vitest'
import { adaptarCarteraBp07 } from './carteraBp07Adapter'

describe('adaptarCarteraBp07', () => {
  it('mantiene el saldo exacto sin antigüedad cuando no hay calendario', () => {
    const result = adaptarCarteraBp07({
      fechaCorte: '2026-11-06',
      presupuestos: [{ id: 'budget-a', folio: 'P-1', paciente_id: 'patient-a', estado: 'aprobado', monto_total: 100_000, moneda: 'CLP' }],
      pagos: [{ id: 'payment-a', presupuesto_id: 'budget-a', monto: 25_000, moneda: 'CLP', fecha: '2026-10-01' }],
      pacientes: [{ id: 'patient-a', nombre: 'Ana' }]
    })

    expect(result[0].saldoMinor).toBe(7_500_000)
    expect(result[0].antiguedad.porMoneda.CLP.sinFechaMenor).toBe(7_500_000)
    expect(result[0].antiguedad.porMoneda.CLP.totalMenor).toBe(7_500_000)
  })

  it('usa una cuota solo si BP07 identifica explícitamente la cuota pagada', () => {
    const result = adaptarCarteraBp07({
      fechaCorte: '2026-11-06',
      presupuestos: [{
        id: 'budget-a', folio: 'P-1', paciente_id: 'patient-a', estado: 'aprobado', monto_total: 100_000, moneda: 'CLP',
        plan_pago: { calendario: [
          { numero: 1, fechaVencimiento: '2026-10-01', monto: 50_000, estado: 'pendiente' },
          { numero: 2, fechaVencimiento: '2026-11-20', monto: 50_000, estado: 'pendiente' }
        ] }
      }],
      pagos: [{ id: 'payment-a', presupuesto_id: 'budget-a', numero_cuota: 1, monto: 50_000, moneda: 'CLP', fecha: '2026-10-01' }],
      pacientes: [{ id: 'patient-a', nombre: 'Ana' }]
    })

    expect(result[0].saldoMinor).toBe(5_000_000)
    expect(result[0].antiguedad.porMoneda.CLP.porVencerMenor).toBe(5_000_000)
    expect(result[0].antiguedad.porMoneda.CLP.dias0a30Menor).toBe(0)
  })

  it('no reparte pagos sin vínculo a cuota dentro del aging', () => {
    const result = adaptarCarteraBp07({
      fechaCorte: '2026-11-06',
      presupuestos: [{
        id: 'budget-a', folio: 'P-1', paciente_id: 'patient-a', estado: 'aprobado', monto_total: 100_000, moneda: 'CLP',
        plan_pago: { calendario: [{ numero: 1, fechaVencimiento: '2026-10-01', monto: 100_000, estado: 'pendiente' }] }
      }],
      pagos: [{ id: 'payment-a', presupuesto_id: 'budget-a', monto: 25_000, moneda: 'CLP', fecha: '2026-10-15' }],
      pacientes: []
    })

    expect(result[0].saldoMinor).toBe(7_500_000)
    expect(result[0].antiguedad.porMoneda.CLP.sinFechaMenor).toBe(7_500_000)
    expect(result[0].antiguedad.porMoneda.CLP.dias0a30Menor).toBe(0)
  })

  it.each([null, undefined])('mantiene el saldo en sin fecha si numero_cuota es %s', (numeroCuota) => {
    const result = adaptarCarteraBp07({
      fechaCorte: '2026-11-06',
      presupuestos: [{
        id: 'budget-a', estado: 'aprobado', monto_total: 100, moneda: 'CLP',
        plan_pago: { calendario: [{ numero: 1, fechaVencimiento: '2026-10-01', monto: 100 }] }
      }],
      pagos: [{ id: 'payment-a', presupuesto_id: 'budget-a', numero_cuota: numeroCuota, monto: 20, moneda: 'CLP' }],
      pacientes: []
    })

    expect(result[0].agingVerificable).toBe(false)
    expect(result[0].antiguedad.porMoneda.CLP.sinFechaMenor).toBe(8_000)
  })
})
