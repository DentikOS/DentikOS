/**
 * Tests — ModoPresentacionBar (Blueprint 03)
 * Valida renderizado en modo presentación, visualización del paciente/edad, y salida con botón o Esc.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModoPresentacionBar } from './ModoPresentacionBar'

describe('ModoPresentacionBar (Blueprint 03)', () => {
  const mockPaciente = {
    id: 'pac-1',
    nombre: 'Carolina Rojas',
    edad: 34,
  }

  it('no renderiza nada cuando activo es false', () => {
    const { container } = render(
      <ModoPresentacionBar activo={false} paciente={mockPaciente} onSalir={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderiza la barra con logo y clínica por defecto cuando activo es true', () => {
    render(
      <ModoPresentacionBar activo={true} paciente={mockPaciente} onSalir={vi.fn()} />
    )
    expect(screen.getByText('Dentik')).toBeInTheDocument()
    expect(screen.getByText('OS')).toBeInTheDocument()
    expect(screen.getByText('DentikOS Clinical Suite')).toBeInTheDocument()
    expect(screen.getByText('DentikOS Clinical Suite')).toHaveClass('text-base')
    expect(screen.getByText(/Carolina Rojas/)).toBeInTheDocument()
    expect(screen.getByText(/Carolina Rojas/)).toHaveClass('text-base')
    expect(screen.getByText(/34 años/)).toBeInTheDocument()
  })

  it('permite salir con el botón [Esc] Salir', () => {
    const onSalir = vi.fn()
    render(
      <ModoPresentacionBar activo={true} paciente={mockPaciente} onSalir={onSalir} />
    )
    const salirBtn = screen.getByRole('button', { name: /salir del modo presentación/i })
    fireEvent.click(salirBtn)
    expect(onSalir).toHaveBeenCalledTimes(1)
  })

  it('muestra "Sin paciente seleccionado" cuando paciente es null con tipografía text-base', () => {
    render(
      <ModoPresentacionBar activo={true} paciente={null} onSalir={vi.fn()} />
    )
    const emptyMsg = screen.getByText('Sin paciente seleccionado')
    expect(emptyMsg).toBeInTheDocument()
    expect(emptyMsg).toHaveClass('text-base')
  })
})
