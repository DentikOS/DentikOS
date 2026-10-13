import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SelectorEstadoPaciente } from './SelectorEstadoPaciente'
import { timelineService } from '../../services/timelineService'
import { pacientesStorageService } from '../../services/pacientesStorageService'
import { useSesionStore } from '../../../../../app/stores/sesionStore'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

vi.mock('../../services/timelineService', () => ({
  timelineService: {
    agregarEvento: vi.fn(),
    obtenerTimeline: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('../../services/pacientesStorageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/pacientesStorageService')>()
  return {
    ...actual,
    pacientesStorageService: {
      ...actual.pacientesStorageService,
      actualizarPaciente: vi.fn().mockResolvedValue(true),
    },
  }
})

vi.mock('../../../../../infrastructure/notification/notificationService', () => ({
  notificationService: {
    mostrar: vi.fn(),
  },
}))

describe('SelectorEstadoPaciente', () => {
  const pacienteMock: Paciente = {
    id: 'pac-1',
    nombre: 'Juan Pérez',
    rut: '12.345.678-5',
    estado: 'activo',
  } as Paciente

  beforeEach(() => {
    vi.clearAllMocks()
    useSesionStore.setState({
      userProfile: {
        email: 'admin@clinica.cl',
        nombreCompleto: 'Dra. Administradora',
        rol: 'admin',
      },
    })
    usePacientesStore.setState({
      pacientes: [pacienteMock],
    })
  })

  it('permite a un admin cambiar el estado a inactivo y registra en timeline', async () => {
    render(<SelectorEstadoPaciente paciente={pacienteMock} />)

    const btnInactivo = screen.getByTestId('btn-estado-inactivo')
    fireEvent.click(btnInactivo)

    await waitFor(() => {
      expect(pacientesStorageService.actualizarPaciente).toHaveBeenCalledWith(
        'pac-1',
        expect.objectContaining({ estado: 'inactivo' })
      )
      expect(timelineService.agregarEvento).toHaveBeenCalledWith(
        'pac-1',
        expect.objectContaining({
          tipo: 'cambio_estado',
          titulo: 'Estado cambiado de activo a inactivo',
        })
      )
    })
  })

  it('al cambiar a bloqueado, solicita motivo en modal antes de confirmar', async () => {
    render(<SelectorEstadoPaciente paciente={pacienteMock} />)

    const btnBloqueado = screen.getByTestId('btn-estado-bloqueado')
    fireEvent.click(btnBloqueado)

    expect(screen.getByText('Motivo del cambio de estado')).toBeInTheDocument()
    const textarea = screen.getByTestId('textarea-motivo-bloqueo')
    fireEvent.change(textarea, { target: { value: 'Incomparecencia reiterada' } })

    const btnConfirmar = screen.getByTestId('btn-confirmar-bloqueo')
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(pacientesStorageService.actualizarPaciente).toHaveBeenCalledWith(
        'pac-1',
        expect.objectContaining({
          estado: 'bloqueado',
          bloqueado: true,
          motivoBloqueo: 'Incomparecencia reiterada',
        })
      )
      expect(timelineService.agregarEvento).toHaveBeenCalledWith(
        'pac-1',
        expect.objectContaining({
          tipo: 'cambio_estado',
          detalles: 'Motivo: Incomparecencia reiterada',
        })
      )
    })
  })

  it('deshabilita el botón bloqueado para usuarios no admin', () => {
    useSesionStore.setState({
      userProfile: {
        email: 'recep@clinica.cl',
        nombreCompleto: 'Recepcionista',
        rol: 'recepcion',
      },
    })

    render(<SelectorEstadoPaciente paciente={pacienteMock} />)

    const btnBloqueado = screen.getByTestId('btn-estado-bloqueado')
    expect(btnBloqueado).toBeDisabled()
  })
})
