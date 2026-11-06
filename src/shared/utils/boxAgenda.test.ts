import { describe, expect, it } from 'vitest'
import { citasCompartenBoxAgenda } from './boxAgenda'

describe('citasCompartenBoxAgenda', () => {
  it('no considera ocupado un box homónimo de otra sucursal', () => {
    expect(citasCompartenBoxAgenda(
      { sedeId: 'sede-a', boxId: 'box-a', boxAsignado: 'Box 1' },
      { sedeId: 'sede-b', boxId: 'box-b', boxAsignado: 'Box 1' },
    )).toBe(false)
  })

  it('usa la identidad del box al coincidir las sucursales', () => {
    expect(citasCompartenBoxAgenda(
      { sedeId: 'sede-a', boxId: 'box-a', boxAsignado: 'Box 1' },
      { sedeId: 'sede-a', boxId: 'box-b', boxAsignado: 'Box 1' },
    )).toBe(false)
  })

  it('compara por etiqueta si una cita histórica carece de IDs', () => {
    expect(citasCompartenBoxAgenda(
      { boxAsignado: 'Box Antiguo' },
      { sedeId: 'sede-a', boxId: 'box-a', boxAsignado: 'Box Antiguo' },
    )).toBe(true)
  })
})
