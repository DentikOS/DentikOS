import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clinicConfigService } from './clinicConfigService'

// Mock Supabase
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: '1', fecha: '2026-12-25', nombre: 'Navidad', tipo: 'nacional', recurrente: true, created_at: '2026-01-01' },
          { id: '2', fecha: '2026-09-18', nombre: 'Fiestas Patrias', tipo: 'nacional', recurrente: true, created_at: '2026-01-01' },
        ],
        error: null,
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: '1',
          clinica_id: 'clinica-1',
          horario_inicio_default: '08:00',
          horario_fin_default: '20:00',
          duracion_bloque_default: 30,
          tiempo_minimo_anticipacion: 0,
          tiempo_maximo_anticipacion: 365,
          permitir_sobrecupos: true,
          max_sobrecupos: 2,
          recepcionista_puede_editar: true,
          recepcionista_puede_cancelar: true,
          recepcionista_puede_dragdrop: true,
          dias_laborables: [1, 2, 3, 4, 5],
          updated_at: '2026-01-01',
        },
        error: null,
      }),
    })),
  },
}))

vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: {
    getState: vi.fn(() => ({
      userProfile: { clinicaId: 'clinica-1', id: 'user-1' }
    }))
  }
}))

describe('clinicConfigService (BP05 §09 Parte 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('obtenerConfig retorna configuración de la clínica', async () => {
    const config = await clinicConfigService.obtenerConfig()
    expect(config).not.toBeNull()
    expect(config?.duracionBloqueDefault).toBe(30)
    expect(config?.permitirSobrecupos).toBe(true)
  })

  it('obtenerFestivos retorna lista de festivos', async () => {
    const festivos = await clinicConfigService.obtenerFestivos()
    expect(festivos.length).toBe(2)
    expect(festivos[0].nombre).toBe('Navidad')
  })

  it('esDiaFestivo detecta día festivo exacto', async () => {
    const result = await clinicConfigService.esDiaFestivo('2026-12-25')
    expect(result.esFestivo).toBe(true)
    expect(result.nombre).toBe('Navidad')
  })

  it('esDiaFestivo detecta festivo recurrente en otro año', async () => {
    const result = await clinicConfigService.esDiaFestivo('2030-12-25')
    expect(result.esFestivo).toBe(true)
    expect(result.nombre).toBe('Navidad')
  })

  it('esDiaFestivo retorna false para día normal', async () => {
    const result = await clinicConfigService.esDiaFestivo('2026-03-15')
    expect(result.esFestivo).toBe(false)
  })
})
