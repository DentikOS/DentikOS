import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  clinic: '11111111-1111-4111-8111-111111111111' as string | null,
  online: true,
  queues: {} as Record<string, unknown[]>,
  crearOrden: vi.fn(),
  transicionarEtapa: vi.fn(),
  estaOnline: vi.fn()
}))

vi.mock('../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: () => state.clinic }))
vi.mock('../../../../infrastructure/storage/localStorageRepository', () => ({
  createTenantRepository: () => ({
    obtener: (fallback: unknown[] = []) => state.clinic ? state.queues[state.clinic] || fallback : fallback,
    guardar: (value: unknown[]) => {
      if (!state.clinic) return false
      state.queues[state.clinic] = value
      return true
    }
  })
}))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  estaOnline: state.estaOnline
}))
vi.mock('./laboratorioCloudService', () => ({
  laboratorioCloudService: {
    crearOrden: state.crearOrden,
    transicionarEtapa: state.transicionarEtapa
  }
}))

import { laboratorioOfflineQueueService } from './laboratorioOfflineQueueService'

const clinicA = '11111111-1111-4111-8111-111111111111'
const clinicB = '22222222-2222-4222-8222-222222222222'
const command = {
  tipo: 'transicionar_etapa' as const,
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  input: {
    ordenId: '44444444-4444-4444-8444-444444444444', etapa: 'prueba' as const,
    idempotencyKey: '33333333-3333-4333-8333-333333333333', versionEsperada: 1
  }
}

describe('laboratorioOfflineQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.clinic = clinicA
    state.online = true
    state.queues = {}
    state.estaOnline.mockImplementation(async () => state.online)
    state.transicionarEtapa.mockResolvedValue({ id: command.input.ordenId })
  })

  it('deduplica una operación encolada por clave idempotente', () => {
    expect(laboratorioOfflineQueueService.encolar(command)).toBe(true)
    expect(laboratorioOfflineQueueService.encolar(command)).toBe(true)
    expect(laboratorioOfflineQueueService.obtenerPendientes()).toHaveLength(1)
  })

  it('solo remueve la operación después de confirmación del servidor', async () => {
    laboratorioOfflineQueueService.encolar(command)
    state.transicionarEtapa.mockRejectedValueOnce(Object.assign(new Error('conflicto de versión'), { code: 'STALE_VERSION' }))

    const result = await laboratorioOfflineQueueService.procesarPendientes()

    expect(result.requiereRevision).toBe(1)
    expect(laboratorioOfflineQueueService.obtenerPendientes()[0]).toEqual(expect.objectContaining({ requiereRevision: true, errorCode: 'STALE_VERSION' }))
  })

  it('conserva la cola de A si la clínica cambia durante la respuesta de red', async () => {
    laboratorioOfflineQueueService.encolar(command)
    let resolveRequest: (value: unknown) => void = () => undefined
    state.transicionarEtapa.mockImplementationOnce(() => new Promise(resolve => { resolveRequest = resolve }))
    const processing = laboratorioOfflineQueueService.procesarPendientes()
    await Promise.resolve()
    state.clinic = clinicB
    state.queues[clinicB] = []
    resolveRequest({ id: command.input.ordenId })

    const result = await processing

    expect(result.razon).toBe('cambio_clinica')
    expect(state.queues[clinicA]).toHaveLength(1)
    expect(state.queues[clinicB]).toHaveLength(0)
  })
})
