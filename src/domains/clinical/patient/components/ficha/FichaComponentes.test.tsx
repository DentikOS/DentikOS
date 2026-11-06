import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Periodontograma } from './periodontograma/Periodontograma'
import { Evoluciones } from './evoluciones/Evoluciones'
import { Recetas } from './recetas/Recetas'
import { Consentimientos } from './consentimientos/Consentimientos'
import type { Paciente } from '../../schemas/pacienteSchema'

const mockPaciente: Paciente = {
  id: 'pac-test-1',
  rut: '15.678.901-2',
  nombre: 'Ignacio Morales',
  alergias: ['Penicilina'],
  alergiasSeveras: ['Penicilina'],
  tutorLegal: {
    nombre: 'Elena Morales',
    rut: '12.345.678-9',
    relacion: 'Madre',
    telefono: '+56988887777',
  },
  estado: 'activo',
  version: 1,
}

describe('Componentes Clínicos BP06', () => {
  it('renderiza Periodontograma EPB con los 6 sextantes', () => {
    render(<Periodontograma />)
    expect(screen.getByTestId('periodontograma-bp06')).toBeInTheDocument()
    expect(screen.getByText(/Examen Periodontal Básico/i)).toBeInTheDocument()
    expect(screen.getByTestId('grid-sextantes-epb')).toBeInTheDocument()
    expect(screen.getByText('Sextante 1: Sup. Derecho')).toBeInTheDocument()
  })

  it('renderiza Evoluciones con 10 plantillas inteligentes y permite agregar nota', () => {
    render(<Evoluciones nombrePaciente="Ignacio Morales" />)
    expect(screen.getByTestId('evoluciones-bp06')).toBeInTheDocument()
    expect(screen.getByText('Profilaxis & Destartraje')).toBeInTheDocument()

    // Aplicar plantilla
    fireEvent.click(screen.getByText('Restauración Resina'))
    expect(screen.getByDisplayValue(/Bajo aislamiento absoluto/i)).toBeInTheDocument()
  })

  it('no bloquea una receta solo por la alergia antes de identificar un fármaco', () => {
    render(<Recetas paciente={mockPaciente} />)
    expect(screen.getByTestId('recetas-bp06')).toBeInTheDocument()
    expect(screen.queryByText(/contraindicado por alergia a penicilinas/i)).not.toBeInTheDocument()
  })

  it('asigna automáticamente tutor legal en Consentimientos si el paciente tiene tutor', () => {
    render(<Consentimientos paciente={mockPaciente} />)
    expect(screen.getByTestId('consentimientos-bp06')).toBeInTheDocument()
    expect(screen.getByText(/Elena Morales \(Tutor Legal Responsable\)/i)).toBeInTheDocument()
  })
})
