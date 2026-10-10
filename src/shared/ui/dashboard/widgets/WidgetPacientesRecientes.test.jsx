import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetPacientesRecientes } from './WidgetPacientesRecientes'

describe('WidgetPacientesRecientes (BP04 §03)', () => {
  const mockPacientes = [
    { id: 'p1', nombre: 'Ana Gómez', rut: '12.345.678-9' },
    { id: 'p2', nombre: 'Bernardo O Higgins', rut: '9.876.543-2' }
  ]

  it('renderiza pacientes recientes y estado vacío', () => {
    const { rerender } = render(<WidgetPacientesRecientes pacientes={[]} />)
    expect(screen.getByText('Pacientes Recientes')).toBeInTheDocument()
    expect(screen.getByText(/No hay pacientes recientes/i)).toBeInTheDocument()

    rerender(<WidgetPacientesRecientes pacientes={mockPacientes} />)
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
    expect(screen.getByText('Bernardo O Higgins')).toBeInTheDocument()
    expect(screen.getByText(/RUT: 12.345.678-9/i)).toBeInTheDocument()
  })

  it('dispara onVerFichaPaciente al hacer click en un paciente', () => {
    const handleVerFicha = vi.fn()
    render(
      <WidgetPacientesRecientes
        pacientes={mockPacientes}
        onVerFichaPaciente={handleVerFicha}
      />
    )

    fireEvent.click(screen.getByText('Ana Gómez'))
    expect(handleVerFicha).toHaveBeenCalledWith(mockPacientes[0])
  })

  it('dispara onVerTodos al hacer click en el enlace inferior', () => {
    const handleVerTodos = vi.fn()
    render(
      <WidgetPacientesRecientes
        pacientes={mockPacientes}
        onVerTodos={handleVerTodos}
      />
    )

    fireEvent.click(screen.getByText(/Ver todos los pacientes/i))
    expect(handleVerTodos).toHaveBeenCalled()
  })
})
