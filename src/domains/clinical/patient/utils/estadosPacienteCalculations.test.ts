import { describe, it, expect } from 'vitest'
import {
  calcularDiasSinVisita,
  calcularEstadoClinico,
} from './estadosPacienteCalculations'
import type { Paciente } from '../schemas/pacienteSchema'

describe('estadosPacienteCalculations (BP06 §04)', () => {
  it('calcularDiasSinVisita retorna null si no hay fecha o es inválida', () => {
    expect(calcularDiasSinVisita()).toBeNull()
    expect(calcularDiasSinVisita(null)).toBeNull()
    expect(calcularDiasSinVisita('')).toBeNull()
    expect(calcularDiasSinVisita('fecha-invalida')).toBeNull()
  })

  it('calcularDiasSinVisita calcula correctamente los días transcurridos', () => {
    const hace10Dias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const dias = calcularDiasSinVisita(hace10Dias)
    expect(dias).toBe(10)
  })

  it('calcularEstadoClinico retorna "nuevo" si nunca ha tenido visitas', () => {
    const paciente = { id: 'p-1', nombre: 'Test', rut: '11.111.111-1' } as Paciente
    expect(calcularEstadoClinico(paciente)).toBe('nuevo')
  })

  it('calcularEstadoClinico retorna "activo" si la última visita fue en los últimos 12 meses', () => {
    const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const paciente = {
      id: 'p-1',
      nombre: 'Test',
      rut: '11.111.111-1',
      fechaUltimaVisita: hace30Dias,
    } as Paciente
    expect(calcularEstadoClinico(paciente)).toBe('activo')
  })

  it('calcularEstadoClinico retorna "inactivo" si la última visita fue hace más de 12 meses (360+ días)', () => {
    const hace400Dias = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const paciente = {
      id: 'p-1',
      nombre: 'Test',
      rut: '11.111.111-1',
      fechaUltimaVisita: hace400Dias,
    } as Paciente
    expect(calcularEstadoClinico(paciente)).toBe('inactivo')
  })
})
