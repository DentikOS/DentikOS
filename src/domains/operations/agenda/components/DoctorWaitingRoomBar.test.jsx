import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DoctorWaitingRoomBar } from './DoctorWaitingRoomBar'
import { waitingRoomService } from '../services/waitingRoomService'
import { useSesionStore } from '../../../../app/stores/sesionStore'

describe('DoctorWaitingRoomBar (BP05 §05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useSesionStore.setState({
      userProfile: {
        id: 'u-doc-1',
        email: 'doc@example.com',
        nombreCompleto: 'Dr. Roberto Silva',
        rol: 'dentista',
        clinicaId: 'clinica-1',
      },
    })
  })

  it('no renderiza nada si el usuario no es doctor o admin', () => {
    useSesionStore.setState({
      userProfile: {
        id: 'u-rec-1',
        email: 'recep@example.com',
        rol: 'recepcion',
        clinicaId: 'clinica-1',
      },
    })

    const { container } = render(<DoctorWaitingRoomBar />)
    expect(container.firstChild).toBeNull()
  })

  it('no renderiza nada si no hay pacientes en espera', async () => {
    vi.spyOn(waitingRoomService, 'obtenerSalaEsperaActual').mockResolvedValue([])

    const { container } = render(<DoctorWaitingRoomBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza pacientes en espera y acciona llamada', async () => {
    vi.spyOn(waitingRoomService, 'obtenerSalaEsperaActual').mockResolvedValue([
      {
        id: 'ev-1',
        appointmentId: 'c-100',
        clinicaId: 'clinica-1',
        tipo: 'check_in',
        doctorNombre: 'Dr. Silva',
        boxAsignado: 'Box 2',
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      },
    ])

    const onLlamar = vi.fn()
    render(<DoctorWaitingRoomBar onLlamarSiguiente={onLlamar} />)

    expect(await screen.findByRole('region', { name: /pacientes en espera/i })).toBeInTheDocument()
    expect(screen.getByText(/Sala de Espera: 1 paciente/i)).toBeInTheDocument()
    expect(screen.getByText(/Box 2/i)).toBeInTheDocument()

    const btnLlamar = screen.getByRole('button', { name: /llamar/i })
    fireEvent.click(btnLlamar)
    expect(onLlamar).toHaveBeenCalledWith('c-100')
  })

  it('muestra alerta si la espera es mayor a 20 o 30 minutos', async () => {
    vi.spyOn(waitingRoomService, 'obtenerSalaEsperaActual').mockResolvedValue([
      {
        id: 'ev-2',
        appointmentId: 'c-200',
        clinicaId: 'clinica-1',
        tipo: 'check_in',
        doctorNombre: 'Dra. López',
        boxAsignado: 'Box 1',
        createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
      },
    ])

    render(<DoctorWaitingRoomBar />)

    expect(await screen.findByText(/Dra. López - 35 min/i)).toBeInTheDocument()
  })
})
