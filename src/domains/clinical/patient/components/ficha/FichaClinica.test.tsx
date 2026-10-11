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

  it('renderiza la ficha con encabezado de alertas críticas y 8 pestañas exactas', () => {
    render(<FichaClinica paciente={mockPaciente} />)
    expect(screen.getByTestId('ficha-clinica-bp06')).toBeInTheDocument()
    expect(screen.getByTestId('alertas-criticas-header')).toBeInTheDocument()
    expect(screen.getByText('Resumen Ejecutivo')).toBeInTheDocument()
    expect(screen.getByText('Datos del paciente')).toBeInTheDocument()
    expect(screen.getByText('Odontograma')).toBeInTheDocument()
    expect(screen.getByText('Periodontograma')).toBeInTheDocument()
    expect(screen.getByText('Evoluciones')).toBeInTheDocument()
    expect(screen.getByText('Presupuestos + Plan Tratamiento')).toBeInTheDocument()
    expect(screen.getByText('Recetas + Consentimientos + Docs')).toBeInTheDocument()
    expect(screen.getByText('Timeline / Historial')).toBeInTheDocument()
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

  it('pregunta por embarazo/lactancia a paciente femenina en edad fértil si no está registrado', () => {
    const pacienteFemenina: Paciente = {
      ...mockPaciente,
      sexo: 'femenino',
      edad: 28,
      embarazo: undefined,
    }
    const alActualizar = vi.fn()
    render(<FichaClinica paciente={pacienteFemenina} alActualizarPaciente={alActualizar} />)
    expect(screen.getByTestId('banner-pregunta-embarazo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
    expect(alActualizar).toHaveBeenCalledWith(expect.objectContaining({ embarazo: true }))
  })
})

