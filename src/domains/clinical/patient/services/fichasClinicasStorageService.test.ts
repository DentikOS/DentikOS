import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fichasClinicasStorageService } from './fichasClinicasStorageService'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              paciente_id: '123e4567-e89b-12d3-a456-426614174000',
              clinica_id: '123e4567-e89b-12d3-a456-426614174001',
              odontograma: { piezas: [{ numero: '1.8', estado: 'sano' }] },
            },
            error: null,
          }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
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
