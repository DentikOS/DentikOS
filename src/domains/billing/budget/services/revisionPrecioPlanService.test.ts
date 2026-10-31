import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revisionPrecioPlanService } from './revisionPrecioPlanService'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))
vi.mock('../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: vi.fn() }))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true, supabase: { rpc: rpcMock },
}))

const input = {
  presupuestoId: 'aaaaaaaa-1111-4222-8333-444444444444',
  pacienteId: 'bbbbbbbb-1111-4222-8333-444444444444',
  planRevision: '2026-10-30T12:00:00.000Z', version: 2,
  motivo: 'Precio revisado por dentista',
}

describe('revisión de precios del plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getClinicaActivaSync).mockReturnValue('cccccccc-1111-4222-8333-444444444444')
    rpcMock.mockResolvedValue({ data: [{ nueva_revision: '2026-10-31T00:00:00.000Z', nueva_version: 3 }], error: null })
  })

  it('envía revisión y motivo al RPC y acepta solo la confirmación', async () => {
    await expect(revisionPrecioPlanService.confirmar(input)).resolves.toEqual({
      nuevaRevision: '2026-10-31T00:00:00.000Z', nuevaVersion: 3,
    })
    expect(supabase!.rpc).toHaveBeenCalledWith('revisar_precios_plan_desde_presupuesto', {
      p_presupuesto_id: input.presupuestoId, p_paciente_id: input.pacienteId,
      p_plan_revision: input.planRevision, p_version_esperada: 2, p_motivo: input.motivo,
    })
  })

  it('rechaza contexto e identificadores inválidos sin llamar a Supabase', async () => {
    vi.mocked(getClinicaActivaSync).mockReturnValue(null)
    await expect(revisionPrecioPlanService.confirmar(input)).rejects.toThrow('borrador sincronizado')
    vi.mocked(getClinicaActivaSync).mockReturnValue('cccccccc-1111-4222-8333-444444444444')
    await expect(revisionPrecioPlanService.confirmar({ ...input, presupuestoId: 'local' })).rejects.toThrow('borrador sincronizado')
    await expect(revisionPrecioPlanService.confirmar({ ...input, motivo: ' ' })).rejects.toThrow('motivo válido')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('no confirma ni expone detalles internos si la transacción falla', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'detalle sensible' } })
    await expect(revisionPrecioPlanService.confirmar(input)).rejects.toThrow('Actualiza el plan')
  })
})
