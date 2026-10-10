import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgendaMonthView } from './AgendaMonthView'

describe('AgendaMonthView (BP05 §02)', () => {
  const mockCitas = [
    {
      id: 'c1',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      estado: 'Confirmada',
      pacienteNombre: 'Arturo Prat'
    },
    {
      id: 'c2',
      fecha: '2026-10-15',
      horaInicio: '11:00',
      estado: 'Pendiente',
      pacienteNombre: 'Manuel Blanco'
    }
  ]

  it('renderiza cabecera del mes y días de la semana', () => {
    render(
      <AgendaMonthView
        appointments={mockCitas}
        currentDateIso="2026-10-15"
      />
    )

    expect(screen.getByText(/octubre 2026/i)).toBeInTheDocument()
    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByText(/2 citas registradas/i)).toBeInTheDocument()
  })

  it('llama onDayClick al pulsar sobre una celda del día', () => {
    const handleDayClick = vi.fn()
    render(
      <AgendaMonthView
        appointments={mockCitas}
        currentDateIso="2026-10-15"
        onDayClick={handleDayClick}
      />
    )

    fireEvent.click(screen.getByText('15'))
    expect(handleDayClick).toHaveBeenCalledWith('2026-10-15')
  })
})
