import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({
  activeClinicId: '00000000-0000-4000-8000-000000000001',
  cache: new Map(),
  rows: [],
  insertError: null,
  updateError: null,
  inserted: null,
  updated: null,
  lastFilters: [],
  clinicTimezone: 'America/Santiago',
}))

vi.mock('../../../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: () => fixtures.activeClinicId,
}))

vi.mock('../../../../infrastructure/logging/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('../../../../infrastructure/storage/localStorageRepository', () => ({
  createTenantRepository: (baseKey, defaultValue) => ({
    obtener: (fallback = defaultValue) => fixtures.cache.has(baseKey) ? fixtures.cache.get(baseKey) : fallback,
    guardar: (value) => {
      fixtures.cache.set(baseKey, value)
      return true
    },
  }),
}))

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: vi.fn(() => ({
      select: () => {
        let clinicId
        const builder = {
          eq: (_column, value) => { clinicId = value; return builder },
          order: async () => ({ data: fixtures.rows.filter((row) => row.clinica_id === clinicId), error: null }),
        }
        return builder
      },
      insert: (rows) => {
        fixtures.inserted = rows
        const data = Array.isArray(rows) ? rows : [rows]
        const result = fixtures.insertError
          ? { data: null, error: fixtures.insertError }
          : { data: data.map((row) => ({ ...row })), error: null }
        if (!fixtures.insertError) fixtures.rows.push(...result.data)
        const promise = Promise.resolve(result)
        promise.single = async () => ({ data: result.data?.[0] || null, error: result.error })
        return { select: () => promise }
      },
      update: (row) => {
        fixtures.updated = row
        fixtures.lastFilters = []
        const builder = {
          eq: (column, value) => { fixtures.lastFilters.push([column, value]); return builder },
          select: () => ({
            maybeSingle: async () => {
              if (fixtures.updateError) return { data: null, error: fixtures.updateError }
              const id = fixtures.lastFilters.find(([column]) => column === 'id')?.[1]
              const clinicId = fixtures.lastFilters.find(([column]) => column === 'clinica_id')?.[1]
              const index = fixtures.rows.findIndex((item) => item.id === id && item.clinica_id === clinicId)
              if (index < 0) return { data: null, error: null }
              fixtures.rows[index] = { ...fixtures.rows[index], ...row }
              return { data: fixtures.rows[index], error: null }
            },
          }),
        }
        return builder
      },
    })),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}))

vi.mock('./clinicStorageService', () => ({
  clinicStorageService: { obtenerClinica: () => ({ zonaHoraria: fixtures.clinicTimezone }) },
}))

import { supabase } from '../../../../infrastructure/supabase/supabaseClient'
import { sedesService } from './sedesService'

const sedeLocal = {
  nombre: 'Sede Principal',
  direccion: 'Av. Providencia 123',
  comuna: 'Providencia',
  region: 'Metropolitana',
  telefono: '',
  activa: true,
}

const filaNube = (overrides = {}) => ({
  id: '00000000-0000-4000-8000-000000000010',
  clinica_id: fixtures.activeClinicId,
  nombre: 'Sede Remota',
  direccion: 'Av. Providencia 123',
  comuna: 'Providencia',
  region: 'Metropolitana',
  telefono: '+56 2 1234 5678',
  email: null,
  zona_horaria: 'America/Santiago',
  horarios_atencion: [],
  estado: 'activa',
  ...overrides,
})

describe('sedesService', () => {
  beforeEach(() => {
    fixtures.cache.clear()
    fixtures.rows = []
    fixtures.insertError = null
    fixtures.updateError = null
    fixtures.inserted = null
    fixtures.updated = null
    fixtures.lastFilters = []
    fixtures.activeClinicId = '00000000-0000-4000-8000-000000000001'
    fixtures.clinicTimezone = 'America/Santiago'
    vi.mocked(supabase.from).mockClear()
  })

  it('migre la sede local inicial conservando el ID de clínica usado históricamente por Agenda', async () => {
    fixtures.clinicTimezone = 'America/Lima'
    sedesService.guardarSedes([sedeLocal])

    const resultado = await sedesService.sincronizarSedesDesdeSupabase()

    expect(fixtures.inserted).toHaveLength(1)
    expect(fixtures.inserted[0]).toMatchObject({
      id: fixtures.activeClinicId,
      clinica_id: fixtures.activeClinicId,
      nombre: 'Sede Principal',
      zona_horaria: 'America/Lima',
      estado: 'activa',
    })
    expect(resultado[0].id).toBe(fixtures.activeClinicId)
    expect(sedesService.obtenerSedes()[0].id).toBe(fixtures.activeClinicId)
  })

  it('usa la configuración remota como fuente principal y reemplaza la caché vieja', async () => {
    sedesService.guardarSedes([{ ...sedeLocal, nombre: 'Dato local antiguo' }])
    fixtures.rows = [filaNube()]

    const resultado = await sedesService.sincronizarSedesDesdeSupabase()

    expect(fixtures.inserted).toBeNull()
    expect(resultado.map((sede) => sede.nombre)).toEqual(['Sede Remota'])
    expect(sedesService.obtenerSedes().map((sede) => sede.nombre)).toEqual(['Sede Remota'])
  })

  it('rechaza sincronizar un tenant distinto antes de consultar o escribir datos', async () => {
    await expect(sedesService.sincronizarSedesDesdeSupabase('00000000-0000-4000-8000-000000000002'))
      .rejects.toThrow('No se permite sincronizar sucursales fuera de la clínica activa')

    expect(supabase.from).not.toHaveBeenCalled()
    expect(fixtures.inserted).toBeNull()
  })

  it('no cambia la caché local cuando RLS o el servidor rechazan una edición', async () => {
    const sede = { ...sedeLocal, id: '00000000-0000-4000-8000-000000000010', telefono: '+56 2 1234 5678' }
    sedesService.guardarSedes([sede])
    fixtures.updateError = { code: '42501' }

    await expect(sedesService.actualizarSedeSincronizada(sede.id, { nombre: 'Cambio rechazado' }))
      .rejects.toThrow('No se pudo actualizar la sucursal')

    expect(fixtures.lastFilters).toEqual([
      ['id', sede.id],
      ['clinica_id', fixtures.activeClinicId],
    ])
    expect(sedesService.obtenerSedes()[0].nombre).toBe('Sede Principal')
  })

  it('desactivar una sucursal actualiza su estado y no ejecuta un borrado físico', async () => {
    const fila = filaNube()
    fixtures.rows = [fila]
    await sedesService.sincronizarSedesDesdeSupabase()

    const desactivada = await sedesService.desactivarSedeSincronizada(fila.id)

    expect(desactivada.estado).toBe('inactiva')
    expect(fixtures.updated.estado).toBe('inactiva')
    expect(fixtures.lastFilters).toEqual([
      ['id', fila.id],
      ['clinica_id', fixtures.activeClinicId],
    ])
  })
})
