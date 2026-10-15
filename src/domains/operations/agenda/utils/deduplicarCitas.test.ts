import { describe, it, expect } from 'vitest'
import { deduplicarCitas } from './deduplicarCitas'
import type { Cita } from '../schemas/citaSchema'

describe('deduplicarCitas utility', () => {
  it('deduplica 2 citas con misma fecha, hora y paciente priorizando la más rica en datos', () => {
    const citaPobre: Cita = {
      id: 12345,
      fecha: '2026-10-15',
      horaInicio: '10:00',
      pacienteNombre: 'Juan Perez',
      estado: 'Pendiente',
    }

    const citaRica: Cita = {
      id: 'uuid-12345',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      pacienteNombre: 'Juan Perez',
      doctor: 'Dr. Miguel Díaz',
      doctorId: 'doc-uuid-1',
      boxAsignado: 'Box 1',
      estado: 'Confirmada',
    }

    const resultado = deduplicarCitas([citaPobre, citaRica])
    expect(resultado).toHaveLength(1)
    expect(resultado[0].doctor).toBe('Dr. Miguel Díaz')
    expect(resultado[0].doctorId).toBe('doc-uuid-1')
    expect(resultado[0].boxAsignado).toBe('Box 1')
  })

  it('no afecta citas con horarios o pacientes distintos', () => {
    const cita1: Cita = {
      id: 'c-1',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      pacienteNombre: 'Juan Perez',
    }

    const cita2: Cita = {
      id: 'c-2',
      fecha: '2026-10-15',
      horaInicio: '11:00',
      pacienteNombre: 'Maria Lopez',
    }

    const resultado = deduplicarCitas([cita1, cita2])
    expect(resultado).toHaveLength(2)
  })
})
