import { describe, expect, it } from 'vitest'
import { filtrarBoxesCompatibles } from './boxesCompatibles'
import type { BoxClinico } from '../../../organization/clinic/schemas/boxSchema'

const box = (id: string, equipamiento: BoxClinico['equipamiento'], estado: BoxClinico['estado'] = 'activo'): BoxClinico => ({
  id,
  clinicaId: '11111111-1111-4111-8111-111111111111',
  sucursalId: '22222222-2222-4222-8222-222222222222',
  nombre: `Box ${id}`,
  tipo: 'general',
  unidadDental: 'Unidad 1',
  equipamiento,
  notas: '',
  estado,
})

describe('filtrarBoxesCompatibles', () => {
  it('exige que el box activo tenga todos los equipos configurados para la prestación', () => {
    const boxes = [
      box('uno', [{ tipo: 'laser_dental' }]),
      box('dos', [{ tipo: 'laser_dental' }, { tipo: 'microscopio_dental' }]),
      box('tres', [{ tipo: 'laser_dental' }, { tipo: 'microscopio_dental' }], 'mantenimiento'),
    ]

    expect(filtrarBoxesCompatibles(boxes, ['laser_dental', 'microscopio_dental']).map((item) => item.id))
      .toEqual(['dos'])
  })

  it('devuelve todos los boxes activos si la prestación no declara requisitos', () => {
    const boxes = [box('uno', []), box('dos', [], 'inactivo')]
    expect(filtrarBoxesCompatibles(boxes, []).map((item) => item.id)).toEqual(['uno'])
  })
})
