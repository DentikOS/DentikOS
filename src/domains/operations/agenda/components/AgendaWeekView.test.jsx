import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgendaWeekView } from './AgendaWeekView'

describe('AgendaWeekView (BP05 §02)', () => {
  const mockCitas = [
    {
      id: 'c1',
      fecha: '2026-10-12', // Lunes
      horaInicio: '09:00',
      pacienteNombre: 'Daniela Paredes',
      trataMiento: 'Ortodoncia'
    }
  ]

  it('renderiza columnas de los 7 días de la semana y las citas correspondientes', () => {
    render(
      <AgendaWeekView
        appointments={mockCitas}
        currentDateIso="2026-10-14"
      />
    )

    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Mar')).toBeInTheDocument()
    expect(screen.getByText('Mié')).toBeInTheDocument()
    expect(screen.getByText('Jue')).toBeInTheDocument()
    expect(screen.getByText('Vie')).toBeInTheDocument()
    expect(screen.getByText('Sáb')).toBeInTheDocument()
    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByText('Daniela Paredes')).toBeInTheDocument()
  })

  it('llama onDayClick al pulsar sobre el encabezado de un día', () => {
    const handleDayClick = vi.fn()
    render(
      <AgendaWeekView
        appointments={mockCitas}
        currentDateIso="2026-10-14"
        onDayClick={handleDayClick}
      />
    )

    fireEvent.click(screen.getByText('Lun'))
    expect(handleDayClick).toHaveBeenCalledWith('2026-10-12')
  })

  it('llama onAppointmentClick al pulsar sobre una cita', () => {
    const handleCitaClick = vi.fn()
    render(
      <AgendaWeekView
        appointments={mockCitas}
        currentDateIso="2026-10-14"
        onAppointmentClick={handleCitaClick}
      />
    )

    fireEvent.click(screen.getByText('Daniela Paredes'))
    expect(handleCitaClick).toHaveBeenCalledWith(mockCitas[0])
  })
})
