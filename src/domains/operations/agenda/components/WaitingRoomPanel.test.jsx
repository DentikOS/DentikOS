import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WaitingRoomPanel } from './WaitingRoomPanel'

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
      notificado: false
    },
    {
      id: 'c-2',
      citaId: 'c-2',
      nombre: 'María González',
      horaLlegada: '08:30',
      boxAsignado: 'Box 2',
      doctor: 'Dr. Silva',
      confirmadoWhatsApp: false,
      notificado: true
    }
  ]

  it('renderiza título, contadores de resumen y pacientes en espera', () => {
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

  it('permite accionar el flujo de 3 pasos: Llamar, Avisado, Iniciar', () => {
    const onLlamar = vi.fn()
    const onAvisar = vi.fn()
    const onIniciar = vi.fn()

    render(
      <WaitingRoomPanel
        pacientes={mockPacientes}
        onLlamarSiguiente={onLlamar}
        onAvisarPaciente={onAvisar}
        onIniciarAtencion={onIniciar}
      />
    )

    const botonesLlamar = screen.getAllByRole('button', { name: /llamar/i })
    fireEvent.click(botonesLlamar[0])
    expect(onLlamar).toHaveBeenCalledWith('c-1')

    const botonAvisado = screen.getByRole('button', { name: /paciente avisado/i })
    fireEvent.click(botonAvisado)
    expect(onAvisar).toHaveBeenCalledWith('c-1')

    const botonesIniciar = screen.getAllByRole('button', { name: /iniciar atención/i })
    fireEvent.click(botonesIniciar[0])
    expect(onIniciar).toHaveBeenCalledWith('c-1')
  })

  it('permite marcar No-show', () => {
    const onNoShow = vi.fn()

    render(
      <WaitingRoomPanel
        pacientes={mockPacientes}
        onMarcarNoShow={onNoShow}
      />
    )

    const botonesNoShow = screen.getAllByRole('button', { name: /no-show/i })
    fireEvent.click(botonesNoShow[0])
    expect(onNoShow).toHaveBeenCalledWith('c-1')
  })

  it('muestra estado vacío cuando no hay pacientes', () => {
    render(<WaitingRoomPanel pacientes={[]} />)
    expect(screen.getByText(/no hay pacientes en sala de espera/i)).toBeInTheDocument()
  })
})
