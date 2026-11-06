import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clinica: 'clinica-a',
  obtenerPaquetes: vi.fn(),
  guardarPaquetes: vi.fn(),
  guardar: vi.fn(),
}))

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: true }))
vi.mock('../../../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: () => mocks.clinica,
}))
vi.mock('../services/prestacionesStorageService', () => ({
  prestacionesStorageService: {
    obtenerPaquetes: mocks.obtenerPaquetes,
    guardarPaquetes: mocks.guardarPaquetes,
  },
}))
vi.mock('../services/prestacionesSupabaseService', () => ({
  prestacionesSupabaseService: { guardar: mocks.guardar },
}))
vi.mock('./useEliminarPrestaciones', () => ({
  useEliminarPrestaciones: () => ({ eliminarPrestacion: vi.fn(), eliminarPaquete: vi.fn() }),
}))

import { usePrestaciones } from './usePrestaciones'

const pack = {
  id: '33333333-3333-4333-8333-333333333333',
  nombre: 'Pack evaluación',
  especialidad: 'Pack Promocional',
  precioParticular: 50000,
  precioFonasa: 50000,
  codigoFonasa: '',
  precio: 50000,
  precioCombo: 50000,
  descripcion: 'Evaluación y limpieza',
  ahorroEstimado: '15%',
}
const arancel = [pack]
const packRemotoSinMetadata = { ...pack, descripcion: undefined, ahorroEstimado: undefined }

describe('usePrestaciones con arancel compartido', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.clinica = 'clinica-a'
    mocks.obtenerPaquetes.mockReturnValue([])
  })

  it('muestra packs desde el arancel remoto y conserva sus metadatos al editar el precio', async () => {
    const guardarArancel = vi.fn()
    mocks.guardar.mockImplementation(async (prestacion) => prestacion)
    const { result } = renderHook(() => usePrestaciones(arancel, guardarArancel))

    await waitFor(() => expect(result.current.paquetes).toEqual([pack]))
    expect(mocks.obtenerPaquetes).toHaveBeenCalledWith([])

    await act(async () => {
      await result.current.agregarOActualizarPrestacion({
        id: pack.id,
        nombre: pack.nombre,
        especialidad: pack.especialidad,
        precioParticular: 60000,
        precioFonasa: 60000,
        codigoFonasa: '',
      })
    })

    expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({
      descripcion: pack.descripcion,
      ahorroEstimado: pack.ahorroEstimado,
      precioCombo: 60000,
    }))
    await waitFor(() => expect(result.current.paquetes[0]).toEqual(expect.objectContaining({
      precioParticular: 60000,
      precioCombo: 60000,
      descripcion: pack.descripcion,
      ahorroEstimado: pack.ahorroEstimado,
    })))
    expect(guardarArancel).toHaveBeenCalledOnce()
    expect(mocks.guardarPaquetes).not.toHaveBeenCalled()
  })

  it('mantiene visibles los metadatos antiguos del mismo pack como pendientes de compartir', async () => {
    mocks.obtenerPaquetes.mockReturnValue([{
      ...pack, descripcion: 'Descripción antigua', ahorroEstimado: '10%',
    }])
    const arancelSinMetadata = [packRemotoSinMetadata]
    const setArancel = vi.fn()
    const { result } = renderHook(() => usePrestaciones(arancelSinMetadata, setArancel))

    await waitFor(() => expect(result.current.paquetes[0]).toEqual(expect.objectContaining({
      descripcion: 'Descripción antigua',
      ahorroEstimado: '10%',
      pendienteCompartir: true,
    })))
  })

  it('conserva packs locales sin fila remota hasta que se comparten', async () => {
    const local = {
      id: 101, nombre: 'Pack local anterior', descripcion: 'Evaluación',
      precioCombo: 35000, ahorroEstimado: '10%',
    }
    mocks.obtenerPaquetes.mockReturnValue([local])
    mocks.guardar.mockImplementation(async (prestacion) => ({
      ...prestacion,
      id: '44444444-4444-4444-8444-444444444444',
      precio: 35000,
      precioCombo: 35000,
    }))
    const { result } = renderHook(() => usePrestaciones(arancel, vi.fn()))

    await waitFor(() => expect(result.current.paquetes).toEqual(expect.arrayContaining([
      expect.objectContaining({ ...local, pendienteCompartir: true }),
    ])))
    await act(async () => { await result.current.agregarPaquete(local) })

    await waitFor(() => expect(result.current.paquetes.some(p =>
      p.id === '44444444-4444-4444-8444-444444444444' && !p.pendienteCompartir
    )).toBe(true))
    expect(result.current.paquetes.filter(p => p.nombre === local.nombre)).toHaveLength(1)
    expect(mocks.guardarPaquetes).not.toHaveBeenCalled()
  })

  it('oculta inmediatamente los packs locales de una clínica al cambiar de tenant', async () => {
    const localA = { id: 101, nombre: 'Pack privado A', precioCombo: 25000 }
    mocks.obtenerPaquetes.mockImplementation(() => mocks.clinica === 'clinica-a' ? [localA] : [])
    const { result, rerender } = renderHook(({ rows }) => usePrestaciones(rows, vi.fn()), {
      initialProps: { rows: [] },
    })

    await waitFor(() => expect(result.current.paquetes).toEqual([
      expect.objectContaining({ ...localA, pendienteCompartir: true }),
    ]))
    mocks.clinica = 'clinica-b'
    rerender({ rows: [] })

    await waitFor(() => expect(result.current.paquetes).toEqual([]))
  })
})
