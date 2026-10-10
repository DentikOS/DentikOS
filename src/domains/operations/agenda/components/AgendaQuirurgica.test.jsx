import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AgendaQuirurgica } from './AgendaQuirurgica'

describe('AgendaQuirurgica (BP05 §06)', () => {
  const mockCitas = [
    {
      id: 'c-1',
      pacienteNombre: 'Carlos Santana',
      horaInicio: '09:00',
      boxAsignado: 'Box Quirófano 1',
      trataMiento: 'Implante unitario pieza 14',
      estado: 'En atención'
    },
    {
      id: 'c-2',
      pacienteNombre: 'Elena Gómez',
      horaInicio: '10:30',
      boxAsignado: 'Box 2',
      estado: 'Confirmada'
    },
    {
      id: 'c-3',
      pacienteNombre: 'Pedro Morales',
      horaInicio: '08:00',
      estado: 'Completada'
    }
  ]

  it('renderiza título quirúrgico, paciente en box y alertas críticas', () => {
    render(<AgendaQuirurgica citas={mockCitas} />)

    expect(screen.getByText('AGENDA QUIRÚRGICA')).toBeInTheDocument()
    expect(screen.getByText('Carlos Santana')).toBeInTheDocument()
    expect(screen.getByText('Implante unitario pieza 14')).toBeInTheDocument()
    expect(screen.getByText('Contraindicaciones & Alergias')).toBeInTheDocument()
  })

  it('muestra la próxima cita y el resumen de citas totales, completadas y restantes', () => {
    render(<AgendaQuirurgica citas={mockCitas} />)

    expect(screen.getByText(/Elena Gómez/)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // Totales
    expect(screen.getByText('1')).toBeInTheDocument() // Completadas
  })

  it('permite abrir ficha clínica del paciente actual', () => {
    const onAbrirFicha = vi.fn()
    render(<AgendaQuirurgica citas={mockCitas} onAbrirFicha={onAbrirFicha} />)

    const btnFicha = screen.getByRole('button', { name: /abrir ficha clínica/i })
    fireEvent.click(btnFicha)
    expect(onAbrirFicha).toHaveBeenCalledWith(mockCitas[0])
  })

  it('permite salir del modo quirúrgico con el botón o cambiando tema', () => {
    const onSalir = vi.fn()
    render(<AgendaQuirurgica citas={mockCitas} onSalir={onSalir} />)

    const btnSalir = screen.getByRole('button', { name: /salir del quirófano/i })
    fireEvent.click(btnSalir)
    expect(onSalir).toHaveBeenCalled()
  })
})
