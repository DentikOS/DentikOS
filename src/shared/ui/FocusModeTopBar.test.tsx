import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FocusModeTopBar } from './FocusModeTopBar'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

// Mock stores
vi.mock('../../app/stores/useSidebarStore', () => ({
  useSidebarStore: vi.fn((selector) =>
    selector({
      focusMode: true,
      setFocusMode: vi.fn(),
    })
  ),
}))

vi.mock('../../app/stores/useTopBarStore', () => ({
  useTopBarStore: vi.fn((selector) =>
    selector({
      timerStart: Date.now() - 60000, // 1 minuto atrás
    })
  ),
}))

vi.mock('../hooks/useGuardadoState', () => ({
  useGuardadoState: vi.fn(() => 'neutral'),
}))

describe('FocusModeTopBar (Blueprint 03 §09)', () => {
  const mockBreadcrumbs = [
    { label: 'Pacientes', onClick: vi.fn() },
    { label: 'Juan Pérez', onClick: vi.fn() },
    { label: 'Odontograma' },
  ]

  const mockPaciente = {
    id: 'pac-1',
    nombre: 'Juan Pérez',
    rut: '12.345.678-9',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSidebarStore).mockImplementation((selector: any) =>
      selector({
        focusMode: true,
        setFocusMode: vi.fn(),
      })
    )
  })

  it('renderiza breadcrumbs con máximo 3 niveles', () => {
    render(
      <FocusModeTopBar
        breadcrumbs={mockBreadcrumbs}
        pacienteSeleccionado={mockPaciente}
      />
    )

    expect(screen.getByText('Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Odontograma')).toBeInTheDocument()
  })

  it('renderiza breadcrumbs clickeables excepto el último', () => {
    render(
      <FocusModeTopBar
        breadcrumbs={mockBreadcrumbs}
        pacienteSeleccionado={mockPaciente}
      />
    )

    const pacientesBtn = screen.getByRole('button', { name: /pacientes/i })
    expect(pacientesBtn).toBeInTheDocument()

    const ultimoNivel = screen.getByText('Odontograma')
    expect(ultimoNivel.tagName).toBe('SPAN')
    expect(ultimoNivel).toHaveAttribute('aria-current', 'page')
  })

  it('renderiza timer de atención cuando hay paciente activo', () => {
    render(
      <FocusModeTopBar
        breadcrumbs={mockBreadcrumbs}
        pacienteSeleccionado={mockPaciente}
      />
    )

    const timer = screen.getByTitle(/tiempo transcurrido/i)
    expect(timer).toBeInTheDocument()
    expect(timer).toHaveTextContent('⏱')
  })

  it('renderiza botón Salir y NO botón Guardar', () => {
    render(
      <FocusModeTopBar
        breadcrumbs={mockBreadcrumbs}
        pacienteSeleccionado={mockPaciente}
      />
    )

    expect(screen.getByRole('button', { name: /salir de modo foco/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar cambios/i })).not.toBeInTheDocument()
  })

  it('botón Salir llama a setFocusMode(false)', () => {
    const setFocusModeMock = vi.fn()
    vi.mocked(useSidebarStore).mockImplementation((selector: any) =>
      selector({
        focusMode: true,
        setFocusMode: setFocusModeMock,
      })
    )

    render(
      <FocusModeTopBar
        breadcrumbs={mockBreadcrumbs}
        pacienteSeleccionado={mockPaciente}
      />
    )

    const salirBtn = screen.getByRole('button', { name: /salir de modo foco/i })
    fireEvent.click(salirBtn)

    expect(setFocusModeMock).toHaveBeenCalledWith(false)
  })

  it('trunca breadcrumbs largos con "..." al inicio', () => {
    const longBreadcrumbs = [
      { label: 'María José González Rodríguez', onClick: vi.fn() },
    ]

    render(
      <FocusModeTopBar
        breadcrumbs={longBreadcrumbs}
        pacienteSeleccionado={mockPaciente}
      />
    )

    // Debe truncar a 20 chars con "..." al inicio
    const truncated = screen.getByText(/…/)
    expect(truncated).toBeInTheDocument()
  })

  it('muestra kbd Esc en botón Salir', () => {
    render(
      <FocusModeTopBar
        breadcrumbs={mockBreadcrumbs}
        pacienteSeleccionado={mockPaciente}
      />
    )

    expect(screen.getByText('Esc')).toBeInTheDocument()
  })
})
