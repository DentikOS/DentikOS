import { describe, it, expect } from 'vitest'
import { normalizarCita, normalizarEstado, normalizarDoctor, esUuid } from './normalizarCita'
import type { Cita } from '../schemas/citaSchema'

describe('normalizarCita utility', () => {
  it('identifica UUIDs correctamente', () => {
    expect(esUuid('b7a0d4c8-3e4b-4f1a-9a5c-123456789abc')).toBe(true)
    expect(esUuid('Dr. Miguel Díaz')).toBe(false)
    expect(esUuid('')).toBe(false)
  })

  it('normaliza estados legacy a estados core BP05 §02', () => {
    expect(normalizarEstado('Agendado')).toBe('Pendiente')
    expect(normalizarEstado('Agendada')).toBe('Pendiente')
    expect(normalizarEstado('Confirmado')).toBe('Confirmada')
    expect(normalizarEstado('En Espera')).toBe('En sala de espera')
    expect(normalizarEstado('EnEspera')).toBe('En sala de espera')
    expect(normalizarEstado('Atendido')).toBe('Completada')
    expect(normalizarEstado('Cancelado')).toBe('Cancelada')
    expect(normalizarEstado('Confirmada')).toBe('Confirmada')
  })

  it('mueve UUID en doctor a doctorId y resuelve nombre legible con mapaDoctores', () => {
    const uuid = 'b7a0d4c8-3e4b-4f1a-9a5c-123456789abc'
    const mapa = { [uuid]: 'Dra. Carolina Soto' }
    const cita: Cita = {
      id: 'c-1',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      doctor: uuid,
      estado: 'Agendado',
    }

    const norm = normalizarCita(cita, mapa)
    expect(norm.doctorId).toBe(uuid)
    expect(norm.doctor).toBe('Dra. Carolina Soto')
    expect(norm.estado).toBe('Pendiente')
  })

  it('conserva el nombre legible si doctor no es un UUID', () => {
    const cita: Cita = {
      id: 'c-2',
      fecha: '2026-10-15',
      horaInicio: '11:00',
      doctor: 'Dr. Miguel Díaz',
      estado: 'Confirmada',
    }

    const norm = normalizarCita(cita, {})
    expect(norm.doctor).toBe('Dr. Miguel Díaz')
    expect(norm.estado).toBe('Confirmada')
  })
})
