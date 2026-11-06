import { describe, expect, it } from 'vitest'
import { calcularArqueoCaja } from './cajaCalculations'

describe('calcularArqueoCaja', () => {
  it('compara apertura, efectivo confirmado y egresos contra el conteo físico', () => {
    const arqueo = calcularArqueoCaja({
      moneda: 'CLP',
      montoAperturaMenor: 1_000_000,
      pagos: [
        { montoMenor: 1_500_000, moneda: 'CLP', medioPago: 'efectivo', estado: 'confirmado' },
        { montoMenor: 900_000, moneda: 'CLP', medioPago: 'efectivo', estado: 'pendiente' },
        { montoMenor: 500_000, moneda: 'USD', medioPago: 'efectivo', estado: 'confirmado' },
      ],
      egresos: [
        { montoMenor: 200_000, moneda: 'CLP', medioPago: 'efectivo', estado: 'confirmado' },
        { montoMenor: 300_000, moneda: 'CLP', medioPago: 'efectivo', estado: 'pendiente' },
        { montoMenor: 800_000, moneda: 'CLP', medioPago: 'transferencia', estado: 'confirmado' },
      ],
      denominaciones: [
        { valorMenor: 1_000_000, cantidad: 2 },
        { valorMenor: 100_000, cantidad: 2 },
      ],
    })

    expect(arqueo).toMatchObject({
      montoEsperadoMenor: 2_300_000,
      montoContadoMenor: 2_200_000,
      diferenciaMenor: -100_000,
      requiereMotivo: false,
    })
  })

  it('requiere motivo solo cuando la diferencia supera el umbral y rechaza conteos inválidos', () => {
    const arqueo = calcularArqueoCaja({
      moneda: 'CLP',
      montoAperturaMenor: 0,
      pagos: [],
      egresos: [],
      denominaciones: [{ valorMenor: 10_000, cantidad: 51 }],
      umbralMotivoMenor: 500_000,
    })

    expect(arqueo).toMatchObject({ diferenciaMenor: 510_000, requiereMotivo: true })
    expect(calcularArqueoCaja({
      moneda: 'CLP',
      montoAperturaMenor: 0,
      pagos: [],
      egresos: [],
      denominaciones: [{ valorMenor: 10_000, cantidad: 51 }],
      umbralMotivoMenor: 510_000,
    })).toMatchObject({ diferenciaMenor: 510_000, requiereMotivo: false })
    expect(() => calcularArqueoCaja({
      moneda: 'CLP',
      montoAperturaMenor: -1,
      pagos: [],
      egresos: [],
      denominaciones: [],
    })).toThrow(/monto/i)
    expect(() => calcularArqueoCaja({
      moneda: 'CLP',
      montoAperturaMenor: 0,
      pagos: [],
      egresos: [],
      denominaciones: [{ valorMenor: 10_000, cantidad: -1 }],
    })).toThrow(/denominaci|cantidad/i)
  })
})
