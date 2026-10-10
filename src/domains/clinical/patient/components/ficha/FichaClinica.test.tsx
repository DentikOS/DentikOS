import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FichaClinica } from './FichaClinica'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

const mockPaciente: Paciente = {
  id: 'pac-123',
  rut: '16.789.012-3',
  nombre: 'Verónica Salinas',
  alergias: ['Penicilina'],
  alergiasSeveras: ['Penicilina'],
  anticoagulantes: true,
  estado: 'activo',
  version: 1,
}

describe('FichaClinica BP06', () => {
  beforeEach(() => {
    usePacientesStore.setState({
      pestanaActiva: 'datos',
    })
  })

  it('renderiza la ficha con encabezado de alertas críticas y pestañas', () => {
    render(<FichaClinica paciente={mockPaciente} />)
    expect(screen.getByTestId('ficha-clinica-bp06')).toBeInTheDocument()
    expect(screen.getByTestId('alertas-criticas-header')).toBeInTheDocument()
    expect(screen.getByText('Datos Paciente')).toBeInTheDocument()
    expect(screen.getByText('Odontograma')).toBeInTheDocument()
    expect(screen.getByText('Plan Tratamiento')).toBeInTheDocument()
  })

  it('permite cambiar a la pestaña Odontograma', () => {
    render(<FichaClinica paciente={mockPaciente} />)
    fireEvent.click(screen.getByText('Odontograma'))
    expect(screen.getByTestId('odontograma-completo-bp06')).toBeInTheDocument()
  })

  it('activa el Modo Quirúrgico al hacer clic en el botón', () => {
    render(<FichaClinica paciente={mockPaciente} />)
    fireEvent.click(screen.getByTestId('btn-modo-quirurgico'))
    expect(screen.getByTestId('modo-quirurgico-modulo')).toBeInTheDocument()

    // Salir del modo quirúrgico
    fireEvent.click(screen.getByTestId('btn-salir-quirurgico'))
    expect(screen.queryByTestId('modo-quirurgico-modulo')).not.toBeInTheDocument()
    expect(screen.getByTestId('ficha-clinica-bp06')).toBeInTheDocument()
  })

  it('llama a alVolver al hacer clic en volver a pacientes', () => {
    const alVolver = vi.fn()
    render(<FichaClinica paciente={mockPaciente} alVolver={alVolver} />)
    fireEvent.click(screen.getByTestId('btn-volver-pacientes'))
    expect(alVolver).toHaveBeenCalled()
  })
})
