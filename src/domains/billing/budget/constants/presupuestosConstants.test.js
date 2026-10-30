import { describe, it, expect } from 'vitest'
import {
  ESTADOS_PRESUPUESTO,
  OPCIONES_CUOTAS,
  TRANSICIONES_MANUALES_PRESUPUESTO
} from './presupuestosConstants'

describe('presupuestosConstants', () => {
  it('contiene estados de presupuesto estructurados', () => {
    expect(ESTADOS_PRESUPUESTO.some(e => e.id === 'Aprobado')).toBe(true)
    expect(ESTADOS_PRESUPUESTO.some(e => e.id === 'EnTratamiento')).toBe(true)
  })

  it('contiene opciones de cuotas', () => {
    expect(OPCIONES_CUOTAS.length).toBeGreaterThan(0)
    expect(OPCIONES_CUOTAS[0].cuotas).toBe(1)
  })

  it('no permite marcar enviado ni completado sin sus flujos reales', () => {
    expect(TRANSICIONES_MANUALES_PRESUPUESTO.borrador).toContain('aprobado')
    expect(TRANSICIONES_MANUALES_PRESUPUESTO.borrador).not.toContain('enviado')
    expect(TRANSICIONES_MANUALES_PRESUPUESTO.aprobado).toBeUndefined()
  })
})
