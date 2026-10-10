import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MorningBrief } from './MorningBrief'

describe('MorningBrief (BP04 §02)', () => {
  const mockData = {
    lineas: [
      { id: 'agenda', icono: '📅', texto: '8 citas · 1 cancelación', seccion: 'Agenda', severidad: 'info' },
      { id: 'alertas', icono: '⚠️', texto: 'Juan Pérez tiene alergia', seccion: 'Pacientes', severidad: 'alerta' }
    ],
    fechaActualizacion: '09:00'
  }

  it('renderiza título y líneas inteligentes', () => {
    render(<MorningBrief data={mockData} />)
    expect(screen.getByText(/Tu día en 30 segundos/i)).toBeInTheDocument()
    expect(screen.getByText(/8 citas · 1 cancelación/i)).toBeInTheDocument()
    expect(screen.getByText(/Juan Pérez tiene alergia/i)).toBeInTheDocument()
    expect(screen.getByText(/Actualizado 09:00/i)).toBeInTheDocument()
  })

  it('llama a onNavegar al hacer click en una línea', () => {
    const handleNavegar = vi.fn()
    render(<MorningBrief data={mockData} onNavegar={handleNavegar} />)

    fireEvent.click(screen.getByText(/8 citas · 1 cancelación/i))
    expect(handleNavegar).toHaveBeenCalledWith('Agenda')
  })

  it('no renderiza nada si no hay líneas', () => {
    const { container } = render(<MorningBrief data={{ lineas: [], fechaActualizacion: '' }} />)
    expect(container.firstChild).toBeNull()
  })
})
