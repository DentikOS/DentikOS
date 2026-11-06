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

import { laboratorioCloudService } from './laboratorioCloudService'

const clinica = '11111111-1111-4111-8111-111111111111'

describe('laboratorioCloudService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.clinicaLocal = clinica
    state.getSession.mockResolvedValue({
      data: { session: { user: { id: '22222222-2222-4222-8222-222222222222' } } },
      error: null
    })
    state.rpc.mockResolvedValue({ data: clinica, error: null })
  })

  it('falla cerrado si no hay sesión', async () => {
    state.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await expect(laboratorioCloudService.cargar()).rejects.toThrow('sesión autenticada')
    expect(state.from).not.toHaveBeenCalled()
  })

  it('no consulta datos si el tenant del servidor difiere del seleccionado', async () => {
    state.rpc.mockResolvedValue({ data: '33333333-3333-4333-8333-333333333333', error: null })
    await expect(laboratorioCloudService.cargar()).rejects.toThrow('no coincide')
    expect(state.from).not.toHaveBeenCalled()
  })

  it('lee solo el snapshot visible a RLS del tenant activo', async () => {
    const builder = () => {
      const query: Record<string, unknown> = {}
      query.select = vi.fn(() => query)
      query.eq = vi.fn(() => query)
      query.order = vi.fn(async () => ({ data: [], error: null }))
      return query
    }
    state.from.mockImplementation(() => builder())

    const snapshot = await laboratorioCloudService.cargar()

    expect(snapshot).toEqual({ ordenes: [], historialEtapas: [], laboratorios: [], tiposTrabajo: [], plantillas: [], pacientes: [], permisos: [] })
    expect(state.from).toHaveBeenCalledWith('ordenes_laboratorio')
    expect(state.from).toHaveBeenCalledWith('historial_etapas_laboratorio')
    expect(state.from).toHaveBeenCalledWith('laboratorios')
    expect(state.from).toHaveBeenCalledWith('laboratorio_tipos_trabajo')
    expect(state.from).toHaveBeenCalledWith('plantillas_laboratorio')
    expect(state.from).toHaveBeenCalledWith('permisos_laboratorio_aditivos')
  })

  it('edita una orden de la clínica solo si sigue en la versión leída', async () => {
    const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const updatedAt = '2026-11-05T10:00:00.000Z'
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    query.update = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.select = vi.fn(() => query)
    query.maybeSingle = vi.fn(async () => ({ data: { id: orderId, clinica_id: clinica }, error: null }))
    state.from.mockReturnValue(query)

    await laboratorioCloudService.editarOrden(orderId, { observaciones: 'Ajustar contacto proximal' }, updatedAt)

    expect(query.update).toHaveBeenCalledWith({ observaciones: 'Ajustar contacto proximal' })
    expect(query.eq).toHaveBeenCalledWith('id', orderId)
    expect(query.eq).toHaveBeenCalledWith('clinica_id', clinica)
    expect(query.eq).toHaveBeenCalledWith('updated_at', updatedAt)
  })

  it('rechaza una edición cuando otra operación ya cambió la orden', async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    query.update = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.select = vi.fn(() => query)
    query.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    state.from.mockReturnValue(query)

    await expect(laboratorioCloudService.editarOrden(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { observaciones: 'Texto desactualizado' }, '2026-11-05T10:00:00.000Z'
    )).rejects.toMatchObject({ code: 'STALE_OR_REJECTED' })
  })
})
