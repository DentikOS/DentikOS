import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardSaludo } from './DashboardSaludo'

describe('DashboardSaludo (BP04 §02)', () => {
  it('renderiza saludo con nombre del doctor y conteo de citas', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Carlos Silva', especialidad: 'Implantología' }}
        citasHoyCount={8}
        enEsperaCount={2}
      />
    )

    expect(screen.getByText(/Dr\. Silva/i)).toBeInTheDocument()
    expect(screen.getByText(/8 citas hoy/i)).toBeInTheDocument()
    expect(screen.getByText(/2 en sala de espera/i)).toBeInTheDocument()
    expect(screen.getByText(/Implantología/i)).toBeInTheDocument()
  })

  it('renderiza próxima cita y maneja click en ficha', () => {
    const handleVerFicha = vi.fn()
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Dra. María Paz' }}
        proximaCita={{ pacienteNombre: 'Juan Pérez', hora: '10:00', box: 'Box 2', pacienteId: 'p-123' }}
        onVerFicha={handleVerFicha}
      />
    )

    expect(screen.getByText(/Juan Pérez/i)).toBeInTheDocument()
    expect(screen.getByText(/10:00/i)).toBeInTheDocument()
    expect(screen.getByText(/Box 2/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Juan Pérez/i))
    expect(handleVerFicha).toHaveBeenCalledWith('p-123')
  })
})
