import { describe, expect, it } from 'vitest'
import { filtrarCitasPorSucursal } from './filtrarCitasPorSucursal'
import type { Cita } from '../schemas/citaSchema'

const cita = (id: string, sedeId?: string): Cita => ({
  id,
  fecha: '2026-11-05',
  horaInicio: '09:00',
  estado: 'Pendiente',
  ...(sedeId ? { sedeId } : {}),
})

describe('filtrarCitasPorSucursal', () => {
  it('muestra la sucursal seleccionada junto con las citas históricas sin sucursal', () => {
    const sucursalA = '11111111-1111-4111-8111-111111111111'
    const sucursalB = '22222222-2222-4222-8222-222222222222'
    const citas = [cita('a', sucursalA), cita('b', sucursalB), cita('historica')]

    expect(filtrarCitasPorSucursal(citas, sucursalA).map((item) => item.id)).toEqual(['a', 'historica'])
  })

  it('mantiene todas las citas si la vista no filtra por sucursal', () => {
    const citas = [cita('a', '11111111-1111-4111-8111-111111111111'), cita('historica')]
    expect(filtrarCitasPorSucursal(citas, '')).toEqual(citas)
  })
})
