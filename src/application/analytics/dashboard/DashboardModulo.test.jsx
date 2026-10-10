import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardModulo } from './DashboardModulo'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { useThemeStore } from '../../../app/stores/useThemeStore'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { useDashboardStore } from '../../../app/stores/useDashboardStore'

describe('DashboardModulo (BP04 Completeness)', () => {
  const mockPacientes = [
    { id: 'p1', nombre: 'Ana Silva', rut: '11.111.111-1' },
    { id: 'p2', nombre: 'Carlos Ruiz', rut: '22.222.222-2' }
  ]

  beforeEach(() => {
    usePacientesStore.setState({ pacientes: mockPacientes })
    useSesionStore.setState({
      userProfile: {
        email: 'doc@dental.cl',
        nombreCompleto: 'Dr. Roberto Gómez',
        especialidad: 'Implantología',
        rol: 'admin'
      }
    })
    useThemeStore.setState({ theme: 'light' })
    useDashboardStore.getState().initParaRol('admin')
  })

  it('renderiza la arquitectura completa de Blueprint 04: Saludo, Morning Brief, Widgets y Acciones Rápidas', () => {
    render(<DashboardModulo />)

    // Saludo
    expect(screen.getByText(/Dr\. Gómez/i)).toBeInTheDocument()
    expect(screen.getByText(/Implantología/i)).toBeInTheDocument()

    // Morning Brief
    expect(screen.getByText(/Tu día en 30 segundos/i)).toBeInTheDocument()

    // Acciones Rápidas
    expect(screen.getByText('Acciones Rápidas')).toBeInTheDocument()
    expect(screen.getByText('Nueva Cita')).toBeInTheDocument()
    expect(screen.getByText('Presupuesto')).toBeInTheDocument()
  })

  it('renderiza Modo Quirúrgico cuando theme === "surgical"', () => {
    useThemeStore.setState({ theme: 'surgical' })
    render(<DashboardModulo />)

    expect(screen.getByText(/MODO QUIRÚRGICO CLÍNICO/i)).toBeInTheDocument()
    expect(screen.getByText(/Salir del Quirófano/i)).toBeInTheDocument()

    // En modo quirúrgico se ocultan Morning Brief y Acciones Rápidas
    expect(screen.queryByText(/Tu día en 30 segundos/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Acciones Rápidas')).not.toBeInTheDocument()
  })

  it('filtra widgets según el rol del usuario (recepción no ve pagos ni esterilización)', () => {
    useSesionStore.setState({
      userProfile: {
        email: 'rec@dental.cl',
        nombreCompleto: 'María Recepción',
        rol: 'recepcion'
      }
    })
    render(<DashboardModulo />)

    // Recepción ve Sala de Espera
    expect(screen.getByText(/Sala de Espera Virtual/i)).toBeInTheDocument()

    // Recepción NO ve Pagos & Flujo de Caja
    expect(screen.queryByText(/Pagos & Flujo de Caja/i)).not.toBeInTheDocument()
  })

  it('permite abrir el modal de personalización de widgets', () => {
    render(<DashboardModulo />)
    const configBtn = screen.getByTitle(/Personalizar Dashboard/i)
    fireEvent.click(configBtn)

    expect(screen.getByText(/Personalizar Dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/Selecciona los widgets que deseas ver en pantalla/i)).toBeInTheDocument()
  })
})
