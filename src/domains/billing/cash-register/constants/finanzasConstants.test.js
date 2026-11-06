import { describe, it, expect } from 'vitest'
import {
  CONVENIOS_DEFAULT,
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  METODOS_PAGO_OPCIONES,
  PORCENTAJE_RETENCION_HONORARIOS_DEFAULT
} from './finanzasConstants'

describe('finanzasConstants', () => {
  it('no aplica porcentajes de convenio ilustrativos como configuración real', () => {
    expect(CONVENIOS_DEFAULT).toEqual([])
  })

  it('contiene categorias de egreso e ingreso', () => {
    expect(CATEGORIAS_EGRESO.length).toBeGreaterThan(0)
    expect(CATEGORIAS_INGRESO.length).toBeGreaterThan(0)
  })

  it('define metodos de pago y porcentaje de retencion legal chileno', () => {
    expect(METODOS_PAGO_OPCIONES.some(m => m.id === 'Efectivo')).toBe(true)
    expect(PORCENTAJE_RETENCION_HONORARIOS_DEFAULT).toBe(13.75)
  })
})
