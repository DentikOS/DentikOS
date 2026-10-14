import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetEsterilizacion } from './WidgetEsterilizacion'

describe('WidgetEsterilizacion (BP04 §03)', () => {
  it('renderiza estado en curso correctamente', () => {
    const handleIr = vi.fn()
    render(
      <WidgetEsterilizacion
        info={{
          equipo: 'Autoclave B1',
          ciclo: 50,
          temperatura: '134°C',
          tiempoRestante: '15 min',
          estado: 'en_curso'
        }}
        onIrEsterilizacion={handleIr}
      />
    )

    expect(screen.getByText(/Control de Esterilización/i)).toBeInTheDocument()
    expect(screen.getByText('Autoclave B1')).toBeInTheDocument()
    expect(screen.getByText(/Ciclo #50/i)).toBeInTheDocument()
    expect(screen.getByText(/Ciclo en Curso/i)).toBeInTheDocument()
    expect(screen.getByText('134°C')).toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()
  })

  it('renderiza estado validado y responde al click de navegación', () => {
    const handleIr = vi.fn()
    render(
      <WidgetEsterilizacion
        info={{
          equipo: 'Autoclave B1',
          ciclo: 51,
          temperatura: '134°C',
          tiempoRestante: '0 min',
          estado: 'validado'
        }}
        onIrEsterilizacion={handleIr}
      />
    )

    expect(screen.getByText(/Validado/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Abrir Módulo de Esterilización/i))
    expect(handleIr).toHaveBeenCalled()
  })

  it('renderiza estado vacío cuando no hay ciclos activos', () => {
    render(<WidgetEsterilizacion info={null} onIrEsterilizacion={() => {}} />)
    expect(screen.getByText('No hay ciclos de esterilización activos')).toBeInTheDocument()
    expect(screen.getByText('Sin ciclos activos')).toBeInTheDocument()
  })
})
