import { describe, it, expect } from 'vitest'
import {
  generarFolioRecibo,
  calcularResumenRecaudacion
} from './pagosCalculations'

describe('pagosCalculations', () => {
  it('genera un folio de recibo con prefijo REC y año', () => {
    const folio = generarFolioRecibo()
    expect(folio).toMatch(/^REC-\d{4}-\d{4}$/)
  })

  it('calcula resumen de recaudacion excluyendo anulados y purgados del total', () => {
    const pagos = [
      { monto: 50000, estado: 'Emitido', tipoDTE: 'boleta_honorarios', metodoPago: 'Efectivo' },
      { monto: 20000, estado: 'Anulado' },
      { monto: 10000, estado: 'Purgado' }
    ]
    const res = calcularResumenRecaudacion(pagos)
    expect(res.totalTransacciones).toBe(2)
    expect(res.totalRecaudado).toBe(50000)
    expect(res.totalAnulados).toBe(20000)
    expect(res.totalBoletasHonorarios).toBe(50000)
  })

  it('excluye borradores de efectivo sin confirmar de los ingresos y transacciones', () => {
    const res = calcularResumenRecaudacion([
      { monto: 50000, estado: 'Borrador sin confirmar', metodoPago: 'Efectivo' },
      { monto: 12000, estado: 'Emitido', metodoPago: 'Transferencia' }
    ])

    expect(res.totalRecaudado).toBe(12000)
    expect(res.totalTransacciones).toBe(1)
  })
})
