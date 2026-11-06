import { describe, expect, it } from 'vitest'
import { calcularAntiguedadCartera } from './carteraCalculations'

describe('calcularAntiguedadCartera', () => {
  it('calcula saldo por bandas y conserva saldo sin fecha y monedas separadas', () => {
    const resultado = calcularAntiguedadCartera({
      fechaCorte: '2026-11-06',
      cuotas: [
        {
          moneda: 'CLP', montoCuotaMenor: 100_000, fechaVencimiento: '2026-09-30',
          pagos: [
            { montoMenor: 20_000, estado: 'confirmado' },
            { montoMenor: 50_000, estado: 'pendiente' },
            { montoMenor: 10_000, estado: 'anulado' },
          ],
        },
        { moneda: 'CLP', montoCuotaMenor: 10_000, fechaVencimiento: '2026-10-20', pagos: [] },
        { moneda: 'CLP', montoCuotaMenor: 5_000, fechaVencimiento: '2026-09-01', pagos: [] },
        { moneda: 'CLP', montoCuotaMenor: 12_000, fechaVencimiento: '2026-08-01', pagos: [] },
        { moneda: 'CLP', montoCuotaMenor: 25_000, fechaVencimiento: null, pagos: [] },
        { moneda: 'CLP', montoCuotaMenor: 30_000, fechaVencimiento: '2026-11-20', pagos: [] },
        { moneda: 'USD', montoCuotaMenor: 4_000, fechaVencimiento: '2026-09-26', pagos: [] },
      ],
    })

    expect(resultado.porMoneda.CLP).toMatchObject({
      dias0a30Menor: 10_000,
      dias31a60Menor: 80_000,
      dias61a90Menor: 5_000,
      masDe90Menor: 12_000,
      sinFechaMenor: 25_000,
      porVencerMenor: 30_000,
      totalMenor: 162_000,
    })
    expect(resultado.porMoneda.USD).toMatchObject({
      dias31a60Menor: 4_000,
      totalMenor: 4_000,
    })
  })

  it('rechaza fechas e importes inválidos en lugar de producir saldos engañosos', () => {
    expect(() => calcularAntiguedadCartera({
      fechaCorte: '06/11/2026',
      cuotas: [],
    })).toThrow(/fecha/i)
    expect(() => calcularAntiguedadCartera({
      fechaCorte: '2026-11-06',
      cuotas: [{ moneda: 'CLP', montoCuotaMenor: -10, fechaVencimiento: null, pagos: [] }],
    })).toThrow(/monto/i)
  })
})
