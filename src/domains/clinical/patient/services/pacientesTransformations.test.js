import { describe, it, expect } from 'vitest'
import {
  SNAKE_TO_CAMEL_MAP,
  CAMEL_TO_SNAKE_MAP,
  transformarDesdeSupabase,
  transformarParaSupabase
} from './pacientesTransformations'

describe('pacientesTransformations', () => {
  it('mapea correctamente campos snake_case a camelCase', () => {
    const pacienteDb = {
      id: 'uuid-1',
      contacto_emergencia: 'Mamá',
      examen_intraoral: 'Sin hallazgos',
      otra_columna: 'valor'
    }
    const js = transformarDesdeSupabase(pacienteDb)
    expect(js.contactoEmergencia).toBe('Mamá')
    expect(js.examenIntraoral).toBe('Sin hallazgos')
    expect(js.otra_columna).toBe('valor')
  })

  it('retorna null si pacienteDb es null o undefined', () => {
    expect(transformarDesdeSupabase(null)).toBeNull()
    expect(transformarDesdeSupabase(undefined)).toBeNull()
  })

  it('transforma objeto JS a formato Supabase excluyendo createdAt, updatedAt y userId', () => {
    const pacienteJs = {
      id: 'uuid-1',
      contactoEmergencia: 'Mamá',
      notas: '',
      telefono: '',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      userId: 'user-1'
    }
    const db = transformarParaSupabase(pacienteJs)
    expect(db.contacto_emergencia).toBe('Mamá')
    expect(db.notas).toBe('') // notas preserva string vacio
    expect(db.telefono).toBeNull() // otros campos vacios van como null
    expect(db.createdAt).toBeUndefined()
    expect(db.updatedAt).toBeUndefined()
    expect(db.userId).toBeUndefined()
  })

  it('retorna null si pacienteJs es null o undefined', () => {
    expect(transformarParaSupabase(null)).toBeNull()
    expect(transformarParaSupabase(undefined)).toBeNull()
  })

  it('mapea correctamente columnas BP06 bidireccionalmente', () => {
    const pacienteJs = {
      id: 'uuid-1',
      doctorTratanteId: 'doc-uuid-123',
      motivoBloqueo: 'Mora prolongada',
      fechaUltimaVisita: '2026-05-10T10:00:00Z',
      fechaCreacion: '2026-05-01T08:00:00Z',
      estado: 'activo',
      bloqueado: false,
      etiquetas: ['vip', 'ortodoncia']
    }

    const db = transformarParaSupabase(pacienteJs)
    expect(db.doctor_tratante_id).toBe('doc-uuid-123')
    expect(db.motivo_bloqueo).toBe('Mora prolongada')
    expect(db.fecha_ultima_visita).toBe('2026-05-10T10:00:00Z')
    expect(db.fecha_creacion).toBe('2026-05-01T08:00:00Z')
    expect(db.estado).toBe('activo')
    expect(db.bloqueado).toBe(false)
    expect(db.etiquetas).toEqual(['vip', 'ortodoncia'])

    const transformadoDeVuelta = transformarDesdeSupabase(db)
    expect(transformadoDeVuelta.doctorTratanteId).toBe('doc-uuid-123')
    expect(transformadoDeVuelta.motivoBloqueo).toBe('Mora prolongada')
    expect(transformadoDeVuelta.fechaUltimaVisita).toBe('2026-05-10T10:00:00Z')
    expect(transformadoDeVuelta.fechaCreacion).toBe('2026-05-01T08:00:00Z')
    expect(transformadoDeVuelta.estado).toBe('activo')
    expect(transformadoDeVuelta.bloqueado).toBe(false)
    expect(transformadoDeVuelta.etiquetas).toEqual(['vip', 'ortodoncia'])
  })
})
