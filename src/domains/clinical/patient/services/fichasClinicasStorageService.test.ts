import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fichasClinicasStorageService } from './fichasClinicasStorageService'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { tenantCache } from '../../../../infrastructure/tenant/tenantCache'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        const query = { eq: vi.fn(), maybeSingle: mocks.maybeSingle }
        query.eq.mockReturnValue(query)
        return query
      }),
      upsert: mocks.upsert,
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}))

vi.mock('../../../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: vi.fn(() => '123e4567-e89b-12d3-a456-426614174001'),
}))

vi.mock('../../../../infrastructure/tenant/tenantCache', () => ({
  tenantCache: {
    leerTenant: vi.fn(),
    escribirTenant: vi.fn(),
  },
}))

describe('fichasClinicasStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getClinicaActivaSync).mockReturnValue('123e4567-e89b-12d3-a456-426614174001')
    vi.mocked(tenantCache.escribirTenant).mockReturnValue(true)
    mocks.maybeSingle.mockResolvedValue({
      data: {
        paciente_id: '123e4567-e89b-12d3-a456-426614174000',
        clinica_id: '123e4567-e89b-12d3-a456-426614174001',
        odontograma: { piezas: [{ numero: '1.8', estado: 'sano' }] },
      },
      error: null,
    })
    mocks.upsert.mockResolvedValue({ error: null })
  })

  it('retorna null si pacienteId no es provisto', async () => {
    const res = await fichasClinicasStorageService.obtenerFichaClinica('')
    expect(res).toBeNull()
  })

  it('obtiene la ficha desde Supabase cuando el UUID es válido', async () => {
    const res = await fichasClinicasStorageService.obtenerFichaClinica('123e4567-e89b-12d3-a456-426614174000')
    expect(res).toBeDefined()
    expect(res?.paciente_id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(res?.odontograma).toEqual({ piezas: [{ numero: '1.8', estado: 'sano' }] })
    const query = vi.mocked(supabase!.from).mock.results[0].value.select.mock.results[0].value
    expect(query.eq).toHaveBeenCalledWith('clinica_id', '123e4567-e89b-12d3-a456-426614174001')
  })

  it('rechaza lectura y escritura sin clínica activa y no toca Supabase', async () => {
    vi.mocked(getClinicaActivaSync).mockReturnValue(null)
    const pacienteId = '123e4567-e89b-12d3-a456-426614174000'
    expect(await fichasClinicasStorageService.obtenerFichaClinica(pacienteId)).toBeNull()
    expect(await fichasClinicasStorageService.guardarSeccionFicha(pacienteId, 'odontograma', {})).toBe(false)
    expect(supabase!.from).not.toHaveBeenCalled()
    expect(tenantCache.escribirTenant).not.toHaveBeenCalled()
  })

  it('rechaza ficha remota y caché cuyo paciente o clínica no coincide', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: {
      paciente_id: '123e4567-e89b-12d3-a456-426614174000',
      clinica_id: '123e4567-e89b-12d3-a456-426614174002',
    }, error: null })
    vi.mocked(tenantCache.leerTenant).mockReturnValue({
      paciente_id: '123e4567-e89b-12d3-a456-426614174000',
      clinica_id: '123e4567-e89b-12d3-a456-426614174002',
    } as any)
    const res = await fichasClinicasStorageService.obtenerFichaClinica('123e4567-e89b-12d3-a456-426614174000')
    expect(res?.odontograma).toEqual({ piezas: [] })
    expect(tenantCache.escribirTenant).not.toHaveBeenCalled()
    expect(await fichasClinicasStorageService.guardarSeccionFicha('123e4567-e89b-12d3-a456-426614174000', 'odontograma', {})).toBe(false)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('guarda una sección específica de la ficha clínica', async () => {
    const success = await fichasClinicasStorageService.guardarSeccionFicha(
      '123e4567-e89b-12d3-a456-426614174000',
      'odontograma',
      { piezas: [{ numero: '1.1', estado: 'caries' }] }
    )
    expect(success).toBe(true)
  })

  it('crea un canal Realtime y permite desuscribirse', () => {
    const unsub = fichasClinicasStorageService.suscribirFichaRealtime(
      '123e4567-e89b-12d3-a456-426614174000',
      vi.fn()
    )
    expect(typeof unsub).toBe('function')
    unsub()
  })
})
