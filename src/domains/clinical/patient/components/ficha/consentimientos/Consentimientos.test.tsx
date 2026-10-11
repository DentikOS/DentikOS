import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Consentimientos } from './Consentimientos'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import type { Paciente } from '../../../schemas/pacienteSchema'

vi.mock('../../../services/fichasClinicasStorageService', () => ({
  fichasClinicasStorageService: {
    obtenerFichaClinica: vi.fn().mockResolvedValue({ consentimientos: [] }),
    guardarSeccionFicha: vi.fn().mockResolvedValue({ success: true }),
  },
}))

const PACIENTE_ADULTO: Paciente = {
  id: 'pac-adulto',
  nombre: 'Carlos Silva',
  rut: '11.222.333-4',
  edad: 35,
  estado: 'activo',
}

const PACIENTE_MENOR: Paciente = {
  id: 'pac-menor',
  nombre: 'Niño Silva',
  rut: '22.333.444-5',
  edad: 10,
  estado: 'activo',
}

describe('Consentimientos Informados (BP06 §14)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      id: 'f-1',
      paciente_id: 'pac-1',
      clinica_id: 'clinica-1',
      consentimientos: [],
    } as any)
    vi.mocked(fichasClinicasStorageService.guardarSeccionFicha).mockResolvedValue({
      success: true,
    } as any)
  })

  it('renderiza las 5 plantillas CORE', () => {
    render(<Consentimientos paciente={PACIENTE_ADULTO} />)
    expect(screen.getByText('Consentimiento General de Tratamiento')).toBeInTheDocument()
    expect(screen.getByText('Consentimiento de Anestesia Local')).toBeInTheDocument()
    expect(screen.getByText('Consentimiento de Exodoncia Simple')).toBeInTheDocument()
    expect(screen.getByText('Consentimiento de Radiografías')).toBeInTheDocument()
    expect(screen.getByText('Consentimiento de Tratamiento en Menor')).toBeInTheDocument()
  })

  it('permite firmar en modo tipográfico y persiste en Supabase', async () => {
    render(<Consentimientos paciente={PACIENTE_ADULTO} />)

    const btnFirmar = screen.getByRole('button', { name: /Firmar Consentimiento/i })
    fireEvent.click(btnFirmar)

    await waitFor(() => {
      expect(screen.getByTestId('consentimientos-firmados-lista')).toBeInTheDocument()
      expect(fichasClinicasStorageService.guardarSeccionFicha).toHaveBeenCalledWith(
        'pac-adulto',
        'consentimientos',
        expect.any(Array)
      )
    })
  })

  it('exige tutor legal para pacientes menores de 18 años', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<Consentimientos paciente={PACIENTE_MENOR} />)

    expect(screen.getByTestId('input-tutor-legal')).toBeInTheDocument()
    const form = screen.getByRole('button', { name: /Firmar Consentimiento/i }).closest('form')!
    fireEvent.submit(form)

    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining('Tutor legal obligatorio')
    )
    alertMock.mockRestore()
  })
})
