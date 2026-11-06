import { beforeEach, describe, expect, it, vi } from 'vitest'
import { timelineService, type EventoTimeline } from './timelineService'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'

const mocks = vi.hoisted(() => ({ insert: vi.fn(), order: vi.fn(), maybeSingle: vi.fn() }))
vi.mock('../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: vi.fn() }))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({
      insert: mocks.insert,
      select: vi.fn(() => {
        const query: { eq: ReturnType<typeof vi.fn>; order: typeof mocks.order; maybeSingle: typeof mocks.maybeSingle } = {
          eq: vi.fn(), order: mocks.order, maybeSingle: mocks.maybeSingle
        }
        query.eq.mockReturnValue(query)
        return query
      }),
    })),
  },
}))

const clinicaId = 'aaaaaaaa-0000-4000-8000-000000000001'
const pacienteId = 'bbbbbbbb-0000-4000-8000-000000000002'

describe('timelineService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(getClinicaActivaSync).mockReturnValue(clinicaId)
    vi.mocked(supabase!.auth.getUser).mockResolvedValue({ data: { user: { id: 'cccccccc-0000-4000-8000-000000000003' } } } as any)
    mocks.insert.mockResolvedValue({ error: null })
    mocks.order.mockResolvedValue({ data: [], error: null })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it('no inventa eventos para una ficha sin historial', () => {
    expect(timelineService.obtenerTimeline(pacienteId)).toEqual([])
  })

  it('persiste evento con clínica y actor antes de mostrarlo', async () => {
    const evento: EventoTimeline = {
      tipo: 'cambio_estado', fecha: new Date().toISOString(),
      titulo: 'Paciente bloqueado por Admin', usuario: 'Admin',
    }
    expect(await timelineService.agregarEvento(pacienteId, evento)).toBe(true)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      paciente_id: pacienteId, clinica_id: clinicaId,
      actor_user_id: 'cccccccc-0000-4000-8000-000000000003',
    }))
    expect(timelineService.obtenerTimeline(pacienteId)[0].titulo).toBe(evento.titulo)
    expect(localStorage.getItem(`sd_${clinicaId}_timeline_${pacienteId}`)).toBeTruthy()
  })

  it('falla sin clínica y no escribe ningún evento', async () => {
    vi.mocked(getClinicaActivaSync).mockReturnValue(null)
    expect(await timelineService.agregarEvento(pacienteId, {
      tipo: 'pago', fecha: new Date().toISOString(), titulo: 'Pago',
    })).toBe(false)
    expect(supabase!.from).not.toHaveBeenCalled()
    expect(timelineService.obtenerTimeline(pacienteId)).toEqual([])
  })

  it('no muestra evento si Supabase rechaza la inserción', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'RLS' } })
    expect(await timelineService.agregarEvento(pacienteId, {
      tipo: 'receta', fecha: new Date().toISOString(), titulo: 'Receta',
    })).toBe(false)
    expect(timelineService.obtenerTimeline(pacienteId)).toEqual([])
  })

  it('acepta un conflicto de ID como reintento solo cuando coincide la misma urgencia', async () => {
    const id = 'dddddddd-0000-4000-8000-000000000004'
    mocks.insert.mockResolvedValue({ error: { code: '23505' } })
    mocks.maybeSingle.mockResolvedValue({ data: {
      id, tipo: 'urgencia_ges', metadata: { urgencia_id: id }
    }, error: null })

    expect(await timelineService.agregarEvento(pacienteId, {
      id, tipo: 'urgencia_ges', fecha: new Date().toISOString(), titulo: 'Urgencia GES',
      metadata: { urgencia_id: id }
    })).toBe(true)

    mocks.maybeSingle.mockResolvedValueOnce({ data: {
      id, tipo: 'urgencia_ges', metadata: { urgencia_id: 'otra-urgencia' }
    }, error: null })
    expect(await timelineService.agregarEvento(pacienteId, {
      id, tipo: 'urgencia_ges', fecha: new Date().toISOString(), titulo: 'Urgencia GES',
      metadata: { urgencia_id: id }
    })).toBe(false)
  })

  it('descarta filas remotas ajenas al paciente o clínica', async () => {
    mocks.order.mockResolvedValue({ data: [
      { id: '1', paciente_id: pacienteId, clinica_id: clinicaId, tipo: 'cita', fecha: '2026-10-30', titulo: 'Cita propia' },
      { id: '2', paciente_id: pacienteId, clinica_id: 'otra-clinica', tipo: 'cita', fecha: '2026-10-30', titulo: 'Cita ajena' },
    ], error: null })
    expect((await timelineService.cargarTimeline(pacienteId)).map((e) => e.titulo)).toEqual(['Cita propia'])
  })
})
