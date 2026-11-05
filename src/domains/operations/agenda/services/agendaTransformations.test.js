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

  it('persiste y recupera la sucursal y el box sin sustituir su etiqueta histórica', () => {
    const cita = {
      id: '33333333-3333-4333-8333-333333333333',
      fecha: '2026-11-05',
      horaInicio: '10:00',
      estado: 'Pendiente',
      boxAsignado: 'Box Norte',
      sedeId: '11111111-1111-4111-8111-111111111111',
      boxId: '22222222-2222-4222-8222-222222222222',
    }
    const fila = transformarParaSupabase(cita)
    expect(fila.sede_id).toBe(cita.sedeId)
    expect(fila.box_id).toBe(cita.boxId)

    const recuperada = transformarDesdeSupabase({ ...fila, id: cita.id })
    expect(recuperada.sedeId).toBe(cita.sedeId)
    expect(recuperada.boxId).toBe(cita.boxId)
    expect(recuperada.boxAsignado).toBe('Box Norte')
  })

  it('mantiene las citas históricas sin sucursal ni box configurado', () => {
    const recuperada = transformarDesdeSupabase({ id: '33333333-3333-4333-8333-333333333333', notas: '{"boxAsignado":"Sillón antiguo"}' })
    expect(recuperada.sedeId).toBeUndefined()
    expect(recuperada.boxId).toBeUndefined()
    expect(recuperada.boxAsignado).toBe('Sillón antiguo')
  })
})
