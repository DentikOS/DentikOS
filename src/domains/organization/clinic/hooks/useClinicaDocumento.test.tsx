import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { clinicStorageService } from '../services/clinicStorageService'
import { useClinicaDocumento } from './useClinicaDocumento'

vi.mock('../services/clinicStorageService', () => ({
  clinicStorageService: {
    obtenerClinica: vi.fn(),
    sincronizarClinicaDesdeSupabase: vi.fn(),
  },
}))

describe('useClinicaDocumento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSesionStore.setState({ clinicaActual: 'clinica-a', userProfile: null })
    vi.mocked(clinicStorageService.obtenerClinica).mockImplementation(() => ({
      nombreClinica: `Caché ${useSesionStore.getState().clinicaActual}`,
    }))
  })

  it('sincroniza la clínica activa y descarta respuestas/eventos de otro tenant', async () => {
    let resolverClinicaA: ((datos: { nombreClinica: string }) => void) | undefined
    vi.mocked(clinicStorageService.sincronizarClinicaDesdeSupabase).mockImplementation((clinicaId) => {
      if (clinicaId === 'clinica-a') {
        return new Promise((resolve) => { resolverClinicaA = resolve })
      }
      return Promise.resolve({ nombreClinica: 'Clínica B desde nube' })
    })

    const { result } = renderHook(() => useClinicaDocumento())
    expect(result.current.nombreClinica).toBe('Caché clinica-a')

    act(() => useSesionStore.setState({ clinicaActual: 'clinica-b' }))
    await waitFor(() => expect(result.current.nombreClinica).toBe('Clínica B desde nube'))

    await act(async () => {
      resolverClinicaA?.({ nombreClinica: 'Clínica A atrasada' })
    })
    expect(result.current.nombreClinica).toBe('Clínica B desde nube')

    act(() => window.dispatchEvent(new CustomEvent('clinica_actualizada', {
      detail: { clinicaId: 'clinica-a', datos: { nombreClinica: 'Clínica A por evento' } },
    })))
    expect(result.current.nombreClinica).toBe('Clínica B desde nube')

    act(() => window.dispatchEvent(new CustomEvent('clinica_actualizada', {
      detail: { clinicaId: 'clinica-b', datos: { nombreClinica: 'Clínica B actualizada' } },
    })))
    expect(result.current.nombreClinica).toBe('Clínica B actualizada')
  })
})
