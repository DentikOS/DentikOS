import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { PacientesListado } from './listado/PacientesListado'
import { FichaClinica } from './ficha/FichaClinica'
import { usePacientesStore } from '../../../../app/stores/usePacientesStore'
import { usePresupuestosStore } from '../../../../app/stores/usePresupuestosStore'
import type { Paciente } from '../schemas/pacienteSchema'

const PACIENTE_MOCK: Paciente = {
  id: 'pac-bp06-01',
  nombre: 'Ignacio Valenzuela',
  rut: '17.654.321-9',
  telefono: '+56 9 7654 3210',
  edad: 34,
  prevision: 'Isapre',
  alergias: 'Ninguna',
  email: 'ignacio.v@dental.cl',
  estado: 'activo'
}

describe('Integración BP06 + BP07 — Navegación y componentes nuevos', () => {
  beforeEach(() => {
    usePacientesStore.setState({
      pacientes: [PACIENTE_MOCK],
      pacienteActivo: null,
      vistaActual: 'lista',
      seleccion: [],
      fichaActiva: null,
      pestanaActiva: 'datos'
    })
    usePresupuestosStore.setState({
      presupuestos: [],
      presupuestoActivo: null,
      vistaActual: 'simplificada'
    })
  })

  it('PacientesListado renderiza correctamente con el store nuevo', () => {
    render(<PacientesListado />)
    expect(screen.getByText('Directorio de Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Ignacio Valenzuela')).toBeInTheDocument()
    expect(screen.getByTestId('btn-nuevo-paciente')).toBeInTheDocument()
  })

  it('FichaClinica renderiza las 8 pestañas y datos del paciente activo', () => {
    usePacientesStore.getState().setPacienteActivo(PACIENTE_MOCK)
    render(<FichaClinica pacienteId={PACIENTE_MOCK.id} />)

    expect(screen.getByTestId('ficha-clinica-bp06')).toBeInTheDocument()
    expect(screen.getByText('Odontograma')).toBeInTheDocument()
    expect(screen.getByText('Periodontograma')).toBeInTheDocument()
    expect(screen.getByText('Plan Tratamiento')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('usePresupuestosStore conecta con planes de tratamiento clínicos', () => {
    const { generarDesdePlanTratamiento } = usePresupuestosStore.getState()
    const presupuestoGenerado = generarDesdePlanTratamiento(
      PACIENTE_MOCK.id,
      PACIENTE_MOCK.nombre,
      [{ codigoPrestacion: 'CONS-01', nombrePrestacion: 'Evaluación', cantidad: 1, precioUnitario: 30000 }]
    )

    expect(presupuestoGenerado).toBeDefined()
    expect(presupuestoGenerado.pacienteId).toBe(PACIENTE_MOCK.id)
    expect(usePresupuestosStore.getState().presupuestos).toHaveLength(1)
  })
})
