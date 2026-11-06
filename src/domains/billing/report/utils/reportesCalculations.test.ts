import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../budget/services/presupuestosStorageService', () => ({
  presupuestosStorageService: { obtenerItemsPorPaciente: vi.fn(() => []) },
}))

import { calcularEstadisticasAvanzadas } from './reportesCalculations'

describe('calcularEstadisticasAvanzadas por moneda', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calcula el reporte usando solo pagos, presupuestos e ítems de la moneda elegida', () => {
    const resultado = calcularEstadisticasAvanzadas(
      [{ id: 'paciente-1' }],
      [
        { monto: 100, estado: 'Emitido', metodoPago: 'Efectivo', moneda: 'CLP' },
        { monto: 25, estado: 'Emitido', metodoPago: 'Transferencia', moneda: 'USD' },
      ],
      [
        { id: 'clp-1', pacienteId: 'paciente-1', montoTotal: 100, moneda: 'CLP', items: [{ prestacion: 'Limpieza CLP', subtotal: 100 }] },
        { id: 'usd-1', pacienteId: 'paciente-1', montoTotal: 25, moneda: 'USD', items: [{ nombrePrestacion: 'Limpieza USD', subtotal: 25 }] },
      ],
      [],
      'USD'
    )

    expect(resultado.totalRecaudado).toBe(25)
    expect(resultado.totalPresupuestado).toBe(25)
    expect(resultado.ticketPromedio).toBe(25)
    expect(resultado.topPrestaciones).toEqual([{ nombre: 'Limpieza USD', cantidad: 1, montoTotal: 25 }])
    expect(resultado.recaudacionPorMetodo).toEqual({ Transferencia: 25 })
  })

  it('trata los documentos históricos sin moneda como CLP', () => {
    const resultado = calcularEstadisticasAvanzadas(
      [],
      [{ monto: 80, estado: 'Emitido', metodoPago: 'Efectivo' }],
      [{ montoTotal: 80 }],
      [],
      'CLP'
    )

    expect(resultado.totalRecaudado).toBe(80)
    expect(resultado.totalPresupuestado).toBe(80)
  })
})
