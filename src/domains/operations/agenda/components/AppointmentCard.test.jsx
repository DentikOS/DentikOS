import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppointmentCard } from './AppointmentCard'

describe('AppointmentCard (BP05 §01)', () => {
  const mockCita = {
    id: 'c1',
    fecha: '2026-10-10',
    horaInicio: '09:00',
    horaFin: '09:45',
    estado: 'Confirmada',
    pacienteNombre: 'Gonzalo Morales',
    boxAsignado: 'Box 1 - Dental',
    motivo: 'Evaluación general'
  }

  it('renderiza datos principales de la cita con pill de estado', () => {
    render(<AppointmentCard appointment={mockCita} />)
    expect(screen.getByText('Gonzalo Morales')).toBeInTheDocument()
    expect(screen.getByText(/09:00 - 09:45/)).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText('Box 1 - Dental')).toBeInTheDocument()
  })

  it('detecta urgencia y badge recurrente', () => {
    const citaUrgente = {
      ...mockCita,
      motivo: 'Control de Urgencia dental',
      recurrencia: 'semanal'
    }
    render(<AppointmentCard appointment={citaUrgente} />)
    expect(screen.getByText(/Urgencia/i)).toBeInTheDocument()
    expect(screen.getByText(/Recurrente/i)).toBeInTheDocument()
  })

  it('ejecuta onClick y onWhatsAppClick al interactuar', () => {
    const handleClick = vi.fn()
    const handleWhatsApp = vi.fn()
    render(
      <AppointmentCard
        appointment={mockCita}
        onClick={handleClick}
        onWhatsAppClick={handleWhatsApp}
      />
    )

    fireEvent.click(screen.getByText('Gonzalo Morales'))
    expect(handleClick).toHaveBeenCalled()

    const btnWs = screen.getByLabelText(/Confirmar por WhatsApp/i)
    fireEvent.click(btnWs)
    expect(handleWhatsApp).toHaveBeenCalled()
  })
})
