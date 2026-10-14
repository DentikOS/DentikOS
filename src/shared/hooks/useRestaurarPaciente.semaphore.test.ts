import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRestaurarPaciente } from './useRestaurarPaciente'

// Mock Supabase
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

describe('useRestaurarPaciente - Semáforo de navegación intencional', () => {
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
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('NO restaura si el semáforo está activo (navegación reciente)', () => {
    // Simular que el usuario acaba de navegar al listado
    const skipUntil = Date.now() + 5000
    sessionStorage.setItem('dentikos_skip_restore_until', String(skipUntil))
    const mockRepo = createMockRepo('12345678-1234-1234-1234-123456789012')

    const setPacienteMock = vi.fn()
    const setActiveSectionMock = vi.fn()

    renderHook(() =>
      useRestaurarPaciente(
        { id: 'user-1' },
        null,
        setPacienteMock,
        setActiveSectionMock,
        mockRepo
      )
    )

    // No debe llamar a setPaciente ni a Supabase porque el semáforo está activo
    expect(setPacienteMock).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('SÍ restaura si el semáforo expiró', async () => {
    // Semáforo expirado (hace 10 segundos)
    const skipUntil = Date.now() - 10000
    sessionStorage.setItem('dentikos_skip_restore_until', String(skipUntil))
    const mockRepo = createMockRepo('12345678-1234-1234-1234-123456789012')

    const setPacienteMock = vi.fn()
    const setActiveSectionMock = vi.fn()

    renderHook(() =>
      useRestaurarPaciente(
        { id: 'user-1' },
        null,
        setPacienteMock,
        setActiveSectionMock,
        mockRepo
      )
    )

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('pacientes')
    })
  })
})
