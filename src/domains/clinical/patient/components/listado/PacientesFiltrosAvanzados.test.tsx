import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PacientesFiltrosAvanzados } from './PacientesFiltrosAvanzados'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'

vi.mock('../../hooks/useDoctoresClinica', () => ({
  useDoctoresClinica: () => ({
    doctores: [
      { id: 'doc-1', nombre: 'Dra. María Paz', rol: 'dentista' },
      { id: 'doc-2', nombre: 'Dr. Roberto Gómez', rol: 'dentista' },
    ],
    loading: false,
    error: null,
  }),
}))

describe('PacientesFiltrosAvanzados', () => {
  beforeEach(() => {
    usePacientesStore.setState({
      filtros: {
        estado: [],
        doctor: [],
        ultimaVisita: '',
        proximaCita: '',
        edadMin: '',
        edadMax: '',
        prevision: [],
        etiquetas: [],
        tratamiento: '',
      },
    })
  })

  it('renderiza los 8 criterios de filtrado', () => {
    render(<PacientesFiltrosAvanzados />)
    expect(screen.getByText('Filtros avanzados')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
    expect(screen.getByText('Doctor tratante')).toBeInTheDocument()
    expect(screen.getByText('Última visita antes de')).toBeInTheDocument()
    expect(screen.getByText('Próxima cita después de')).toBeInTheDocument()
    expect(screen.getByText('Edad (años)')).toBeInTheDocument()
    expect(screen.getByText('Previsión')).toBeInTheDocument()
    expect(screen.getByText('Etiquetas')).toBeInTheDocument()
    expect(screen.getByText('Tratamiento activo')).toBeInTheDocument()
  })

  it('permite alternar estado y limpiar filtros', () => {
    render(<PacientesFiltrosAvanzados />)
    const btnActivo = screen.getByRole('button', { name: /^activo$/i })
    fireEvent.click(btnActivo)

    expect(usePacientesStore.getState().filtros.estado).toEqual(['activo'])

    const btnLimpiar = screen.getByRole('button', { name: /limpiar/i })
    fireEvent.click(btnLimpiar)

    expect(usePacientesStore.getState().filtros.estado).toEqual([])
  })
})
