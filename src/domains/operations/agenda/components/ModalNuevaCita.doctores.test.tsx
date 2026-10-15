import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ModalNuevaCita } from './ModalNuevaCita'
import { agendaConfigService } from '../services/agendaConfigService'

vi.mock('../services/agendaConfigService', () => ({
  agendaConfigService: {
    obtenerDoctoresAgenda: vi.fn()
  }
}))

describe('ModalNuevaCita - Selector de Doctor (FIX-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga y muestra doctores desde agendaConfigService', async () => {
    vi.mocked(agendaConfigService.obtenerDoctoresAgenda).mockResolvedValue([
      { userId: 'doc-1', nombreCompleto: 'Dr. Miguel Díaz', especialidad: 'General', rol: 'dentist', colorIdentidad: '#3B82F6', permiteSobrecupos: false, maxSobrecupos: 0 },
      { userId: 'doc-2', nombreCompleto: 'Dra. Carolina Soto', especialidad: 'Ortodoncia', rol: 'dentist', colorIdentidad: '#10B981', permiteSobrecupos: false, maxSobrecupos: 0 }
    ])

    render(<ModalNuevaCita alGuardar={vi.fn()} alCerrar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Profesional asignado/i)).toBeInTheDocument()
    })

    const select = screen.getByLabelText(/Profesional asignado/i)
    expect(select).toBeInTheDocument()
    
    // Verificar que aparecen las opciones
    const opciones = screen.getAllByRole('option')
    expect(opciones.length).toBeGreaterThanOrEqual(2) // "Sin asignar" + doctores
  })

  it('muestra aviso si no hay doctores configurados', async () => {
    vi.mocked(agendaConfigService.obtenerDoctoresAgenda).mockResolvedValue([])

    render(<ModalNuevaCita alGuardar={vi.fn()} alCerrar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/No hay profesionales configurados/i)).toBeInTheDocument()
    })
  })

  it('preselecciona doctor si solo hay uno disponible', async () => {
    vi.mocked(agendaConfigService.obtenerDoctoresAgenda).mockResolvedValue([
      { userId: 'doc-1', nombreCompleto: 'Dr. Único', especialidad: 'General', rol: 'dentist', colorIdentidad: '#3B82F6', permiteSobrecupos: false, maxSobrecupos: 0 }
    ])

    render(<ModalNuevaCita alGuardar={vi.fn()} alCerrar={vi.fn()} />)

    await waitFor(() => {
      const select = screen.getByLabelText(/Profesional asignado/i) as HTMLSelectElement
      expect(select.value).toBe('doc-1')
    })
  })
})
