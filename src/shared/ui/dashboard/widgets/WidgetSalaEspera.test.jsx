import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetSalaEspera } from './WidgetSalaEspera'

describe('WidgetSalaEspera (BP04 §03)', () => {
  const mockEspera = [
    {
      id: 'c1',
      pacienteId: 'p1',
      pacienteNombre: 'Mario Silva',
      boxAsignado: 'Box 2',
      horaInicio: '10:00'
    }
  ]
  const mockPacientes = [
    { id: 'p1', nombre: 'Mario Silva' }
  ]

  it('renderiza lista de espera y estado vacío', () => {
    const { rerender } = render(<WidgetSalaEspera enEspera={[]} />)
    expect(screen.getByText(/Sala de Espera Virtual/i)).toBeInTheDocument()
    expect(screen.getByText(/No hay pacientes en sala de espera/i)).toBeInTheDocument()

    rerender(<WidgetSalaEspera enEspera={mockEspera} />)
    expect(screen.getByText('Mario Silva')).toBeInTheDocument()
    expect(screen.getByText(/Box: Box 2/i)).toBeInTheDocument()
    expect(screen.getByText(/1 en espera/i)).toBeInTheDocument()
  })

  it('responde al botón Llamar ejecutando onLlamarPaciente', () => {
    const handleLlamar = vi.fn()
    render(<WidgetSalaEspera enEspera={mockEspera} onLlamarPaciente={handleLlamar} />)

    const btn = screen.getByText('Llamar')
    fireEvent.click(btn)
    expect(handleLlamar).toHaveBeenCalledWith(mockEspera[0])
    expect(screen.getByText('¡Llamado!')).toBeInTheDocument()
  })

  it('abre ficha al hacer click en el paciente', () => {
    const handleFicha = vi.fn()
    render(
      <WidgetSalaEspera
        enEspera={mockEspera}
        pacientes={mockPacientes}
        onVerFichaPaciente={handleFicha}
      />
    )

    fireEvent.click(screen.getByText('Mario Silva'))
    expect(handleFicha).toHaveBeenCalledWith(mockPacientes[0])
  })
})
