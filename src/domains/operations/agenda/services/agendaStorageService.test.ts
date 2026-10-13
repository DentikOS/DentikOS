import { describe, it, expect, beforeEach, vi } from 'vitest'
import { agendaStorageService } from './agendaStorageService'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe('agendaStorageService.obtenerCitasDesdeSupabase', () => {
  let orderMock: ReturnType<typeof vi.fn>
  let selectMock: ReturnType<typeof vi.fn>
  let eqMock: ReturnType<typeof vi.fn>
  let isMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    agendaStorageService.resetCache()
    localStorage.setItem('clinica_active_user', 'doctor@test.com')
    localStorage.setItem('profile_doctor@test.com', JSON.stringify({ clinicaId: 'clinica-test' }))

    orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'cita-1',
          fecha: '2026-10-20',
          hora_inicio: '10:00',
          estado: 'Agendada',
          paciente_id: 'pac-1',
        },
      ],
      error: null,
    })

    isMock = vi.fn().mockReturnValue({
      order: orderMock,
    })

    eqMock = vi.fn().mockReturnValue({
      is: isMock,
      order: orderMock,
    })

    selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
      order: orderMock,
    })

    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: selectMock,
    })
  })

  it('exporta el método obtenerCitasDesdeSupabase en su API', () => {
    expect(typeof agendaStorageService.obtenerCitasDesdeSupabase).toBe('function')
  })

  it('obtiene y transforma las citas desde Supabase', async () => {
    const citas = await agendaStorageService.obtenerCitasDesdeSupabase()
    expect(supabase.from).toHaveBeenCalledWith('citas')
    expect(Array.isArray(citas)).toBe(true)
    expect(citas.length).toBe(1)
    expect(citas[0].horaInicio).toBe('10:00')
    expect(citas[0].pacienteId).toBe('pac-1')
    expect(citas[0].estado).toBe('Agendado')
  })

  it('retorna citas locales si la consulta a Supabase retorna error', async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: { message: 'Database connection error' } })
    const citas = await agendaStorageService.obtenerCitasDesdeSupabase()
    expect(Array.isArray(citas)).toBe(true)
  })
})
