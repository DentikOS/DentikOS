import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccionesRapidas } from './AccionesRapidas'

describe('AccionesRapidas (BP04 §04)', () => {
  it('renderiza botones para rol admin con gradiente dorado', () => {
    render(<AccionesRapidas userRole="admin" />)
    expect(screen.getByText('Nueva Cita')).toBeInTheDocument()
    expect(screen.getByText('Nuevo Paciente')).toBeInTheDocument()
    expect(screen.getByText('Presupuesto')).toBeInTheDocument()
    expect(screen.getAllByText('Buscar').length).toBeGreaterThanOrEqual(1)
  })

  it('renderiza botones para rol asistente con Nuevo Ciclo', () => {
    render(<AccionesRapidas userRole="asistente" />)
    expect(screen.getByText('Nueva Cita')).toBeInTheDocument()
    expect(screen.getByText('Nuevo Ciclo')).toBeInTheDocument()
    expect(screen.getByText('Revisar Stock')).toBeInTheDocument()
  })

  it('dispara onEjecutarAccion al hacer clic', () => {
    const handleAccion = vi.fn()
    render(<AccionesRapidas userRole="admin" onEjecutarAccion={handleAccion} />)

    fireEvent.click(screen.getByText('Nueva Cita'))
    expect(handleAccion).toHaveBeenCalledWith(expect.objectContaining({ id: 'nueva_cita' }))
  })

  it('abre Command Palette con botón ⌘K', () => {
    const handlePalette = vi.fn()
    render(<AccionesRapidas userRole="admin" onAbrirCommandPalette={handlePalette} />)

    const buscarBtn = screen.getByText('⌘K')
    fireEvent.click(buscarBtn)
    expect(handlePalette).toHaveBeenCalled()
  })
})
