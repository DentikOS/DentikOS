import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { DatosClinicaForm } from './DatosClinicaForm'
import { clinicStorageService } from '../services/clinicStorageService'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

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

  it('guarda llama guardarClinicaCompleta y muestra el estado de sincronización real', async () => {
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
      const estadoEsperado = USE_SUPABASE && supabase
        ? 'Guardado en la nube'
        : 'Guardado en este dispositivo; no se sincronizó con la nube.'
      expect(screen.getByText(estadoEsperado)).toBeInTheDocument()
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

  it('sincroniza todos los datos de la clínica activa y descarta eventos de otro tenant', async () => {
    vi.mocked(clinicStorageService.obtenerClinica).mockReturnValue({
      nombreClinica: 'Clínica A',
      ciudad: 'Ciudad inicial',
      eslogan: 'Frase inicial',
    })
    vi.mocked(clinicStorageService.sincronizarClinicaDesdeSupabase).mockResolvedValue(null)

    render(<DatosClinicaForm userProfile={{ rol: 'admin', clinicaId: 'clinica-123' }} />)

    act(() => {
      window.dispatchEvent(new CustomEvent('clinica_actualizada', {
        detail: {
          clinicaId: 'clinica-456',
          datos: { nombreClinica: 'Clínica ajena', ciudad: 'No debe aparecer' },
        },
      }))
    })
    expect(screen.getByDisplayValue('Clínica A')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ciudad inicial')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new CustomEvent('clinica_actualizada', {
        detail: {
          clinicaId: 'clinica-123',
          datos: { nombreClinica: 'Clínica A actualizada', ciudad: 'Valparaíso', eslogan: 'Nueva frase' },
        },
      }))
    })

    expect(screen.getByDisplayValue('Clínica A actualizada')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Valparaíso')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nueva frase')).toBeInTheDocument()
  })
})
