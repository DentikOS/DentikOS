import { beforeEach, describe, expect, it, vi } from 'vitest'

const clinicaId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'
const prestacionId = '33333333-3333-4333-8333-333333333333'
const estado = vi.hoisted(() => ({
  clinica: '11111111-1111-4111-8111-111111111111' as string | null,
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: () => estado.clinica }))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: { from: estado.from, rpc: estado.rpc, auth: { getUser: estado.getUser } },
}))

import { prestacionesSupabaseService } from './prestacionesSupabaseService'

const fila = {
  id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
  precio_particular: 15000, precio_fonasa: 0, codigo_fonasa: null,
}

describe('prestacionesSupabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    estado.clinica = clinicaId
    estado.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  })

  it('consulta solo el arancel de la clínica activa y transforma el precio', async () => {
    const order = vi.fn().mockResolvedValue({ data: [fila], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    estado.from.mockReturnValue({ select })
    const lista = await prestacionesSupabaseService.listar()
    expect(estado.from).toHaveBeenCalledWith('prestaciones')
    expect(eq).toHaveBeenCalledWith('clinica_id', clinicaId)
    expect(lista).toEqual([{ id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico', precioParticular: 15000, precioFonasa: 0, codigoFonasa: '', precio: 15000 }])
  })

  it('falla cerrado sin clínica activa y no consulta la tabla', async () => {
    estado.clinica = null
    await expect(prestacionesSupabaseService.listar()).rejects.toThrow('clínica activa')
    expect(estado.from).not.toHaveBeenCalled()
  })

  it('inserta con usuario y clínica autenticados; no acepta un id local como autorización', async () => {
    const single = vi.fn().mockResolvedValue({ data: fila, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    estado.from.mockReturnValue({ insert })
    const guardada = await prestacionesSupabaseService.guardar({
      id: 123, nombre: 'Control', especialidad: 'Diagnóstico', precioParticular: 15000,
      precioFonasa: 0, codigoFonasa: '',
    })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ clinica_id: clinicaId, user_id: userId, precio_particular: 15000 }))
    expect(guardada.id).toBe(prestacionId)
  })

  it('rechaza precio inválido antes de escribir', async () => {
    await expect(prestacionesSupabaseService.guardar({
      id: 123, nombre: 'Control', especialidad: 'Diagnóstico', precioParticular: -1,
      precioFonasa: 0, codigoFonasa: '',
    })).rejects.toThrow('precios')
    expect(estado.from).not.toHaveBeenCalled()
  })

  it('no informa éxito si RLS no devuelve fila al actualizar', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn().mockReturnValue({ maybeSingle })
    const eqClinica = vi.fn().mockReturnValue({ select })
    const eqId = vi.fn().mockReturnValue({ eq: eqClinica })
    estado.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqId }) })
    await expect(prestacionesSupabaseService.guardar({
      id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
      precioParticular: 15000, precioFonasa: 0, codigoFonasa: '',
    })).rejects.toThrow('permisos')
    expect(eqClinica).toHaveBeenCalledWith('clinica_id', clinicaId)
  })

  it('aplica el reajuste mediante RPC con todo el snapshot visible y mapea el arancel confirmado', async () => {
    estado.rpc.mockResolvedValue({ data: [{
      ...fila, precio_particular: 16500, precio_fonasa: 0, precio: 16500,
    }], error: null })
    const reajustadas = await prestacionesSupabaseService.reajustarMasivo(10, [{
      id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
      precioParticular: 15000, precioFonasa: 0, codigoFonasa: '',
    }])

    expect(estado.rpc).toHaveBeenCalledWith('reajustar_arancel_clinica', {
      p_porcentaje: 10,
      p_prestaciones_esperadas: [{ id: prestacionId, precio_particular: 15000, precio_fonasa: 0 }],
    })
    expect(reajustadas).toEqual([{
      id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
      precioParticular: 16500, precioFonasa: 0, codigoFonasa: '', precio: 16500,
    }])
  })

  it('rechaza snapshot local antes de invocar el reajuste compartido', async () => {
    await expect(prestacionesSupabaseService.reajustarMasivo(5, [{
      id: 123, nombre: 'Control local', especialidad: 'Diagnóstico',
      precioParticular: 15000, precioFonasa: 0, codigoFonasa: '',
    }])).rejects.toThrow('pendientes de sincronización')
    expect(estado.rpc).not.toHaveBeenCalled()
  })

  it('explica el rechazo por arancel desactualizado sin exponer el error SQL', async () => {
    estado.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'detalle interno' } })
    await expect(prestacionesSupabaseService.reajustarMasivo(5, [{
      id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
      precioParticular: 15000, precioFonasa: 0, codigoFonasa: '',
    }])).rejects.toThrow('El arancel cambió desde que se cargó')
  })
})
