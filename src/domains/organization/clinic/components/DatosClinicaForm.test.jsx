import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DatosClinicaForm } from './DatosClinicaForm'
import { clinicStorageService } from '../services/clinicStorageService'
import { useSesionStore } from '../../../../app/stores/sesionStore'

vi.mock('../services/clinicStorageService', () => ({
  clinicStorageService: {
    obtenerClinica: vi.fn(),
    sincronizarClinicaDesdeSupabase: vi.fn().mockResolvedValue(null),
    guardarClinica: vi.fn(),
    guardarClinicaCompleta: vi.fn().mockResolvedValue(true),
  },
}))

describe('DatosClinicaForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSesionStore.setState({ clinicaActual: 'clinica-123' })
  })

  it('al montar carga desde caché y sincroniza de Supabase', async () => {
    vi.mocked(clinicStorageService.obtenerClinica).mockReturnValue({
      nombreClinica: 'Clínica Cache',
    })
    vi.mocked(clinicStorageService.sincronizarClinicaDesdeSupabase).mockResolvedValue({
      nombreClinica: 'Clínica Nube Supabase',
    })

    render(<DatosClinicaForm userProfile={{ rol: 'admin', clinicaId: 'clinica-123' }} />)

    expect(clinicStorageService.obtenerClinica).toHaveBeenCalled()
    expect(clinicStorageService.sincronizarClinicaDesdeSupabase).toHaveBeenCalledWith('clinica-123')

    await waitFor(() => {
      expect(screen.getByDisplayValue('Clínica Nube Supabase')).toBeInTheDocument()
    })
  })

  it('guarda llama guardarClinicaCompleta y muestra confirmación de nube', async () => {
    vi.mocked(clinicStorageService.obtenerClinica).mockReturnValue({
      nombreClinica: 'Clínica Central',
    })
    vi.mocked(clinicStorageService.sincronizarClinicaDesdeSupabase).mockResolvedValue(null)
    vi.mocked(clinicStorageService.guardarClinicaCompleta).mockResolvedValue(true)

    const onGuardarMock = vi.fn()

    render(
      <DatosClinicaForm
        userProfile={{ rol: 'admin', clinicaId: 'clinica-123' }}
        alGuardar={onGuardarMock}
      />
    )

    const inputNombre = screen.getByDisplayValue('Clínica Central')
    fireEvent.change(inputNombre, { target: { value: 'Clínica Dental Renombrada' } })

    const botonGuardar = screen.getByRole('button', { name: /Guardar Configuración/i })
    fireEvent.click(botonGuardar)

    await waitFor(() => {
      expect(clinicStorageService.guardarClinicaCompleta).toHaveBeenCalledWith(
        'clinica-123',
        expect.objectContaining({ nombreClinica: 'Clínica Dental Renombrada' })
      )
      expect(screen.getByText(/Guardado en la nube/i)).toBeInTheDocument()
      expect(onGuardarMock).toHaveBeenCalled()
    })
  })

  it('usuarios no admin ven modo solo-lectura y no pueden guardar', () => {
    vi.mocked(clinicStorageService.obtenerClinica).mockReturnValue({
      nombreClinica: 'Clínica Solo Lectura',
    })

    render(<DatosClinicaForm userProfile={{ rol: 'recepcionista' }} />)

    expect(screen.getByText(/Solo lectura/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar Configuración/i })).not.toBeInTheDocument()

    const inputNombre = screen.getByDisplayValue('Clínica Solo Lectura')
    expect(inputNombre).toBeDisabled()
  })
})
