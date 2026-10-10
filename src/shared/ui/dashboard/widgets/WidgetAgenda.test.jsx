import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetAgenda } from './WidgetAgenda'

describe('WidgetAgenda (BP04 §03)', () => {
  const mockCitas = [
    {
      id: 'c1',
      pacienteId: 'p1',
      pacienteNombre: 'Carlos Santana',
      horaInicio: '09:00',
      motivo: 'Control general',
      estado: 'Agendado'
    },
    {
      id: 'c2',
      pacienteId: 'p2',
      pacienteNombre: 'María López',
      horaInicio: '10:30',
      motivo: 'Endodoncia',
      estado: 'Confirmado'
    }
  ]
  const mockPacientes = [
    { id: 'p1', nombre: 'Carlos Santana', rut: '11.111.111-1' }
  ]

  it('renderiza citas y estado vacío correctamente', () => {
    const { rerender } = render(<WidgetAgenda citas={[]} />)
    expect(screen.getByText(/Próximas Citas/i)).toBeInTheDocument()
    expect(screen.getByText(/No hay citas programadas para hoy/i)).toBeInTheDocument()

    rerender(<WidgetAgenda citas={mockCitas} />)
    expect(screen.getByText('Carlos Santana')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText(/2 hoy/i)).toBeInTheDocument()
  })

  it('llama onVerFichaPaciente al hacer click en una cita', () => {
    const handleVerFicha = vi.fn()
    render(
      <WidgetAgenda
        citas={mockCitas}
        pacientes={mockPacientes}
        onVerFichaPaciente={handleVerFicha}
      />
    )

    fireEvent.click(screen.getByText('Carlos Santana'))
    expect(handleVerFicha).toHaveBeenCalledWith(mockPacientes[0])
  })

  it('llama onVerAgendaCompleta al hacer click en el botón de ver agenda', () => {
    const handleVerAgenda = vi.fn()
    render(
      <WidgetAgenda
        citas={mockCitas}
        onVerAgendaCompleta={handleVerAgenda}
      />
    )

    const btn = screen.getByText(/Ver agenda completa/i)
    fireEvent.click(btn)
    expect(handleVerAgenda).toHaveBeenCalled()
  })

  it('hace fallback a pacienteNombre si el paciente no está en la lista de pacientes', () => {
    const handleVerFicha = vi.fn()
    render(
      <WidgetAgenda
        citas={[{ id: 'c9', pacienteId: 'p99', pacienteNombre: 'Paciente Desconocido', horaInicio: '12:00' }]}
        pacientes={[]}
        onVerFichaPaciente={handleVerFicha}
      />
    )

    fireEvent.click(screen.getByText('Paciente Desconocido'))
    expect(handleVerFicha).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Paciente Desconocido'
    }))
  })

  it('renderiza dragHandle si es proporcionado', () => {
    render(
      <WidgetAgenda
        citas={[]}
        dragHandle={<span data-testid="agenda-drag">drag-me</span>}
      />
    )
    expect(screen.getByTestId('agenda-drag')).toBeInTheDocument()
  })
})
