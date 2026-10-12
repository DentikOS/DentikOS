import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PacientesListado } from './PacientesListado'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

vi.mock('../../../../../shared/hooks/useRBAC', () => ({
  useRBAC: () => ({
    puede: vi.fn().mockReturnValue(true),
  }),
}))

vi.mock('../../hooks/usePapelera', () => ({
  usePapelera: () => ({
    pacientesEliminados: [],
    cargando: false,
    contador: 0,
    restaurar: vi.fn(),
    vaciar: vi.fn(),
    contadorElegibles: 0,
    aniosRetencion: 5,
    refrescar: vi.fn(),
  }),
}))

const mockPacientes: Paciente[] = [
  {
    id: 'pac-1',
    rut: '12345678-5',
    nombre: 'Ana María Gómez',
    telefono: '+56911112222',
    email: 'ana@gmail.com',
    alergias: ['Penicilina'],
    alergiasSeveras: ['Penicilina'],
    estado: 'activo',
    fechaCreacion: new Date().toISOString(),
    fechaUltimaVisita: '2026-03-01T10:00:00Z',
    version: 1,
  },
  {
    id: 'pac-2',
    rut: '98765432-1',
    nombre: 'Carlos Perez',
    telefono: '+56933334444',
    email: 'carlos@gmail.com',
    alergias: [],
    estado: 'nuevo',
    fechaCreacion: new Date().toISOString(),
    version: 1,
  },
]

describe('PacientesListado (BP06)', () => {
  const alSeleccionar = vi.fn()
  const alEliminar = vi.fn().mockResolvedValue(true)

  beforeEach(() => {
    vi.clearAllMocks()
    usePacientesStore.setState({
      pacientes: mockPacientes,
      vistaActual: 'lista',
      filtros: { estado: [], doctor: [], ultimaVisita: '', proximaCita: '', etiquetas: [] },
      seleccion: [],
    })
  })

  it('renderiza KPIs rápidos correctamente', () => {
    render(
      <PacientesListado
        alSeleccionarPaciente={alSeleccionar}
        alEliminarPaciente={alEliminar}
      />
    )
    expect(screen.getByTestId('pacientes-kpis')).toBeInTheDocument()
    expect(screen.getByText('Total Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Pacientes Activos')).toBeInTheDocument()
    expect(screen.getByText('Con Alerta Médica')).toBeInTheDocument()
  })

  it('permite alternar entre las 3 vistas (lista, tabla, tarjetas)', () => {
    render(
      <PacientesListado
        alSeleccionarPaciente={alSeleccionar}
        alEliminarPaciente={alEliminar}
      />
    )

    // Inicialmente en vista lista
    expect(screen.getByTestId('vista-lista-container')).toBeInTheDocument()

    // Cambiar a vista tabla
    fireEvent.click(screen.getByTestId('vista-btn-tabla'))
    expect(screen.getByTestId('vista-tabla-container')).toBeInTheDocument()

    // Cambiar a vista tarjetas
    fireEvent.click(screen.getByTestId('vista-btn-tarjetas'))
    expect(screen.getByTestId('vista-tarjetas-container')).toBeInTheDocument()
  })

  it('filtra pacientes por nombre o RUT con búsqueda', async () => {
    render(
      <PacientesListado
        alSeleccionarPaciente={alSeleccionar}
        alEliminarPaciente={alEliminar}
      />
    )

    const input = screen.getByTestId('input-busqueda-paciente')
    fireEvent.change(input, { target: { value: 'Carlos' } })

    await waitFor(() => {
      expect(screen.getByText('Carlos Perez')).toBeInTheDocument()
      expect(screen.queryByText('Ana María Gómez')).not.toBeInTheDocument()
    })
  })

  it('llama a alSeleccionarPaciente al presionar ver ficha', () => {
    render(
      <PacientesListado
        alSeleccionarPaciente={alSeleccionar}
        alEliminarPaciente={alEliminar}
      />
    )

    const btnFicha = screen.getByTestId('btn-ficha-pac-1')
    fireEvent.click(btnFicha)

    expect(alSeleccionar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pac-1', nombre: 'Ana María Gómez' })
    )
  })

  it('soporta selección múltiple y muestra barra de acciones masivas', () => {
    render(
      <PacientesListado
        alSeleccionarPaciente={alSeleccionar}
        alEliminarPaciente={alEliminar}
      />
    )

    const checkboxAna = screen.getByLabelText(/Seleccionar Ana María Gómez/i)
    fireEvent.click(checkboxAna)

    expect(screen.getByTestId('acciones-masivas-bar')).toBeInTheDocument()
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument()
  })

  it('muestra spinner mientras carga inicialmente con lista vacía', async () => {
    let resolver: (p: Paciente[]) => void = () => {}
    const mockPromise = new Promise<void>((res) => {
      resolver = () => res()
    })
    const mockCargar = vi.fn().mockReturnValue(mockPromise)
    usePacientesStore.setState({
      pacientes: [],
      cargarPacientes: mockCargar,
    })

    render(<PacientesListado />)

    expect(screen.getByTestId('pacientes-loading-state')).toBeInTheDocument()
    expect(screen.getByText('Cargando pacientes...')).toBeInTheDocument()

    resolver()
    usePacientesStore.setState({ pacientes: mockPacientes })

    await waitFor(() => {
      expect(screen.queryByTestId('pacientes-loading-state')).not.toBeInTheDocument()
    })
  })
})
