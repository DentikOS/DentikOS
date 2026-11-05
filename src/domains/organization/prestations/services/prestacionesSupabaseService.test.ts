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
  equipamiento_requerido: [],
}
const filaPaquete = {
  ...fila, nombre: 'Pack evaluación', especialidad: 'Pack Promocional',
  precio_particular: 50000, precio_fonasa: 50000, precio: 50000,
  descripcion: 'Evaluación y limpieza', ahorro_estimado: '15%',
}

describe('prestacionesSupabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    estado.clinica = clinicaId
    estado.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  })

  it('consulta solo el arancel de la clínica activa y transforma el precio', async () => {
    const order = vi.fn().mockResolvedValue({ data: [filaPaquete], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    estado.from.mockReturnValue({ select })
    const lista = await prestacionesSupabaseService.listar()
    expect(estado.from).toHaveBeenCalledWith('prestaciones')
    expect(select).toHaveBeenCalledWith('id,nombre,especialidad,precio_particular,precio_fonasa,codigo_fonasa,descripcion,ahorro_estimado,codigo_interno,categoria,equipamiento_requerido')
    expect(eq).toHaveBeenCalledWith('clinica_id', clinicaId)
    expect(lista).toEqual([{
      id: prestacionId, nombre: 'Pack evaluación', especialidad: 'Pack Promocional',
      precioParticular: 50000, precioFonasa: 50000, codigoFonasa: '', precio: 50000,
      precioCombo: 50000,
      descripcion: 'Evaluación y limpieza', ahorroEstimado: '15%',
      equipamientoRequerido: [],
    }])
  })

  it('conserva código y categoría del catálogo y diferencia tarifa Fonasa pendiente de cero', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ ...fila, codigo_interno: 'PRE-01', categoria: 'Preventivo', precio_fonasa: null }], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    estado.from.mockReturnValue({ select })

    const [prestacion] = await prestacionesSupabaseService.listar()

    expect(prestacion).toMatchObject({ codigoInterno: 'PRE-01', categoria: 'Preventivo', precioFonasa: null })
  })

  it('lee instalaciones anteriores sin equipamiento hasta que se aplique la migración', async () => {
    const primeraOrden = vi.fn().mockResolvedValue({ data: null, error: { code: '42703' } })
    const primeraEq = vi.fn().mockReturnValue({ order: primeraOrden })
    const primerSelect = vi.fn().mockReturnValue({ eq: primeraEq })
    const segundaOrden = vi.fn().mockResolvedValue({ data: null, error: { code: '42703' } })
    const segundaEq = vi.fn().mockReturnValue({ order: segundaOrden })
    const segundoSelect = vi.fn().mockReturnValue({ eq: segundaEq })
    const terceraOrden = vi.fn().mockResolvedValue({ data: [fila], error: null })
    const terceraEq = vi.fn().mockReturnValue({ order: terceraOrden })
    const tercerSelect = vi.fn().mockReturnValue({ eq: terceraEq })
    estado.from.mockReturnValueOnce({ select: primerSelect }).mockReturnValueOnce({ select: segundoSelect }).mockReturnValueOnce({ select: tercerSelect })

    const lista = await prestacionesSupabaseService.listar()

    expect(primerSelect).toHaveBeenCalledWith(expect.stringContaining('equipamiento_requerido'))
    expect(segundoSelect).toHaveBeenCalledWith(expect.stringContaining('equipamiento_requerido'))
    expect(tercerSelect).toHaveBeenCalledWith(expect.not.stringContaining('equipamiento_requerido'))
    expect(lista[0].equipamientoRequerido).toEqual([])
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
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      clinica_id: clinicaId, user_id: userId, precio_particular: 15000,
      precio_fonasa: 0, codigo_interno: null, categoria: null, equipamiento_requerido: [],
    }))
    expect(guardada.id).toBe(prestacionId)
  })

  it('guarda y devuelve descripción y ahorro promocional compartidos', async () => {
    const single = vi.fn().mockResolvedValue({ data: filaPaquete, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    estado.from.mockReturnValue({ insert })

    const guardada = await prestacionesSupabaseService.guardar({
      id: 123, nombre: 'Pack evaluación', especialidad: 'Pack Promocional',
      precioParticular: 50000, precioFonasa: 50000, codigoFonasa: '',
      codigoInterno: 'PACK-01', categoria: 'Promociones',
      descripcion: '  Evaluación y limpieza  ', ahorroEstimado: ' 15% ',
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      descripcion: 'Evaluación y limpieza', ahorro_estimado: '15%',
      codigo_interno: 'PACK-01', categoria: 'Promociones',
    }))
    expect(guardada).toEqual(expect.objectContaining({
      descripcion: 'Evaluación y limpieza', ahorroEstimado: '15%',
    }))
  })

  it('sincroniza el equipamiento requerido explícito de la prestación', async () => {
    const single = vi.fn().mockResolvedValue({ data: { ...fila, equipamiento_requerido: ['laser_dental'] }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    estado.from.mockReturnValue({ insert })

    const guardada = await prestacionesSupabaseService.guardar({
      id: 123, nombre: 'Endodoncia', especialidad: 'Endodoncia', precioParticular: 15000,
      precioFonasa: 0, codigoFonasa: '', equipamientoRequerido: ['laser_dental'],
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ equipamiento_requerido: ['laser_dental'] }))
    expect(guardada.equipamientoRequerido).toEqual(['laser_dental'])
  })

  it('rechaza explícitamente la edición de requisitos mientras la migración no esté instalada', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST204' } })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    estado.from.mockReturnValue({ insert })

    await expect(prestacionesSupabaseService.guardar({
      id: 123, nombre: 'Endodoncia', especialidad: 'Endodoncia', precioParticular: 15000,
      precioFonasa: 0, codigoFonasa: '', equipamientoRequerido: ['laser_dental'],
    })).rejects.toThrow('Aplique la migración BP08')
  })

  it('rechaza precio inválido antes de escribir', async () => {
    await expect(prestacionesSupabaseService.guardar({
      id: 123, nombre: 'Control', especialidad: 'Diagnóstico', precioParticular: -1,
      precioFonasa: 0, codigoFonasa: '',
    })).rejects.toThrow('precios')
    expect(estado.from).not.toHaveBeenCalled()
  })

  it('permite guardar Fonasa pendiente sin convertirlo en precio cero', async () => {
    const single = vi.fn().mockResolvedValue({ data: { ...fila, precio_fonasa: null }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    estado.from.mockReturnValue({ insert })

    const guardada = await prestacionesSupabaseService.guardar({
      id: 123, nombre: 'Limpieza dental', especialidad: 'Diagnóstico y Prevención',
      precioParticular: 50000, precioFonasa: null, codigoFonasa: '', codigoInterno: 'PRE-01', categoria: 'Preventivo',
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ precio_fonasa: null, codigo_interno: 'PRE-01', categoria: 'Preventivo' }))
    expect(guardada.precioFonasa).toBeNull()
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
      ...fila, equipamiento_requerido: undefined,
      precio_particular: 16500, precio_fonasa: 0, precio: 16500,
    }], error: null })
    const reajustadas = await prestacionesSupabaseService.reajustarMasivo(10, [{
      id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
      precioParticular: 15000, precioFonasa: 0, codigoFonasa: '',
      descripcion: 'Detalle guardado', ahorroEstimado: '15%',
      equipamientoRequerido: ['laser_dental'],
    }])

    expect(estado.rpc).toHaveBeenCalledWith('reajustar_arancel_clinica', {
      p_porcentaje: 10,
      p_prestaciones_esperadas: [{ id: prestacionId, precio_particular: 15000, precio_fonasa: 0 }],
    })
    expect(reajustadas).toEqual([{
      id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
      precioParticular: 16500, precioFonasa: 0, codigoFonasa: '', precio: 16500,
      descripcion: 'Detalle guardado', ahorroEstimado: '15%',
      equipamientoRequerido: ['laser_dental'],
    }])
  })

  it('rechaza snapshot local antes de invocar el reajuste compartido', async () => {
    await expect(prestacionesSupabaseService.reajustarMasivo(5, [{
      id: 123, nombre: 'Control local', especialidad: 'Diagnóstico',
      precioParticular: 15000, precioFonasa: 0, codigoFonasa: '',
    }])).rejects.toThrow('pendientes de sincronización')
    expect(estado.rpc).not.toHaveBeenCalled()
  })

  it('manda Fonasa null en el snapshot del reajuste', async () => {
    estado.rpc.mockResolvedValue({ data: [{ ...fila, precio_fonasa: null }], error: null })
    await prestacionesSupabaseService.reajustarMasivo(10, [{
      id: prestacionId, nombre: 'Limpieza', especialidad: 'Diagnóstico y Prevención',
      precioParticular: 50000, precioFonasa: null, codigoFonasa: '', codigoInterno: 'PRE-01', categoria: 'Preventivo',
    }])

    expect(estado.rpc).toHaveBeenCalledWith('reajustar_arancel_clinica', {
      p_porcentaje: 10,
      p_prestaciones_esperadas: [{ id: prestacionId, precio_particular: 50000, precio_fonasa: null }],
    })
  })

  it('importa la plantilla mediante RPC y actualiza los ids desde la base', async () => {
    estado.rpc.mockResolvedValue({ data: [{ ...fila, codigo_interno: 'PRE-01', categoria: 'Preventivo', precio_fonasa: null }], error: null })
    const importadas = await prestacionesSupabaseService.importarPlantilla('general', [{
      codigoInterno: 'PRE-01', categoria: 'Preventivo', nombre: 'Limpieza dental',
      especialidad: 'Diagnóstico y Prevención', precioParticular: 50000, precioFonasa: null,
    }])

    expect(estado.rpc).toHaveBeenCalledWith('importar_plantilla_prestaciones', {
      p_plantilla: 'general',
      p_prestaciones: [{ codigo_interno: 'PRE-01', categoria: 'Preventivo', nombre: 'Limpieza dental', especialidad: 'Diagnóstico y Prevención', precio_particular: 50000, precio_fonasa: null }],
    })
    expect(importadas[0]).toMatchObject({ id: prestacionId, codigoInterno: 'PRE-01', precioFonasa: null })
  })

  it('bloquea una importación que no coincide con la cantidad de filas que confirmó la RPC', async () => {
    estado.rpc.mockResolvedValue({ data: [], error: null })
    await expect(prestacionesSupabaseService.importarPlantilla('general', [{
      codigoInterno: 'PRE-01', categoria: 'Preventivo', nombre: 'Limpieza dental',
      especialidad: 'Diagnóstico y Prevención', precioParticular: 50000, precioFonasa: null,
    }])).rejects.toThrow('La nube no confirmó el resultado completo')
  })

  it('explica el rechazo por arancel desactualizado sin exponer el error SQL', async () => {
    estado.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'detalle interno' } })
    await expect(prestacionesSupabaseService.reajustarMasivo(5, [{
      id: prestacionId, nombre: 'Control', especialidad: 'Diagnóstico',
      precioParticular: 15000, precioFonasa: 0, codigoFonasa: '',
    }])).rejects.toThrow('El arancel cambió desde que se cargó')
  })
})
