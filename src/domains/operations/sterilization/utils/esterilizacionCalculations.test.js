import { describe, it, expect } from 'vitest'
import {
  generarCodigoLoteEsterilizacion,
  calcularResumenEsterilizacion
} from './esterilizacionCalculations'

describe('esterilizacionCalculations', () => {
  it('genera un codigo de lote con prefijo LOTE y fecha', () => {
    const lote = generarCodigoLoteEsterilizacion()
    expect(lote).toMatch(/^LOTE-\d{8}-[A-F0-9]{8}$/)
  })

  it('calcula resumen de esterilizacion con conformes y rechazadas', () => {
    const cargas = [
      { estado: 'Conforme', indicadorQuimico: 'Pasa' },
      { estado: 'Rechazado', indicadorQuimico: 'Fallo C-4' }
    ]
    const biologicos = [
      { resultado: 'Pendiente' },
      { resultado: 'Negativo' }
    ]
    const res = calcularResumenEsterilizacion(cargas, biologicos, [])
    expect(res.totalCargas).toBe(2)
    expect(res.conformes).toBe(1)
    expect(res.rechazadas).toBe(1)
    expect(res.biologicosPendientes).toBe(1)
  })
})
