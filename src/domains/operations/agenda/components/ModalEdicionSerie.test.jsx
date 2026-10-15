import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalEdicionSerie } from './ModalEdicionSerie'

describe('ModalEdicionSerie (BP05 §07)', () => {
  const mockCita = {
    id: 'c1',
    fecha: '2026-10-20',
    horaInicio: '10:00',
    horaFin: '10:45',
    pacienteNombre: 'Andrea Valenzuela',
    boxAsignado: 'Box 2',
    doctor: 'Dr. Perez',
    estado: 'Pendiente',
    recurrence_group_id: 'rec-123'
  }

  it('no renderiza nada si cita es null', () => {
    const { container } = render(
      <ModalEdicionSerie
        isOpen={true}
        cita={null}
        alCerrar={vi.fn()}
        alEditar={vi.fn()}
        alCancelar={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra las 3 opciones de edicion y las 3 de cancelacion', () => {
    render(
      <ModalEdicionSerie
        isOpen={true}
        cita={mockCita}
        alCerrar={vi.fn()}
        alEditar={vi.fn()}
        alCancelar={vi.fn()}
      />
    )

    expect(screen.getByText('Editar cita recurrente')).toBeInTheDocument()
    expect(screen.getByText('Andrea Valenzuela')).toBeInTheDocument()

    // 3 opciones de edición
    expect(screen.getByText('Solo esta cita')).toBeInTheDocument()
    expect(screen.getByText('Esta y todas las futuras')).toBeInTheDocument()
    expect(screen.getByText('Toda la serie')).toBeInTheDocument()

    // 3 opciones de cancelación
    expect(screen.getByText('Cancelar solo esta cita')).toBeInTheDocument()
    expect(screen.getByText('Cancelar esta y todas las futuras')).toBeInTheDocument()
    expect(screen.getByText('Cancelar toda la serie')).toBeInTheDocument()
  })

  it('llama alEditar con el alcance correcto al hacer click', () => {
    const handleEditar = vi.fn()
    render(
      <ModalEdicionSerie
        isOpen={true}
        cita={mockCita}
        alCerrar={vi.fn()}
        alEditar={handleEditar}
        alCancelar={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Solo esta cita'))
    expect(handleEditar).toHaveBeenCalledWith('solo_esta')

    fireEvent.click(screen.getByText('Esta y todas las futuras'))
    expect(handleEditar).toHaveBeenCalledWith('esta_y_futuras')

    fireEvent.click(screen.getByText('Toda la serie'))
    expect(handleEditar).toHaveBeenCalledWith('toda_la_serie')
  })

  it('llama alCancelar con el alcance correcto al hacer click', () => {
    const handleCancelar = vi.fn()
    render(
      <ModalEdicionSerie
        isOpen={true}
        cita={mockCita}
        alCerrar={vi.fn()}
        alEditar={vi.fn()}
        alCancelar={handleCancelar}
      />
    )

    fireEvent.click(screen.getByText('Cancelar solo esta cita'))
    expect(handleCancelar).toHaveBeenCalledWith('solo_esta')

    fireEvent.click(screen.getByText('Cancelar esta y todas las futuras'))
    expect(handleCancelar).toHaveBeenCalledWith('esta_y_futuras')

    fireEvent.click(screen.getByText('Cancelar toda la serie'))
    expect(handleCancelar).toHaveBeenCalledWith('toda_la_serie')
  })
})
