import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({
  activeClinicId: '00000000-0000-4000-8000-000000000001',
  activeBranchId: '00000000-0000-4000-8000-000000000010',
  cache: new Map(),
  rows: [],
  insertError: null,
  updateError: null,
  inserted: null,
  updated: null,
  filters: [],
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
      insert: (row) => {
        fixtures.inserted = row
        const result = fixtures.insertError
          ? { data: null, error: fixtures.insertError }
          : { data: { ...row }, error: null }
        if (!fixtures.insertError) fixtures.rows.push(result.data)
        const promise = Promise.resolve(result)
        promise.single = async () => result
        return { select: () => promise }
      },
      update: (row) => {
        fixtures.updated = row
        fixtures.filters = []
        const builder = {
          eq: (column, value) => { fixtures.filters.push([column, value]); return builder },
          select: () => ({
            maybeSingle: async () => {
              if (fixtures.updateError) return { data: null, error: fixtures.updateError }
              const id = fixtures.filters.find(([column]) => column === 'id')?.[1]
              const clinicId = fixtures.filters.find(([column]) => column === 'clinica_id')?.[1]
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

vi.mock('./sedesService', () => ({
  sedesService: {
    obtenerSedes: () => [{ id: fixtures.activeBranchId, clinicaId: fixtures.activeClinicId, estado: 'activa' }],
  },
}))

import { supabase } from '../../../../infrastructure/supabase/supabaseClient'
import { boxesClinicosService } from './boxesClinicosService'

const boxFila = (overrides = {}) => ({
  id: '00000000-0000-4000-8000-000000000020',
  clinica_id: fixtures.activeClinicId,
  sucursal_id: fixtures.activeBranchId,
  nombre: 'Box General',
  tipo: 'general',
  unidad_dental: 'A-dec 500',
  anio_instalacion: 2024,
  equipamiento: [{ tipo: 'lampara_fotocurado', marca: 'Elipar', serial: 'SER-01' }],
  notas: '',
  estado: 'activo',
  ...overrides,
})

describe('boxesClinicosService', () => {
  beforeEach(() => {
    fixtures.cache.clear()
    fixtures.rows = []
    fixtures.insertError = null
    fixtures.updateError = null
    fixtures.inserted = null
    fixtures.updated = null
    fixtures.filters = []
    fixtures.activeClinicId = '00000000-0000-4000-8000-000000000001'
    fixtures.activeBranchId = '00000000-0000-4000-8000-000000000010'
    vi.mocked(supabase.from).mockClear()
  })

  it('sincroniza boxes y su equipamiento desde la clínica activa', async () => {
    fixtures.rows = [boxFila()]

    const boxes = await boxesClinicosService.sincronizarDesdeSupabase()

    expect(boxes).toMatchObject([{
      id: boxFila().id,
      clinicaId: fixtures.activeClinicId,
      sucursalId: fixtures.activeBranchId,
      unidadDental: 'A-dec 500',
      equipamiento: [{ tipo: 'lampara_fotocurado', marca: 'Elipar', serial: 'SER-01' }],
    }])
    expect(boxesClinicosService.obtenerBoxes(fixtures.activeBranchId)).toEqual(boxes)
  })

  it('rechaza una sucursal de otro tenant antes de consultar Supabase', async () => {
    await expect(boxesClinicosService.crear('00000000-0000-4000-8000-000000000099', {
      nombre: 'Box ajeno', tipo: 'general', unidadDental: 'Unidad dental', equipamiento: [], estado: 'activo', notas: '', anioInstalacion: null,
    })).rejects.toThrow('La sucursal no pertenece a la clínica activa')

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('guarda el box asociado explícitamente a la clínica y sucursal activas', async () => {
    const creado = await boxesClinicosService.crear(fixtures.activeBranchId, {
      nombre: 'Box Cirugía', tipo: 'cirugia', unidadDental: 'Planmeca E1', anioInstalacion: 2024,
      equipamiento: [{ tipo: 'microscopio_dental', marca: 'Zeiss', serial: 'Z-44' }], estado: 'activo', notas: 'Unidad quirúrgica',
    })

    expect(fixtures.inserted).toMatchObject({
      clinica_id: fixtures.activeClinicId,
      sucursal_id: fixtures.activeBranchId,
      nombre: 'Box Cirugía',
    })
    expect(creado.equipamiento[0]).toMatchObject({ tipo: 'microscopio_dental', serial: 'Z-44' })
  })

  it('filtra actualizaciones por ID y clínica y no modifica caché si RLS rechaza', async () => {
    fixtures.rows = [boxFila()]
    await boxesClinicosService.sincronizarDesdeSupabase()
    fixtures.updateError = { code: '42501' }

    await expect(boxesClinicosService.actualizar(boxFila().id, { nombre: 'Cambio no autorizado' }))
      .rejects.toThrow('No se pudo actualizar el box')

    expect(fixtures.filters).toEqual([
      ['id', boxFila().id],
      ['clinica_id', fixtures.activeClinicId],
    ])
    expect(boxesClinicosService.obtenerBoxes(fixtures.activeBranchId)[0].nombre).toBe('Box General')
  })
})
