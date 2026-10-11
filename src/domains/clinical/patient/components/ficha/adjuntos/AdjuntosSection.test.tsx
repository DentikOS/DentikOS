import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdjuntosSection } from './AdjuntosSection'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import type { Paciente } from '../../../schemas/pacienteSchema'

vi.mock('../../../services/fichasClinicasStorageService', () => ({
  fichasClinicasStorageService: {
    obtenerFichaClinica: vi.fn(),
    guardarSeccionFicha: vi.fn(),
  },
}))

const PACIENTE_MOCK: Paciente = {
  id: 'pac-123',
  nombre: 'Laura Morales',
  rut: '15.678.901-2',
  estado: 'activo',
}

describe('AdjuntosSection (BP06 §07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      id: 'f-1',
      paciente_id: 'pac-123',
      clinica_id: 'clinica-1',
      adjuntos: [
        {
          id: 'adj-1',
          titulo: 'Panorámica Inicial',
          tipo: 'panoramica',
          fecha: '2026-03-01T10:00:00.000Z',
          dataUrl: 'data:image/jpeg;base64,mock',
        },
      ],
    } as any)
    vi.mocked(fichasClinicasStorageService.guardarSeccionFicha).mockResolvedValue({
      success: true,
    } as any)
  })

  it('renderiza la galería con los adjuntos cargados desde Supabase', async () => {
    render(<AdjuntosSection paciente={PACIENTE_MOCK} />)

    await waitFor(() => {
      expect(screen.getByText('Panorámica Inicial')).toBeInTheDocument()
      expect(screen.getAllByText('RX Panorámica').length).toBeGreaterThan(0)
    })
  })

  it('permite filtrar por categoría de adjunto', async () => {
    render(<AdjuntosSection paciente={PACIENTE_MOCK} />)

    await waitFor(() => {
      expect(screen.getByText('Panorámica Inicial')).toBeInTheDocument()
    })

    // Click en filtro 'intraoral'
    const btnIntraoral = screen.getByRole('button', { name: /^intraoral$/i })
    fireEvent.click(btnIntraoral)

    // No debe aparecer la panorámica en este filtro
    expect(screen.queryByText('Panorámica Inicial')).not.toBeInTheDocument()
    expect(screen.getByText(/No hay imágenes ni radiografías/i)).toBeInTheDocument()

    // Volver a 'todos'
    const btnTodos = screen.getByRole('button', { name: /^todos$/i })
    fireEvent.click(btnTodos)
    expect(screen.getByText('Panorámica Inicial')).toBeInTheDocument()
  })
})
