import { beforeEach, describe, expect, it, vi } from 'vitest'

const clinica = '11111111-1111-4111-8111-111111111111'
const paciente = '22222222-2222-4222-8222-222222222222'
const presupuestoId = '33333333-3333-4333-8333-333333333333'
const grupo = '44444444-4444-4444-8444-444444444444'
const estado = vi.hoisted(() => ({ clinica: '11111111-1111-4111-8111-111111111111' as string | null,
  rpc: vi.fn(), sincronizar: vi.fn(), from: vi.fn() }))

vi.mock('../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: () => estado.clinica }))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: true, supabase: { rpc: estado.rpc, from: estado.from } }))
vi.mock('./presupuestosStorageService', () => ({ presupuestosStorageService: { sincronizarDesdeSupabase: estado.sincronizar } }))

import { presupuestoPlanSyncService } from './presupuestoPlanSyncService'

const itemPlan = { id: '55555555-5555-4555-8555-555555555555', origenPlanProcedimientoId: 'proc-1',
  precioPlanOriginal: 12000, nombrePrestacion: 'Endodoncia', cantidad: 1, precioUnitario: 12000,
  descuento: 0, subtotal: 12000, faseClinica: 'urgencias' as const }
const borrador = { id: presupuestoId, pacienteId: paciente, origenPlan: true,
  estado: 'borrador', montoAbonado: 0, version: 1, items: [itemPlan], sincronizado: true }

describe('presupuestoPlanSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    estado.clinica = clinica
    estado.rpc.mockResolvedValue({ data: presupuestoId, error: null })
    estado.sincronizar.mockResolvedValue([])
  })

  it('fusiona ítems y solicita actualización transaccional del borrador', async () => {
    const manual = { id: '66666666-6666-4666-8666-666666666666', nombrePrestacion: 'Ítem manual',
      cantidad: 1, precioUnitario: 5000, descuento: 0, subtotal: 5000 }
    await presupuestoPlanSyncService.actualizarBorrador({ ...borrador, items: [itemPlan, manual] }, paciente,
      '2026-10-30T15:00:00Z', [{ ...itemPlan, precioPlanOriginal: 14000, precioUnitario: 14000, subtotal: 14000 }])
    expect(estado.rpc).toHaveBeenCalledWith('sincronizar_borrador_desde_plan', expect.objectContaining({
      p_presupuesto_id: presupuestoId,
      p_version_esperada: 1,
      p_items: [expect.objectContaining({ subtotal: 14000 }), manual],
    }))
    expect(estado.sincronizar).toHaveBeenCalledOnce()
  })

  it('rechaza presupuesto de otro paciente antes del RPC', async () => {
    await expect(presupuestoPlanSyncService.actualizarBorrador(borrador, grupo, 'revision', [itemPlan]))
      .rejects.toThrow('este paciente')
    expect(estado.rpc).not.toHaveBeenCalled()
  })

  it('no crea nueva versión si el origen sigue en borrador', async () => {
    await expect(presupuestoPlanSyncService.crearVersionDesdePlan({ ...borrador, versionGrupoId: grupo }, paciente,
      'revision-nueva', [itemPlan])).rejects.toThrow('versión anterior')
    expect(estado.rpc).not.toHaveBeenCalled()
  })

  it('crea versión nueva sin modificar la anterior', async () => {
    await presupuestoPlanSyncService.crearVersionDesdePlan({ ...borrador, estado: 'aprobado',
      versionGrupoId: grupo, planRevision: 'revision-anterior' }, paciente, 'revision-nueva', [itemPlan])
    expect(estado.rpc).toHaveBeenCalledWith('crear_version_presupuesto_desde_plan', expect.objectContaining({
      p_presupuesto_id: presupuestoId, p_plan_revision: 'revision-nueva',
    }))
  })
})
