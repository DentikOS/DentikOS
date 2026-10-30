import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  clinica: '11111111-1111-4111-8111-111111111111',
  paciente: '22222222-2222-4222-8222-222222222222',
  presupuesto: '33333333-3333-4333-8333-333333333333',
  anterior: '44444444-4444-4444-8444-444444444444',
  grupo: '55555555-5555-4555-8555-555555555555',
}
const estado = vi.hoisted(() => ({ clinica: '11111111-1111-4111-8111-111111111111' as string | null,
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn() }))
vi.mock('../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: () => estado.clinica }))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: true,
  supabase: { from: estado.from } }))

import { presupuestoVersionesService } from './presupuestoVersionesService'

describe('presupuestoVersionesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    estado.clinica = ids.clinica
    const cadena = { select: estado.select, eq: estado.eq, in: estado.in, order: estado.order }
    estado.from.mockReturnValue(cadena)
    estado.select.mockReturnValue(cadena)
    estado.eq.mockReturnValue(cadena)
    estado.in.mockReturnValue(cadena)
    estado.order.mockResolvedValue({ data: [{
      presupuesto_id: ids.presupuesto, revision: 1, fecha: '2026-10-30T10:00:00Z',
      actor_user_id: ids.anterior, tipo: 'cambio_financiero', motivo: 'Plan revisado',
      motivo_origen: 'usuario',
      hash_sha256: 'a'.repeat(64), anterior: { monto_total: 10000 }, nuevo: { monto_total: 12000 },
    }], error: null })
  })

  it('consulta solo presupuesto, paciente y clínica autorizados y transforma el snapshot', async () => {
    const versiones = await presupuestoVersionesService.listar({ id: ids.presupuesto,
      pacienteId: ids.paciente, versionGrupoId: ids.grupo }, [
      { id: ids.anterior, pacienteId: ids.paciente, versionGrupoId: ids.grupo },
      { id: ids.presupuesto, pacienteId: ids.paciente, versionGrupoId: ids.grupo },
      { id: '66666666-6666-4666-8666-666666666666', pacienteId: '77777777-7777-4777-8777-777777777777', versionGrupoId: ids.grupo },
    ])
    expect(estado.from).toHaveBeenCalledWith('presupuesto_versiones')
    expect(estado.eq).toHaveBeenCalledWith('clinica_id', ids.clinica)
    expect(estado.eq).toHaveBeenCalledWith('paciente_id', ids.paciente)
    expect(estado.in).toHaveBeenCalledWith('presupuesto_id', [ids.anterior, ids.presupuesto])
    expect(versiones[0]).toEqual(expect.objectContaining({ motivo: 'Plan revisado',
      totalAnterior: 10000, totalNuevo: 12000, usuario: ids.anterior }))
  })

  it('falla cerrado sin clínica activa', async () => {
    estado.clinica = null
    await expect(presupuestoVersionesService.listar({ id: ids.presupuesto,
      pacienteId: ids.paciente }, [])).rejects.toThrow('clínica activa')
    expect(estado.from).not.toHaveBeenCalled()
  })
})
