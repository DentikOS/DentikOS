import { describe, it, expect } from 'vitest'
import {
  SILLONES_DENTALES,
  BOXES_DENTALES,
  TIPOS_BLOQUEO,
  ESTADOS_CITA,
  ESTADOS_CITA_CORE,
  TRATAMIENTOS_RAPIDOS,
  TRAMOS_DURACION,
  calcularDuracionRecomendada
} from './agendaConstants'

describe('agendaConstants (BP05 §02)', () => {
  it('contiene sillones dentales y alias boxes', () => {
    expect(SILLONES_DENTALES.length).toBe(3)
    expect(BOXES_DENTALES).toBe(SILLONES_DENTALES)
  })

  it('contiene únicamente los 8 estados oficiales de cita BP05', () => {
    expect(Object.keys(ESTADOS_CITA)).toHaveLength(8)
    expect(ESTADOS_CITA.PENDIENTE.id).toBe('Pendiente')
    expect(ESTADOS_CITA.CONFIRMADA.id).toBe('Confirmada')
    expect(ESTADOS_CITA.EN_SALA_ESPERA.id).toBe('En sala de espera')
    expect(ESTADOS_CITA.EN_ATENCION.id).toBe('En atención')
    expect(ESTADOS_CITA.COMPLETADA.id).toBe('Completada')
    expect(ESTADOS_CITA.CANCELADA.id).toBe('Cancelada')
    expect(ESTADOS_CITA.NO_SHOW.id).toBe('No-show')
    expect(ESTADOS_CITA.REAGENDADA.id).toBe('Reagendada')
    expect(ESTADOS_CITA_CORE).toHaveLength(8)
  })

  it('define TRAMOS_DURACION oficiales [15, 30, 45, 60, 90, 120]', () => {
    expect(TRAMOS_DURACION).toEqual([15, 30, 45, 60, 90, 120])
  })

  it('calcula duración inteligente por prestación', () => {
    expect(calcularDuracionRecomendada({ nombre: 'Endodoncia molar' })).toBe(90)
    expect(calcularDuracionRecomendada({ nombre: 'Limpieza dental y profilaxis' })).toBe(30)
    expect(calcularDuracionRecomendada({ nombre: 'Obturación resina' })).toBe(45)
    expect(calcularDuracionRecomendada({ duracionEstimada: 60, nombre: 'Otro' })).toBe(60)
    expect(calcularDuracionRecomendada(null)).toBe(30)
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
