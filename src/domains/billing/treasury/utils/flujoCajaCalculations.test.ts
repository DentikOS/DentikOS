import { describe, expect, it } from 'vitest'
import { proyectarFlujoCaja } from './flujoCajaCalculations'

describe('proyectarFlujoCaja', () => {
  it('proyecta solo ingresos fechados y gastos programados con tasas explícitas por escenario', () => {
    const resultado = proyectarFlujoCaja({
      moneda: 'CLP',
      saldoInicialMenor: 100_000,
      desde: '2026-11-06',
      hasta: '2026-11-30',
      tasasCobranzaPuntosBase: { optimista: 10_000, realista: 8_000, pesimista: 5_000 },
      ingresos: [
        { id: 'cuota', tipo: 'cuota', montoMenor: 10_000, moneda: 'CLP', fecha: '2026-11-10' },
        { id: 'usd', tipo: 'cuota', montoMenor: 5_000, moneda: 'USD', fecha: '2026-11-10' },
      ],
      gastos: [
        { id: 'arriendo', montoMenor: 2_000, moneda: 'CLP', fechaProgramada: '2026-11-09' },
      ],
    })

    expect(resultado.porEscenario).toMatchObject({
      optimista: { saldoFinalMenor: 108_000, estado: 'completo' },
      realista: { saldoFinalMenor: 106_000, estado: 'completo' },
      pesimista: { saldoFinalMenor: 103_000, estado: 'completo' },
    })
    expect(resultado.datosExcluidos).toEqual([expect.objectContaining({ id: 'usd', motivo: 'otra_moneda' })])
  })

  it('marca la proyección insuficiente cuando falta una tasa o hay ingresos sin fecha; no usa cero por defecto', () => {
    const resultado = proyectarFlujoCaja({
      moneda: 'CLP',
      saldoInicialMenor: 100_000,
      desde: '2026-11-06',
      hasta: '2026-11-30',
      tasasCobranzaPuntosBase: { optimista: 10_000, pesimista: 5_000 },
      ingresos: [
        { id: 'cuota', tipo: 'cuota', montoMenor: 10_000, moneda: 'CLP', fecha: '2026-11-10' },
        { id: 'sin-fecha', tipo: 'bono', montoMenor: 20_000, moneda: 'CLP', fecha: null },
      ],
      gastos: [],
    })

    expect(resultado.porEscenario.realista).toMatchObject({ estado: 'insuficiente', saldoFinalMenor: null })
    expect(resultado.datosExcluidos).toContainEqual({ id: 'sin-fecha', motivo: 'sin_fecha' })
  })

  it('rechaza tasas de cobranza fuera del rango permitido', () => {
    expect(() => proyectarFlujoCaja({
      moneda: 'CLP',
      saldoInicialMenor: 0,
      desde: '2026-11-06',
      hasta: '2026-11-30',
      tasasCobranzaPuntosBase: { optimista: 10_001, realista: 8_000, pesimista: 5_000 },
      ingresos: [],
      gastos: [],
    })).toThrow(/tasa/i)
  })
})
