import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pagosService } from './pagosService'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { presupuestosStorageService } from './presupuestosStorageService'
import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: { rpc: vi.fn() },
}))
vi.mock('../../../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: vi.fn(),
}))
vi.mock('./presupuestosStorageService', () => ({
  presupuestosStorageService: { aplicarAbonoConfirmado: vi.fn() },
}))

const presupuestoId = '11111111-2222-4333-8444-555555555555'
const clinicaId = 'aaaaaaaa-2222-4333-8444-555555555555'

describe('pagosService (BP07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getClinicaActivaSync).mockReturnValue(clinicaId)
    usePresupuestosStore.setState({ presupuestos: [{
      id: presupuestoId, folio: 'P-101', pacienteNombre: 'Ana Valenzuela',
      estado: 'aprobado', totalAPagar: 100000, montoAbonado: 0,
    }] })
  })

  it('actualiza el estado local solo tras confirmación del RPC', async () => {
    vi.mocked(supabase!.rpc).mockImplementation(async (_name, args) => ({
      data: [{ pago_id: args.p_pago_id, monto_abonado: 40000, estado_presupuesto: 'en-curso' }],
      error: null,
    }) as any)
    const resultado = await pagosService.registrarPagoManual({
      presupuestoId, monto: 40000, medioPago: 'transferencia', referencia: 'Comprobante 123',
    })
    expect(resultado.exito).toBe(true)
    expect(supabase!.rpc).toHaveBeenCalledWith('registrar_abono_presupuesto', expect.objectContaining({
      p_presupuesto_id: presupuestoId, p_monto: 40000, p_metodo_pago: 'transferencia',
    }))
    expect(presupuestosStorageService.aplicarAbonoConfirmado).toHaveBeenCalledWith(presupuestoId, 40000, 'en-curso')
    expect(usePresupuestosStore.getState().presupuestos[0].montoAbonado).toBe(40000)
  })

  it('falla sin clínica activa o con identificador inválido sin llamar al RPC', async () => {
    vi.mocked(getClinicaActivaSync).mockReturnValue(null)
    await expect(pagosService.registrarPagoManual({ presupuestoId, monto: 1000, medioPago: 'efectivo' })).rejects.toThrow('sesión clínica')
    vi.mocked(getClinicaActivaSync).mockReturnValue(clinicaId)
    await expect(pagosService.registrarPagoManual({ presupuestoId: 'otro', monto: 1000, medioPago: 'efectivo' })).rejects.toThrow('sesión clínica')
    expect(supabase!.rpc).not.toHaveBeenCalled()
  })

  it('no altera caché ni store si el RPC rechaza el abono', async () => {
    vi.mocked(supabase!.rpc).mockResolvedValue({ data: null, error: { message: 'RLS' } } as any)
    await expect(pagosService.registrarPagoManual({ presupuestoId, monto: 150000, medioPago: 'efectivo' })).rejects.toThrow('No se pudo registrar')
    expect(presupuestosStorageService.aplicarAbonoConfirmado).not.toHaveBeenCalled()
    expect(usePresupuestosStore.getState().presupuestos[0].montoAbonado).toBe(0)
  })
})
