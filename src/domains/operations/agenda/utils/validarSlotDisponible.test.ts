import { describe, it, expect } from 'vitest'
import { validarSlotDisponible, obtenerColorBordeSlot } from './validarSlotDisponible'
import type { Cita } from '../schemas/citaSchema'

describe('validarSlotDisponible (BP05 §08)', () => {
  const citas: Cita[] = [
    {
      id: 1,
      fecha: '2026-10-15',
      horaInicio: '10:00',
      horaFin: '11:00',
      estado: 'Confirmada',
      doctor: 'Dr. Martínez',
      boxAsignado: 'Box 1',
    } as Cita,
  ]

  it('detecta slot libre como disponible', () => {
    const result = validarSlotDisponible(
      2,
      '2026-10-15',
      '14:00',
      '15:00',
      'Dr. Martínez',
      'Box 1',
      citas
    )

    expect(result.disponible).toBe(true)
    expect(result.hayConflicto).toBe(false)
    expect(obtenerColorBordeSlot(result)).toBe('border-transparent')
  })

  it('detecta slot ocupado como conflicto', () => {
    const result = validarSlotDisponible(
      2,
      '2026-10-15',
      '10:30',
      '11:30',
      'Dr. Martínez',
      'Box 1',
      citas,
      false
    )

    expect(result.disponible).toBe(false)
    expect(result.hayConflicto).toBe(true)
    expect(result.citasEnConflicto).toHaveLength(1)
    expect(obtenerColorBordeSlot(result)).toBe('border-rose-500 dark:border-rose-600')
  })

  it('permite sobrecupo si doctor lo permite (Opción B)', () => {
    const result = validarSlotDisponible(
      2,
      '2026-10-15',
      '10:30',
      '11:30',
      'Dr. Martínez',
      'Box 1',
      citas,
      true
    )

    expect(result.disponible).toBe(true)
    expect(result.hayConflicto).toBe(true)
    expect(result.permiteSobrecupo).toBe(true)
    expect(obtenerColorBordeSlot(result)).toBe('border-amber-400 dark:border-amber-600')
  })

  it('excluye citas canceladas del análisis', () => {
    const citasConCancelada: Cita[] = [
      ...citas,
      {
        id: 2,
        fecha: '2026-10-15',
        horaInicio: '14:00',
        horaFin: '15:00',
        estado: 'Cancelada',
        doctor: 'Dr. Martínez',
        boxAsignado: 'Box 1',
      } as Cita,
    ]

    const result = validarSlotDisponible(
      3,
      '2026-10-15',
      '14:00',
      '15:00',
      'Dr. Martínez',
      'Box 1',
      citasConCancelada
    )

    expect(result.disponible).toBe(true)
    expect(result.hayConflicto).toBe(false)
  })
})
