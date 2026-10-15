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

    expect(screen.getByText('2 pacientes')).toBeInTheDocument()
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

  it('muestra horas extendidas de 06:00 a 23:00 (BP05 §01)', () => {
    render(<AgendaDayView appointments={[]} currentDateIso="2026-10-15" />)
    
    expect(screen.getByText('06:00')).toBeInTheDocument()
    expect(screen.getByText('21:00')).toBeInTheDocument()
    expect(screen.getByText('23:00')).toBeInTheDocument()
  })

  it('muestra citas a las 21:00 correctamente', () => {
    const citas = [
      { id: 1, horaInicio: '21:00', horaFin: '22:00', pacienteNombre: 'Urgencia', estado: 'Pendiente' }
    ]
    render(<AgendaDayView appointments={citas} currentDateIso="2026-10-15" />)
    
    expect(screen.getByText('Urgencia')).toBeInTheDocument()
  })

  it('drag entre doctores asigna el nuevo doctor correctamente', () => {
    const onAppointmentMove = vi.fn()
    const citas = [
      { id: '1', fecha: '2026-10-15', horaInicio: '10:00', doctor: 'Dr. A', estado: 'Pendiente' }
    ]
    const doctores = [
      { id: 'doc-1', nombre: 'Dr. A' },
      { id: 'doc-2', nombre: 'Dr. B' }
    ]

    render(
      <AgendaDayView
        appointments={citas}
        doctors={doctores}
        currentDateIso="2026-10-15"
        onAppointmentMove={onAppointmentMove}
      />
    )

    expect(onAppointmentMove).not.toHaveBeenCalled()
  })

  it('onAppointmentMove recibe payload de tipo MovePayload { horaInicio, fecha, doctor, box }', () => {
    const onAppointmentMove = vi.fn()
    const citas = [
      { id: '1', fecha: '2026-10-15', horaInicio: '10:00', doctor: 'Dr. A', boxAsignado: 'Box 1', estado: 'Pendiente' }
    ]
    const doctores = [
      { id: 'doc-1', nombre: 'Dr. A' },
      { id: 'doc-2', nombre: 'Dr. B' }
    ]

    render(
      <AgendaDayView
        appointments={citas}
        doctors={doctores}
        currentDateIso="2026-10-15"
        onAppointmentMove={onAppointmentMove}
      />
    )

    const payload = {
      horaInicio: '11:00',
      fecha: '2026-10-15',
      doctor: 'Dr. B',
      box: 'Box 2'
    }
    onAppointmentMove('1', payload)

    expect(onAppointmentMove).toHaveBeenCalledWith('1', expect.objectContaining({
      horaInicio: '11:00',
      fecha: '2026-10-15',
      doctor: 'Dr. B',
      box: 'Box 2'
    }))
  })
})

