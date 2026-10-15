import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WaitingRoomPanel } from './WaitingRoomPanel'
import { waitingRoomService } from '../services/waitingRoomService'
import { sonidoAgendaService } from '../services/sonidoAgendaService'

vi.mock('../services/sonidoAgendaService', () => ({
  sonidoAgendaService: {
    play: vi.fn(),
  },
}))

describe('WaitingRoomPanel (BP05 §05)', () => {
  const mockPacientes = [
    {
      id: 'c-1',
      citaId: 'c-1',
      nombre: 'Juan Pérez',
      horaLlegada: '09:00',
      boxAsignado: 'Box 1',
      doctor: 'Dra. López',
      confirmadoWhatsApp: true,
      notificado: false,
    },
    {
      id: 'c-2',
      citaId: 'c-2',
      nombre: 'María González',
      horaLlegada: '08:30',
      boxAsignado: 'Box 2',
      doctor: 'Dr. Silva',
      confirmadoWhatsApp: false,
      notificado: true,
    },
  ]

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(waitingRoomService, 'obtenerHistorialCita').mockResolvedValue([])
    vi.spyOn(waitingRoomService, 'registrarEvento').mockResolvedValue({
      id: 'mock-ev',
      appointmentId: 'c-1',
      clinicaId: 'mock-clinica',
      tipo: 'check_in',
      createdAt: new Date().toISOString(),
    })
  })

  it('renderiza título, contadores de resumen y pacientes', () => {
    render(
      <WaitingRoomPanel
        pacientes={mockPacientes}
        totalEnAtencion={2}
        totalCompletadasHoy={5}
      />
    )

    expect(screen.getByText('Sala de Espera Virtual')).toBeInTheDocument()
    expect(screen.getByText('2 en espera')).toBeInTheDocument()
    expect(screen.getByText('2 en atención')).toBeInTheDocument()
    expect(screen.getByText('5 completadas hoy')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('María González')).toBeInTheDocument()
  })

  it('muestra solo botón Check-in cuando el paciente no ha llegado', async () => {
    render(<WaitingRoomPanel pacientes={[mockPacientes[0]]} />)
    expect(screen.getByRole('button', { name: /check-in/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /llamar siguiente/i })).not.toBeInTheDocument()
  })

  it('muestra botón Llamar siguiente después del check-in', async () => {
    vi.spyOn(waitingRoomService, 'obtenerHistorialCita').mockResolvedValue([
      {
        id: 'e1',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'check_in',
        createdAt: new Date().toISOString(),
      },
    ])

    render(<WaitingRoomPanel pacientes={[mockPacientes[0]]} />)

    expect(await screen.findByRole('button', { name: /llamar siguiente/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^check-in$/i })).not.toBeInTheDocument()
  })

  it('muestra botón Paciente avisado tras llamada', async () => {
    vi.spyOn(waitingRoomService, 'obtenerHistorialCita').mockResolvedValue([
      {
        id: 'e1',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'check_in',
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: 'e2',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'llamar_siguiente',
        createdAt: new Date().toISOString(),
      },
    ])

    render(<WaitingRoomPanel pacientes={[mockPacientes[0]]} />)

    expect(await screen.findByRole('button', { name: /paciente avisado/i })).toBeInTheDocument()
  })

  it('muestra botón Iniciar atención tras confirmar aviso', async () => {
    vi.spyOn(waitingRoomService, 'obtenerHistorialCita').mockResolvedValue([
      {
        id: 'e1',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'check_in',
        createdAt: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: 'e2',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'llamar_siguiente',
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: 'e3',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'paciente_avisado',
        createdAt: new Date().toISOString(),
      },
    ])

    render(<WaitingRoomPanel pacientes={[mockPacientes[0]]} />)

    expect(await screen.findByRole('button', { name: /iniciar atenci[oó]n/i })).toBeInTheDocument()
  })

  it('permite accionar Llamar siguiente y dispara registrarEvento', async () => {
    const onLlamar = vi.fn()
    vi.spyOn(waitingRoomService, 'obtenerHistorialCita').mockResolvedValue([
      {
        id: 'e1',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'check_in',
        createdAt: new Date().toISOString(),
      },
    ])

    render(<WaitingRoomPanel pacientes={[mockPacientes[0]]} onLlamarSiguiente={onLlamar} />)

    const btnLlamar = await screen.findByRole('button', { name: /llamar siguiente/i })
    fireEvent.click(btnLlamar)

    await waitFor(() => {
      expect(waitingRoomService.registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'c-1',
          tipo: 'llamar_siguiente',
        })
      )
      expect(onLlamar).toHaveBeenCalledWith('c-1')
    })
  })

  it('muestra botones de Reasignar y No-show cuando está en espera', async () => {
    vi.spyOn(waitingRoomService, 'obtenerHistorialCita').mockResolvedValue([
      {
        id: 'e1',
        appointmentId: 'c-1',
        clinicaId: 'cl-1',
        tipo: 'check_in',
        createdAt: new Date().toISOString(),
      },
    ])

    render(<WaitingRoomPanel pacientes={[mockPacientes[0]]} />)

    expect(await screen.findByRole('button', { name: /reasignar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /no-show/i })).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay pacientes', () => {
    render(<WaitingRoomPanel pacientes={[]} />)
    expect(screen.getByText(/no hay pacientes en sala de espera/i)).toBeInTheDocument()
  })

  it('reproduce sonido paciente_espera_larga cuando la espera supera 20 minutos', async () => {
    const ahora = new Date()
    const hace25Min = new Date(ahora.getTime() - 25 * 60000)
    const horaLlegada = `${String(hace25Min.getHours()).padStart(2, '0')}:${String(hace25Min.getMinutes()).padStart(2, '0')}`

    const pacienteDemorado = {
      id: 'c-demorado',
      citaId: 'c-demorado',
      nombre: 'Carlos Demorado',
      horaLlegada,
      enAtencion: false,
    }

    render(<WaitingRoomPanel pacientes={[pacienteDemorado]} />)

    await waitFor(() => {
      expect(sonidoAgendaService.play).toHaveBeenCalledWith('paciente_espera_larga')
    })
  })
})
