import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModalCambiarDoctorTratante } from './ModalCambiarDoctorTratante'
import { pacientesStorageService } from '../../services/pacientesStorageService'
import { timelineService } from '../../services/timelineService'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../../../app/stores/sesionStore'
import type { Paciente } from '../../schemas/pacienteSchema'

vi.mock('../../hooks/useDoctoresClinica', () => ({
  useDoctoresClinica: () => ({
    doctores: [
      { id: 'doc-1', nombre: 'Dra. María José' },
      { id: 'doc-2', nombre: 'Dr. Roberto Gómez' },
    ],
    loading: false,
  }),
}))

vi.mock('../../services/timelineService', () => ({
  timelineService: {
    agregarEvento: vi.fn(),
    obtenerTimeline: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('../../../../../infrastructure/notification/notificationService', () => ({
  notificationService: {
    mostrar: vi.fn(),
  },
}))

describe('ModalCambiarDoctorTratante', () => {
  const pacienteMock: Paciente = {
    id: 'pac-1',
    nombre: 'Ana María',
    rut: '12.345.678-5',
    doctorTratanteId: 'doc-1',
    doctorTratante: 'Dra. María José',
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

  it('guarda el nuevo doctor usando pacientesStorageService.actualizarPaciente', async () => {
    const spyActualizar = vi.spyOn(pacientesStorageService, 'actualizarPaciente').mockResolvedValue(true)
    const onClose = vi.fn()

    render(
      <ModalCambiarDoctorTratante
        paciente={pacienteMock}
        isOpen={true}
        onClose={onClose}
      />
    )

    // Select second doctor
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'doc-2' } })

    const btnGuardar = screen.getByText('Confirmar Reasignación')
    fireEvent.click(btnGuardar)

    await waitFor(() => {
      expect(spyActualizar).toHaveBeenCalledWith(
        'pac-1',
        expect.objectContaining({
          doctorTratanteId: 'doc-2',
          doctorTratante: 'Dr. Roberto Gómez',
        })
      )
      expect(timelineService.agregarEvento).toHaveBeenCalledWith(
        'pac-1',
        expect.objectContaining({
          tipo: 'admin',
          titulo: expect.stringContaining('Dr. Roberto Gómez'),
        })
      )
      expect(onClose).toHaveBeenCalled()
    })
  })
})
