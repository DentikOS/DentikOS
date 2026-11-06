import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  clinicaLocal: '11111111-1111-4111-8111-111111111111' as string | null,
  getSession: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn()
}))

vi.mock('../../../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: () => state.clinicaLocal
}))

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    auth: { getSession: state.getSession },
    rpc: state.rpc,
    from: state.from
  }
}))

import { laboratorioFinanceService } from './laboratorioFinanceService'

const clinicaId = '11111111-1111-4111-8111-111111111111'
const ordenId = '33333333-3333-4333-8333-333333333333'

describe('laboratorioFinanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.clinicaLocal = clinicaId
    state.getSession.mockResolvedValue({
      data: { session: { user: { id: '22222222-2222-4222-8222-222222222222' } } },
      error: null
    })
    state.rpc.mockImplementation(async (name: string) => name === 'clinica_actual'
      ? { data: clinicaId, error: null }
      : { data: null, error: null })
  })

  it('falla cerrado sin sesión y si el tenant del servidor difiere', async () => {
    state.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await expect(laboratorioFinanceService.obtenerResumenPagos(ordenId)).rejects.toThrow('sesión autenticada')
    expect(state.rpc).not.toHaveBeenCalled()

    state.getSession.mockResolvedValue({
      data: { session: { user: { id: '22222222-2222-4222-8222-222222222222' } } }, error: null
    })
    state.rpc.mockResolvedValue({ data: '44444444-4444-4444-8444-444444444444', error: null })
    await expect(laboratorioFinanceService.obtenerResumenPagos(ordenId)).rejects.toThrow('no coincide')
    expect(state.rpc).toHaveBeenCalledTimes(1)
  })

  it('consulta el precio al paciente mediante la proyección sin costo', async () => {
    state.rpc.mockImplementation(async (name: string) => name === 'clinica_actual'
      ? { data: clinicaId, error: null }
      : { data: { orden_id: ordenId, precio_paciente: 160000 }, error: null })

    await expect(laboratorioFinanceService.obtenerPrecioPaciente(ordenId)).resolves.toEqual(160000)
    expect(state.rpc).toHaveBeenLastCalledWith('precio_paciente_orden_laboratorio', { p_orden_id: ordenId })
  })

  it('lee el costo desde la relación restringida y aplica el filtro de tenant', async () => {
    const query: Record<string, unknown> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.maybeSingle = vi.fn(async () => ({ data: {
      orden_id: ordenId, costo_total: 100000, precio_paciente: 160000, moneda: 'CLP'
    }, error: null }))
    state.from.mockReturnValue(query)

    await expect(laboratorioFinanceService.obtenerCostoOrden(ordenId)).resolves.toEqual({
      ordenId, costoTotal: 100000, precioPaciente: 160000, moneda: 'CLP'
    })
    expect(state.from).toHaveBeenCalledWith('ordenes_laboratorio_costos')
    expect(query.eq).toHaveBeenNthCalledWith(1, 'clinica_id', clinicaId)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'orden_id', ordenId)
  })

  it('registra pagos parciales únicamente mediante el RPC idempotente', async () => {
    const respuesta = { id: '55555555-5555-4555-8555-555555555555', orden_id: ordenId, monto: 30000 }
    state.rpc.mockImplementation(async (name: string) => name === 'clinica_actual'
      ? { data: clinicaId, error: null }
      : { data: respuesta, error: null })

    await expect(laboratorioFinanceService.registrarPago({
      ordenId, monto: 30000, fecha: '2026-11-05', metodoPago: 'Transferencia',
      idempotencyKey: '66666666-6666-4666-8666-666666666666'
    })).resolves.toEqual(respuesta)
    expect(state.rpc).toHaveBeenLastCalledWith('registrar_pago_laboratorio', {
      p_orden_id: ordenId,
      p_monto: 30000,
      p_fecha: '2026-11-05',
      p_metodo_pago: 'Transferencia',
      p_idempotency_key: '66666666-6666-4666-8666-666666666666'
    })
    expect(state.from).not.toHaveBeenCalled()
  })
})
