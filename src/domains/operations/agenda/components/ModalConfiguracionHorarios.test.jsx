import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ModalConfiguracionHorarios } from './ModalConfiguracionHorarios'
import { agendaConfigService } from '../services/agendaConfigService'

vi.mock('../services/agendaConfigService', () => ({
  agendaConfigService: {
    obtenerDoctoresAgenda: vi.fn(),
    actualizarConfigAgenda: vi.fn(),
    actualizarHorariosUsuario: vi.fn(),
  },
}))

vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: {
    getState: vi.fn(() => ({
      userProfile: {
        clinicaId: 'clinica-test-uuid',
      },
    })),
  },
}))

const mockDoctores = [
  {
    userId: 'doc-1',
    nombreCompleto: 'Dr. Roberto Dentista',
    especialidad: 'Ortodoncia',
    colorIdentidad: '#B88E3A',
    permiteSobrecupos: true,
    maxSobrecupos: 2,
    horarios: [
      { diaSemana: 1, horaInicio: '09:00', horaFin: '18:00', duracionBloqueMinutos: 30 },
      { diaSemana: 2, horaInicio: '09:00', horaFin: '18:00', duracionBloqueMinutos: 30 },
      { diaSemana: 3, horaInicio: '09:00', horaFin: '18:00', duracionBloqueMinutos: 30 },
      { diaSemana: 4, horaInicio: '09:00', horaFin: '18:00', duracionBloqueMinutos: 30 },
      { diaSemana: 5, horaInicio: '09:00', horaFin: '18:00', duracionBloqueMinutos: 30 },
    ],
  },
]

describe('ModalConfiguracionHorarios (UX & 7 Días)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(agendaConfigService.obtenerDoctoresAgenda).mockResolvedValue(mockDoctores)
    vi.mocked(agendaConfigService.actualizarConfigAgenda).mockResolvedValue()
    vi.mocked(agendaConfigService.actualizarHorariosUsuario).mockResolvedValue()
  })

  it('NO muestra texto técnico visible del blueprint y muestra etiqueta limpia', async () => {
    render(
      <ModalConfiguracionHorarios
        isOpen={true}
        alCerrar={vi.fn()}
        alGuardar={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Roberto Dentista')[0]).toBeInTheDocument()
    })

    // NO debe mostrar texto técnico
    expect(screen.queryByText(/Opción B/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/BP05/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/§03/i)).not.toBeInTheDocument()

    // Debe mostrar texto claro orientado al usuario
    expect(screen.getByText('Permitir sobrecupos')).toBeInTheDocument()
    expect(screen.getByText(/alerta visual/i)).toBeInTheDocument()
  })

  it('renderiza los 7 días de la semana incluyendo Sábado y Domingo', async () => {
    render(
      <ModalConfiguracionHorarios
        isOpen={true}
        alCerrar={vi.fn()}
        alGuardar={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Lunes')).toBeInTheDocument()
      expect(screen.getByText('Martes')).toBeInTheDocument()
      expect(screen.getByText('Miércoles')).toBeInTheDocument()
      expect(screen.getByText('Jueves')).toBeInTheDocument()
      expect(screen.getByText('Viernes')).toBeInTheDocument()
      expect(screen.getByText('Sábado')).toBeInTheDocument()
      expect(screen.getByText('Domingo')).toBeInTheDocument()
    })
  })

  it('permite activar el día Sábado y configurar su horario', async () => {
    render(
      <ModalConfiguracionHorarios
        isOpen={true}
        alCerrar={vi.fn()}
        alGuardar={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Sábado')).toBeInTheDocument()
    })

    // Inicialmente Sábado no atiende
    const sabadoLabel = screen.getByText('Sábado').closest('label')
    const sabadoCheckbox = sabadoLabel?.querySelector('input[type="checkbox"]')
    expect(sabadoCheckbox).not.toBeChecked()

    // Activar Sábado
    if (sabadoCheckbox) {
      fireEvent.click(sabadoCheckbox)
      expect(sabadoCheckbox).toBeChecked()
    }

    // Guardar cambios
    const btnGuardar = screen.getByRole('button', { name: /Guardar Cambios/i })
    fireEvent.click(btnGuardar)

    await waitFor(() => {
      expect(agendaConfigService.actualizarHorariosUsuario).toHaveBeenCalledWith(
        'doc-1',
        'clinica-test-uuid',
        expect.arrayContaining([
          expect.objectContaining({ diaSemana: 6, horaInicio: '09:00', horaFin: '18:00' }),
        ])
      )
    })
  })
})
