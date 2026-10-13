import { describe, it, expect } from 'vitest'
import { debeMostrarSugerenciaCompletitud } from './sugerenciasCompletitud'
import type { Paciente } from '../schemas/pacienteSchema'

describe('sugerenciasCompletitud (7 días tras creación)', () => {
  it('retorna false si el paciente no tiene fechaCreacion', () => {
    const paciente = { id: 'p-1', nombre: 'Test' } as Paciente
    expect(debeMostrarSugerenciaCompletitud(paciente)).toBe(false)
  })

  it('retorna false si pasaron más de 7 días tras la creación', () => {
    const hace10Dias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const paciente = {
      id: 'p-1',
      nombre: 'Test',
      fechaCreacion: hace10Dias,
    } as Paciente
    expect(debeMostrarSugerenciaCompletitud(paciente)).toBe(false)
  })

  it('retorna true si fue creado hace 2 días y le faltan datos de contacto/antecedentes', () => {
    const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const paciente = {
      id: 'p-1',
      nombre: 'Test',
      fechaCreacion: hace2Dias,
      email: '',
      direccion: '',
    } as Paciente
    expect(debeMostrarSugerenciaCompletitud(paciente)).toBe(true)
  })

  it('retorna false si el paciente tiene todos sus antecedentes completos', () => {
    const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const paciente = {
      id: 'p-1',
      nombre: 'Test',
      fechaCreacion: hace2Dias,
      email: 'test@example.com',
      direccion: 'Av Siempre Viva 123',
      ocupacion: 'Docente',
      contactoEmergencia: '+56911112222',
      alergias: 'Ninguna',
    } as Paciente
    expect(debeMostrarSugerenciaCompletitud(paciente)).toBe(false)
  })
})
