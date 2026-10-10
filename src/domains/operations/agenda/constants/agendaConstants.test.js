import { describe, it, expect } from 'vitest'
import {
  SILLONES_DENTALES,
  BOXES_DENTALES,
  TIPOS_BLOQUEO_AGENDA,
  TIPOS_BLOQUEO,
  ESTADOS_CITA,
  ESTADOS_CITA_GOLD,
  TRATAMIENTOS_RAPIDOS
} from './agendaConstants'

describe('agendaConstants', () => {
  it('contiene sillones dentales y alias boxes', () => {
    expect(SILLONES_DENTALES.length).toBe(3)
    expect(BOXES_DENTALES).toBe(SILLONES_DENTALES)
  })

  it('contiene tipos de bloqueo y estados de cita', () => {
    expect(TIPOS_BLOQUEO_AGENDA.length).toBeGreaterThan(0)
    expect(ESTADOS_CITA.AGENDADO.id).toBe('Agendado')
    expect(ESTADOS_CITA_GOLD.length).toBe(6)
  })

  it('contiene tratamientos rapidos predefinidos', () => {
    expect(TRATAMIENTOS_RAPIDOS.length).toBeGreaterThan(0)
  })

  it('contiene los 6 tipos oficiales de bloqueo de BP05', () => {
    expect(Object.keys(TIPOS_BLOQUEO)).toEqual([
      'ALMUERZO',
      'PROCEDIMIENTO_LARGO',
      'VACACIONES',
      'MANTENIMIENTO',
      'CAPACITACION',
      'PERSONALIZADO'
    ])
  })
})
