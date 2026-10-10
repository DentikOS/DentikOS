import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgendaDayView } from './AgendaDayView'

describe('AgendaDayView (BP05 §01)', () => {
  const mockCitas = [
    {
      id: 'c1',
      fecha: '2026-10-10',
      horaInicio: '09:00',
      estado: 'Confirmada',
      pacienteNombre: 'Camila Silva',
      doctor: 'Dra. Soto',
      boxAsignado: 'Box 1'
    },
    {
      id: 'c2',
      fecha: '2026-10-10',
      horaInicio: '09:30',
      estado: 'Pendiente',
      pacienteNombre: 'Felipe Reyes',
      doctor: 'Dra. Soto',
      boxAsignado: 'Box 1'
    }
  ]

  const mockDoctores = [
    { id: 'doc-1', nombre: 'Dra. Soto' },
    { id: 'doc-2', nombre: 'Dr. Valenzuela' }
  ]

  it('renderiza horas de la jornada y columnas de doctores', () => {
    render(
      <AgendaDayView
        appointments={mockCitas}
        doctors={mockDoctores}
        currentDateIso="2026-10-10"
      />
    )

    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getAllByText('09:00').length).toBeGreaterThan(0)
    expect(screen.getByText('Dra. Soto')).toBeInTheDocument()
    expect(screen.getByText('Dr. Valenzuela')).toBeInTheDocument()
    expect(screen.getByText('Camila Silva')).toBeInTheDocument()
    expect(screen.getByText('Felipe Reyes')).toBeInTheDocument()
  })

  it('detecta sobrecupo cuando hay múltiples citas en la misma franja horaria', () => {
    render(
      <AgendaDayView
        appointments={mockCitas}
        doctors={mockDoctores}
        currentDateIso="2026-10-10"
      />
    )

    expect(screen.getByText(/Sobrecupo: 2 pacientes/i)).toBeInTheDocument()
  })

  it('llama onAppointmentClick al hacer click en una cita', () => {
    const handleCitaClick = vi.fn()
    render(
      <AgendaDayView
        appointments={mockCitas}
        doctors={mockDoctores}
        currentDateIso="2026-10-10"
        onAppointmentClick={handleCitaClick}
      />
    )

    fireEvent.click(screen.getByText('Camila Silva'))
    expect(handleCitaClick).toHaveBeenCalled()
  })
})
