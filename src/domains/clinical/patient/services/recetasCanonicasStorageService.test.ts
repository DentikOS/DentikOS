import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'
import { recetasCanonicasStorageService, type NuevaRecetaCanonica } from './recetasCanonicasStorageService'

const mocks = vi.hoisted(() => ({
  enabled: true,
  responses: [] as Array<{ data?: unknown; error?: { code?: string; message?: string } | null }>,
  from: vi.fn(),
  getUser: vi.fn(),
  clinic: 'aaaaaaaa-0000-4000-8000-000000000001' as string | null,
  userId: 'cccccccc-0000-4000-8000-000000000003',
}))

vi.mock('../../../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: vi.fn(() => mocks.clinic),
}))

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  get USE_SUPABASE() { return mocks.enabled },
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}))

const clinicaId = 'aaaaaaaa-0000-4000-8000-000000000001'
const pacienteId = 'bbbbbbbb-0000-4000-8000-000000000002'
const recetaId = 'dddddddd-0000-4000-8000-000000000004'

const receta: NuevaRecetaCanonica = {
  id: recetaId,
  paciente_id: pacienteId,
  fecha: '2026-11-05',
  profesional: 'Dra. Prueba',
  medicamentos: [{ nombre: 'Medicamento', dosis: '1 unidad', frecuencia: 'Cada 12 horas', duracion: '5 días' }],
  diagnostico: null,
  indicaciones: null,
  firma: null,
  hash_forense: 'a'.repeat(64),
  qr_token: 'token-de-prueba',
}

const fila = {
  ...receta,
  user_id: mocks.userId,
  clinica_id: clinicaId,
  created_at: '2026-11-05T12:00:00.000Z',
  updated_at: '2026-11-05T12:00:00.000Z',
}

const crearQuery = (response: { data?: unknown; error?: { code?: string; message?: string } | null }) => {
  const query: Record<string, any> = {}
  for (const method of ['select', 'eq', 'order', 'insert']) {
    query[method] = vi.fn(() => query)
  }
  query.single = vi.fn(() => Promise.resolve(response))
  query.maybeSingle = vi.fn(() => Promise.resolve(response))
  query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)
  return query
}

describe('recetasCanonicasStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enabled = true
    mocks.clinic = clinicaId
    mocks.responses = []
    mocks.getUser.mockResolvedValue({ data: { user: { id: mocks.userId } }, error: null })
    mocks.from.mockImplementation(() => crearQuery(mocks.responses.shift() || { data: null, error: null }))
  })

  it('consulta solo por paciente y clínica activa, y valida el tenant de cada fila', async () => {
    mocks.responses.push({ data: [fila], error: null })

    await expect(recetasCanonicasStorageService.listar(pacienteId)).resolves.toEqual([fila])
    expect(supabase!.from).toHaveBeenCalledWith('recetas')
    const query = vi.mocked(supabase!.from).mock.results[0].value
    expect(query.eq).toHaveBeenCalledWith('paciente_id', pacienteId)
    expect(query.eq).toHaveBeenCalledWith('clinica_id', clinicaId)
  })

  it('rechaza una fila que Supabase devuelve con otro tenant', async () => {
    mocks.responses.push({ data: [{ ...fila, clinica_id: 'eeeeeeee-0000-4000-8000-000000000005' }], error: null })
    await expect(recetasCanonicasStorageService.listar(pacienteId)).rejects.toThrow(/clínica activa/i)
  })

  it('inserta con el usuario autenticado y la clínica activa, sin usar cache local', async () => {
    mocks.responses.push({ data: fila, error: null })

    await expect(recetasCanonicasStorageService.guardar(receta)).resolves.toEqual(fila)
    expect(supabase!.from).toHaveBeenCalledWith('recetas')
    const query = vi.mocked(supabase!.from).mock.results[0].value
    expect(query.insert).toHaveBeenCalledWith({ ...receta, user_id: mocks.userId, clinica_id: clinicaId })
  })

  it('rechaza emisión si Supabase no está habilitado o no hay contexto autenticado', async () => {
    mocks.enabled = false
    await expect(recetasCanonicasStorageService.guardar(receta)).rejects.toThrow(/Supabase/i)
    expect(supabase!.from).not.toHaveBeenCalled()

    mocks.enabled = true
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(recetasCanonicasStorageService.guardar(receta)).rejects.toThrow(/sesión/i)
    expect(supabase!.from).not.toHaveBeenCalled()
  })

  it('confirma un reintento idempotente solo si la fila previa coincide exactamente', async () => {
    mocks.responses.push(
      { data: null, error: { code: '23505', message: 'duplicate key' } },
      { data: fila, error: null }
    )

    await expect(recetasCanonicasStorageService.guardar(receta)).resolves.toEqual(fila)
    expect(supabase!.from).toHaveBeenCalledTimes(2)
  })

  it('no trata como éxito un UUID en conflicto con otra receta', async () => {
    mocks.responses.push(
      { data: null, error: { code: '23505', message: 'duplicate key' } },
      { data: { ...fila, medicamentos: [{ nombre: 'Distinto', dosis: '1', frecuencia: '2', duracion: '3' }] }, error: null }
    )

    await expect(recetasCanonicasStorageService.guardar(receta)).rejects.toThrow(/confirmar el guardado/i)
  })

  it('no guarda si la clínica activa no es válida', async () => {
    mocks.clinic = null
    await expect(recetasCanonicasStorageService.guardar(receta)).rejects.toThrow(/clínica activa/i)
    expect(supabase!.from).not.toHaveBeenCalled()
  })

  it('bloquea una receta si falta dosis, frecuencia o duración', async () => {
    const incompleta = {
      ...receta,
      medicamentos: [{ ...receta.medicamentos[0], frecuencia: ' ' }],
    }
    await expect(recetasCanonicasStorageService.guardar(incompleta)).rejects.toThrow(/dosis, frecuencia y duración/i)
    expect(supabase!.from).not.toHaveBeenCalled()
  })
})
