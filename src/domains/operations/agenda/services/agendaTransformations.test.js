import { describe, it, expect } from 'vitest'
import {
  normalizarEstadoParaSupabase,
  desnormalizarEstadoParaCodigo,
  transformarDesdeSupabase,
  transformarParaSupabase
} from './agendaTransformations'

describe('agendaTransformations', () => {
  it('normaliza y desnormaliza estados de cita correctamente', () => {
    expect(normalizarEstadoParaSupabase('Agendado')).toBe('Agendada')
    expect(normalizarEstadoParaSupabase('En atención')).toBe('EnAtencion')
    expect(desnormalizarEstadoParaCodigo('EnAtencion')).toBe('En atención')
    expect(desnormalizarEstadoParaCodigo('Agendada')).toBe('Pendiente')
  })

  it('round-trip de estados core persiste sin pérdida (FIX-8)', () => {
    const cores = ['Pendiente', 'Confirmada', 'En sala de espera', 'En atención', 'Completada', 'Cancelada', 'No-show', 'Reagendada', 'Bloqueado']
    cores.forEach((core) => {
      const ida = normalizarEstadoParaSupabase(core)
      const vuelta = desnormalizarEstadoParaCodigo(ida)
      expect(vuelta).toBe(core)
    })
  })

  it('round-trip de estado Bloqueado persiste sin modificación', () => {
    expect(normalizarEstadoParaSupabase('Bloqueado')).toBe('Bloqueado')
    expect(desnormalizarEstadoParaCodigo('Bloqueado')).toBe('Bloqueado')
  })

  it('transforma desde Supabase mapeando snake_case a camelCase y desnormalizando estado', () => {
    const citaDb = {
      id: 'uuid-1',
      paciente_id: 'pac-1',
      paciente_nombre: 'Juan',
      hora_inicio: '10:00',
      estado: 'EnAtencion'
    }
    const js = transformarDesdeSupabase(citaDb)
    expect(js.pacienteId).toBe('pac-1')
    expect(js.pacienteNombre).toBe('Juan')
    expect(js.horaInicio).toBe('10:00')
    expect(js.estado).toBe('En atención')
  })

  it('retorna null si el input es null o undefined', () => {
    expect(transformarDesdeSupabase(null)).toBeNull()
    expect(transformarParaSupabase(null)).toBeNull()
  })

  it('transforma para Supabase excluyendo createdAt, updatedAt y userId', () => {
    const citaJs = {
      id: 'uuid-1',
      pacienteNombre: 'Juan',
      boxAsignado: 'Box 1',
      estado: 'Completada',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      userId: 'user-1'
    }
    const db = transformarParaSupabase(citaJs)
    expect(db.paciente_nombre).toBe('Juan')
    expect(db.box_asignado).toBe('Box 1')
    expect(db.estado).toBe('Completada')
    expect(db.createdAt).toBeUndefined()
    expect(db.updatedAt).toBeUndefined()
    expect(db.userId).toBeUndefined()
  })
})
