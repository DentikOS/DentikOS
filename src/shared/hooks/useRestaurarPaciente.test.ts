import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRestaurarPaciente } from './useRestaurarPaciente'

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

describe('useRestaurarPaciente', () => {
  const dummyUser = { id: 'usr-123', email: 'doc@example.com' }
  const validUuid = '123e4567-e89b-12d3-a456-426614174000'

  const createMockRepo = (initialValue: string | null = null) => {
    let val = initialValue
    return {
      baseKey: 'clinica_paciente_seleccionado_id',
      obtener: vi.fn(() => val),
      guardar: vi.fn((v: string | null) => {
        val = v
        return true
      }),
      eliminar: vi.fn(() => {
        val = null
        return true
      }),
      existe: vi.fn(() => val !== null),
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    mockMaybeSingle.mockReset()
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('no restaura nada si userProfile es null', () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const mockRepo = createMockRepo(validUuid)

    renderHook(() => useRestaurarPaciente(null, null, setPaciente, setSection, mockRepo))

    expect(mockFrom).not.toHaveBeenCalled()
    expect(setPaciente).not.toHaveBeenCalled()
  })

  it('no restaura nada si pacienteSeleccionado ya existe', () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const pacienteExistente = { id: validUuid, rut: '1-9', nombre: 'Juan' }
    const mockRepo = createMockRepo(validUuid)

    renderHook(() => useRestaurarPaciente(dummyUser, pacienteExistente, setPaciente, setSection, mockRepo))

    expect(mockFrom).not.toHaveBeenCalled()
    expect(setPaciente).not.toHaveBeenCalled()
  })

  it('no restaura nada si repo no contiene ID guardado', () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const mockRepo = createMockRepo(null)

    renderHook(() => useRestaurarPaciente(dummyUser, null, setPaciente, setSection, mockRepo))

    expect(mockFrom).not.toHaveBeenCalled()
    expect(setPaciente).not.toHaveBeenCalled()
  })

  it('limpia repo si el valor guardado no es un UUID válido', async () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const mockRepo = createMockRepo('invalid-uuid-123')

    renderHook(() => useRestaurarPaciente(dummyUser, null, setPaciente, setSection, mockRepo))

    await waitFor(() => {
      expect(mockRepo.eliminar).toHaveBeenCalled()
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('aborta la restauración si el repo fue limpiado durante la espera de 100ms', async () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const mockRepo = createMockRepo(validUuid)

    renderHook(() => useRestaurarPaciente(dummyUser, null, setPaciente, setSection, mockRepo))

    // Simula que otro flujo limpió el repo durante los 100ms
    mockRepo.eliminar()

    await new Promise((r) => setTimeout(r, 150))

    expect(mockFrom).not.toHaveBeenCalled()
    expect(setPaciente).not.toHaveBeenCalled()
  })

  it('restaura el paciente exitosamente si el ID persiste tras los 100ms', async () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const mockRepo = createMockRepo(validUuid)

    const mockRow = {
      id: validUuid,
      rut: '12.345.678-9',
      nombre: 'Carlos Dent',
      edad: 35,
      telefono: '+56911223344',
      email: 'carlos@example.com',
      ocupacion: 'Ingeniero',
      prevision: 'Fonasa',
      alergias: 'Penicilina',
      fecha_nacimiento: '1990-01-01',
      direccion: 'Av Siempre Viva 742',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    }

    mockMaybeSingle.mockResolvedValue({ data: mockRow, error: null })

    renderHook(() => useRestaurarPaciente(dummyUser, null, setPaciente, setSection, mockRepo))

    await waitFor(() => {
      expect(setPaciente).toHaveBeenCalledWith({
        id: validUuid,
        rut: '12.345.678-9',
        nombre: 'Carlos Dent',
        edad: 35,
        telefono: '+56911223344',
        email: 'carlos@example.com',
        ocupacion: 'Ingeniero',
        prevision: 'Fonasa',
        alergias: 'Penicilina',
        fechaNacimiento: '1990-01-01',
        direccion: 'Av Siempre Viva 742',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('pacientes')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('id', validUuid)
    expect(setSection).toHaveBeenCalledWith('Pacientes')
  })

  it('limpia repo si el paciente ya no existe en Supabase (null data)', async () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const mockRepo = createMockRepo(validUuid)

    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    renderHook(() => useRestaurarPaciente(dummyUser, null, setPaciente, setSection, mockRepo))

    await waitFor(() => {
      expect(mockRepo.eliminar).toHaveBeenCalled()
    })

    expect(setPaciente).not.toHaveBeenCalled()
  })

  it('no lanza excepción ni actualiza paciente si Supabase retorna error', async () => {
    const setPaciente = vi.fn()
    const setSection = vi.fn()
    const mockRepo = createMockRepo(validUuid)

    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'Network error' } })

    renderHook(() => useRestaurarPaciente(dummyUser, null, setPaciente, setSection, mockRepo))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('pacientes')
    })

    expect(setPaciente).not.toHaveBeenCalled()
  })
})
