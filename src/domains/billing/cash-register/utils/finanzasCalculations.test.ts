import { describe, expect, it } from 'vitest'
import { calcularBalanceFinanzas } from './finanzasCalculations'

describe('calcularBalanceFinanzas', () => {
  it('mantiene ingresos y egresos separados por moneda', () => {
    const resultado = calcularBalanceFinanzas([
      { monto: 1200, tipo: 'Ingreso', metodoPago: 'Efectivo', moneda: 'CLP' },
      { monto: 30, tipo: 'Ingreso', metodoPago: 'Transferencia', moneda: 'USD' },
      { monto: 5, tipo: 'Egreso', metodoPago: 'Efectivo', moneda: 'USD' },
    ])

    expect(resultado.totalesPorMoneda.CLP).toMatchObject({ totalIngresos: 1200, totalEgresos: 0, saldoNeto: 1200 })
    expect(resultado.totalesPorMoneda.USD).toMatchObject({ totalIngresos: 30, totalEgresos: 5, saldoNeto: 25 })
    expect(resultado.totalIngresos).toBe(1200)
    expect(resultado.saldoNeto).toBe(1200)
  })
})
