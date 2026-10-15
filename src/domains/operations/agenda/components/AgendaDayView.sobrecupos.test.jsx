import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgendaDayView } from './AgendaDayView'

describe('AgendaDayView - Sobrecupos (BP05 §03)', () => {
  it('muestra badge naranja cuando hay 2 citas en mismo horario (sobrecupo)', () => {
    const citas = [
      { id: 1, horaInicio: '10:00', doctor: 'Dr. A', pacienteNombre: 'P1', estado: 'Confirmada' },
      { id: 2, horaInicio: '10:00', doctor: 'Dr. A', pacienteNombre: 'P2', estado: 'Confirmada' },
    ]
    render(
      <AgendaDayView 
        appointments={citas} 
        doctors={[{ id: '1', nombre: 'Dr. A', colorIdentidad: '#B88E3A' }]}
        currentDateIso="2026-10-14"
      />
    )
    
    expect(screen.getByText('2 pacientes')).toBeInTheDocument()
  })
  
  it('NO muestra badge cuando hay solo 1 cita por slot', () => {
    const citas = [
      { id: 1, horaInicio: '10:00', doctor: 'Dr. A', pacienteNombre: 'P1', estado: 'Confirmada' },
    ]
    render(
      <AgendaDayView 
        appointments={citas} 
        doctors={[{ id: '1', nombre: 'Dr. A' }]}
        currentDateIso="2026-10-14"
      />
    )
    
    expect(screen.queryByText(/\d+ pacientes/)).not.toBeInTheDocument()
  })
})
