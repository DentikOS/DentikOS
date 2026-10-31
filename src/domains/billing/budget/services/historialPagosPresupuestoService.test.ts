import { beforeEach, describe, expect, it, vi } from 'vitest'
import { historialPagosPresupuestoService } from './historialPagosPresupuestoService'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'

const clinicaId = 'aaaaaaaa-1111-4222-8333-444444444444'
const pacienteId = 'bbbbbbbb-1111-4222-8333-444444444444'
const presupuestoId = 'cccccccc-1111-4222-8333-444444444444'
const { fromMock, selectMock, eqMock, orderMock } = vi.hoisted(() => ({
  fromMock: vi.fn(), selectMock: vi.fn(), eqMock: vi.fn(), orderMock: vi.fn(),
}))
vi.mock('../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: vi.fn() }))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true, supabase: { from: fromMock },
}))

describe('historial de pagos de presupuesto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getClinicaActivaSync).mockReturnValue(clinicaId)
    fromMock.mockReturnValue({ select: selectMock })
    selectMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ eq: eqMock, order: orderMock })
    orderMock.mockResolvedValue({ data: [{
      id: 'pago-1', monto: 25000, metodo_pago: 'transferencia', fecha: '2026-10-30', referencia: 'Ref-123',
    }], error: null })
  })

  it('filtra por clínica, paciente y presupuesto antes de mostrar pagos', async () => {
    const pagos = await historialPagosPresupuestoService.listar(presupuestoId, pacienteId)
    expect(supabase!.from).toHaveBeenCalledWith('pagos')
    expect(eqMock).toHaveBeenCalledWith('clinica_id', clinicaId)
    expect(eqMock).toHaveBeenCalledWith('paciente_id', pacienteId)
    expect(eqMock).toHaveBeenCalledWith('presupuesto_id', presupuestoId)
    expect(pagos).toEqual([{ id: 'pago-1', monto: 25000, metodoPago: 'transferencia', fecha: '2026-10-30', referencia: 'Ref-123' }])
  })

  it('falla cerrado sin clínica o con identificadores no sincronizados', async () => {
    vi.mocked(getClinicaActivaSync).mockReturnValue(null)
    await expect(historialPagosPresupuestoService.listar(presupuestoId, pacienteId)).rejects.toThrow('clínica activa')
    vi.mocked(getClinicaActivaSync).mockReturnValue(clinicaId)
    await expect(historialPagosPresupuestoService.listar('local', pacienteId)).rejects.toThrow('clínica activa')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('no expone el error interno de Supabase', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'detalle interno sensible' } })
    await expect(historialPagosPresupuestoService.listar(presupuestoId, pacienteId)).rejects.toThrow('No se pudo consultar')
  })
})
