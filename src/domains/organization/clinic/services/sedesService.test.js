import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({
  activeClinicId: '00000000-0000-4000-8000-000000000001',
  cache: new Map(),
  rows: [],
  principalSucursalId: null,
  clinicReadError: null,
  rpcError: null,
  rpcRespuestaVacia: false,
  rpcCitasReasignadas: 2,
  rpcCalls: [],
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
    from: vi.fn((table) => ({
      select: () => {
        if (table === 'clinicas') {
          let clinicId
          const builder = {
            eq: (_column, value) => { clinicId = value; return builder },
            maybeSingle: async () => ({
              data: fixtures.clinicReadError ? null : { id: clinicId, principal_sucursal_id: fixtures.principalSucursalId },
              error: fixtures.clinicReadError,
            }),
          }
          return builder
        }
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
    rpc: vi.fn(async (name, params) => {
      fixtures.rpcCalls.push([name, params])
      if (fixtures.rpcError) return { data: null, error: fixtures.rpcError }
      if (fixtures.rpcRespuestaVacia) return { data: [], error: null }
      fixtures.principalSucursalId = params.p_sucursal_id
      return { data: [{ principal_sucursal_id: params.p_sucursal_id, citas_reasignadas: fixtures.rpcCitasReasignadas }], error: null }
    }),
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
    fixtures.principalSucursalId = null
    fixtures.clinicReadError = null
    fixtures.rpcError = null
    fixtures.rpcRespuestaVacia = false
    fixtures.rpcCitasReasignadas = 2
    fixtures.rpcCalls = []
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
    expect(resultado[0].esPrincipal).toBe(false)
    expect(sedesService.obtenerSedes()[0].id).toBe(fixtures.activeClinicId)
  })

  it('usa la configuración remota como fuente principal y reemplaza la caché vieja', async () => {
    sedesService.guardarSedes([{ ...sedeLocal, nombre: 'Dato local antiguo' }])
    fixtures.rows = [filaNube()]

    const resultado = await sedesService.sincronizarSedesDesdeSupabase()

    expect(fixtures.inserted).toBeNull()
    expect(resultado.map((sede) => sede.nombre)).toEqual(['Sede Remota'])
    expect(sedesService.obtenerSedes().map((sede) => sede.nombre)).toEqual(['Sede Remota'])
    expect(resultado[0].esPrincipal).toBe(false)
  })

  it('usa la sucursal principal guardada en la clínica al sincronizar', async () => {
    const principalId = '00000000-0000-4000-8000-000000000011'
    fixtures.rows = [filaNube(), filaNube({ id: principalId, nombre: 'Principal explícita' })]
    fixtures.principalSucursalId = principalId

    const resultado = await sedesService.sincronizarSedesDesdeSupabase()

    expect(resultado.find((sede) => sede.id === principalId)?.esPrincipal).toBe(true)
    expect(resultado.find((sede) => sede.id !== principalId)?.esPrincipal).toBe(false)
  })

  it('usa la sucursal activa más antigua como compatibilidad antes de aplicar la migración', async () => {
    const antigua = filaNube({ id: '00000000-0000-4000-8000-000000000011', created_at: '2025-01-01T00:00:00Z' })
    const reciente = filaNube({ id: '00000000-0000-4000-8000-000000000012', created_at: '2026-01-01T00:00:00Z' })
    fixtures.rows = [reciente, antigua]
    fixtures.clinicReadError = { code: '42703', message: 'column principal_sucursal_id does not exist' }

    const resultado = await sedesService.sincronizarSedesDesdeSupabase()

    expect(resultado.find((sede) => sede.id === antigua.id)?.esPrincipal).toBe(true)
    expect(resultado.find((sede) => sede.id === reciente.id)?.esPrincipal).toBe(false)
  })

  it('no infiere como principal una sede histórica inactiva ligada al UUID de la clínica', async () => {
    const sedeLegadaInactiva = filaNube({ id: fixtures.activeClinicId, estado: 'inactiva' })
    const sedeActiva = filaNube({ id: '00000000-0000-4000-8000-000000000012', created_at: '2025-01-01T00:00:00Z' })
    fixtures.rows = [sedeLegadaInactiva, sedeActiva]
    fixtures.clinicReadError = { code: '42703', message: 'column principal_sucursal_id does not exist' }

    const resultado = await sedesService.sincronizarSedesDesdeSupabase()

    expect(resultado.find((sede) => sede.id === sedeActiva.id)?.esPrincipal).toBe(true)
    expect(resultado.find((sede) => sede.id === sedeLegadaInactiva.id)?.esPrincipal).toBe(false)
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
    const fila = filaNube({ id: '00000000-0000-4000-8000-000000000011' })
    fixtures.rows = [filaNube(), fila]
    fixtures.principalSucursalId = fixtures.rows[0].id
    await sedesService.sincronizarSedesDesdeSupabase()

    const desactivada = await sedesService.desactivarSedeSincronizada(fila.id)

    expect(desactivada.estado).toBe('inactiva')
    expect(fixtures.updated.estado).toBe('inactiva')
    expect(fixtures.lastFilters).toEqual([
      ['id', fila.id],
      ['clinica_id', fixtures.activeClinicId],
    ])
  })

  it('designa principal mediante RPC y devuelve el conteo confirmado por la nube', async () => {
    const principal = filaNube({ id: '00000000-0000-4000-8000-000000000011' })
    fixtures.rows = [filaNube(), principal]
    await sedesService.sincronizarSedesDesdeSupabase()
    const eventoAgenda = vi.fn()
    window.addEventListener('agenda_citas_necesitan_sync', eventoAgenda)

    const resultado = await sedesService.establecerSedePrincipal(principal.id)

    window.removeEventListener('agenda_citas_necesitan_sync', eventoAgenda)
    expect(fixtures.rpcCalls).toEqual([['designar_sucursal_principal', { p_sucursal_id: principal.id }]])
    expect(resultado).toEqual({ sucursalId: principal.id, citasReasignadas: 2 })
    expect(sedesService.obtenerSedes().find((sede) => sede.id === principal.id)?.esPrincipal).toBe(true)
    expect(eventoAgenda).toHaveBeenCalledOnce()
    expect(eventoAgenda.mock.calls[0][0].detail).toMatchObject({ clinicaId: fixtures.activeClinicId, citasReasignadas: 2 })
  })

  it('no cambia la sucursal principal local cuando la RPC es rechazada', async () => {
    const principalActual = filaNube()
    const candidata = filaNube({ id: '00000000-0000-4000-8000-000000000011' })
    fixtures.rows = [principalActual, candidata]
    fixtures.principalSucursalId = principalActual.id
    await sedesService.sincronizarSedesDesdeSupabase()
    fixtures.rpcError = { code: '42501', message: 'forbidden' }

    await expect(sedesService.establecerSedePrincipal(candidata.id))
      .rejects.toThrow('No se pudo designar la sucursal principal')

    expect(sedesService.obtenerSedes().find((sede) => sede.id === principalActual.id)?.esPrincipal).toBe(true)
    expect(sedesService.obtenerSedes().find((sede) => sede.id === candidata.id)?.esPrincipal).toBe(false)
  })

  it('no marca en caché una principal si la RPC no devuelve una confirmación válida', async () => {
    const principalActual = filaNube()
    const candidata = filaNube({ id: '00000000-0000-4000-8000-000000000011' })
    fixtures.rows = [principalActual, candidata]
    fixtures.principalSucursalId = principalActual.id
    await sedesService.sincronizarSedesDesdeSupabase()
    fixtures.rpcRespuestaVacia = true

    await expect(sedesService.establecerSedePrincipal(candidata.id))
      .rejects.toThrow('La nube no confirmó la sucursal principal')

    expect(sedesService.obtenerSedes().find((sede) => sede.id === principalActual.id)?.esPrincipal).toBe(true)
    expect(sedesService.obtenerSedes().find((sede) => sede.id === candidata.id)?.esPrincipal).toBe(false)
  })

  it('rechaza la desactivación de la sucursal principal antes de escribir en Supabase', async () => {
    const principal = { ...sedeLocal, id: '00000000-0000-4000-8000-000000000010', esPrincipal: true }
    sedesService.guardarSedes([principal])

    await expect(sedesService.desactivarSedeSincronizada(principal.id))
      .rejects.toThrow('Designa otra sucursal principal')

    expect(fixtures.updated).toBeNull()
    expect(sedesService.obtenerSedes()[0].estado).toBe('activa')
  })

  it('marca como principal la primera sucursal creada cuando el catálogo está vacío', async () => {
    const horariosAtencion = Array.from({ length: 7 }, (_, diaSemana) => ({ diaSemana, cerrado: true }))

    const creada = await sedesService.crearSedeSincronizada({
      ...sedeLocal,
      telefono: '+56 2 1234 5678',
      horariosAtencion,
      estado: 'activa',
      activa: true,
    })

    expect(creada.esPrincipal).toBe(true)
    expect(fixtures.rpcCalls).toHaveLength(1)
    expect(fixtures.principalSucursalId).toBe(creada.id)
  })
})
