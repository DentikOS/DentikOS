import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgendaListView } from './AgendaListView'

describe('AgendaListView', () => {
  const citasMock = [
    {
      id: 'cita-1',
      pacienteNombre: 'Constanza Morales',
      pacienteTelefono: '+56912345678',
      horaInicio: '09:00:00',
      horaFin: '09:30:00',
      fecha: '2026-10-15',
      estado: 'Pendiente',
      doctor: 'Dr. Roberto Soto',
      boxAsignado: 'Box 1',
      trataMiento: 'Limpieza dental',
    },
  ]

  it('renderiza 4 botones de acción por fila (Editar, Estado, WhatsApp, Eliminar)', () => {
    render(
      <AgendaListView
        citas={citasMock}
        alVerFichaPaciente={vi.fn()}
        onEditar={vi.fn()}
        onCambiarEstado={vi.fn()}
        onWhatsApp={vi.fn()}
        onEliminar={vi.fn()}
      />
    )

    expect(screen.getByText('Constanza Morales')).toBeInTheDocument()
    expect(screen.getByTitle('Editar cita')).toBeInTheDocument()
    expect(screen.getByTitle('Cambiar estado')).toBeInTheDocument()
    expect(screen.getByTitle('Confirmar por WhatsApp')).toBeInTheDocument()
    expect(screen.getByTitle('Eliminar cita')).toBeInTheDocument()
  })

  it('click en editar llama onEditar con la cita seleccionada', () => {
    const onEditar = vi.fn()
    render(
      <AgendaListView
        citas={citasMock}
        onEditar={onEditar}
      />
    )

    const btnEditar = screen.getByTitle('Editar cita')
    fireEvent.click(btnEditar)

    expect(onEditar).toHaveBeenCalledTimes(1)
    expect(onEditar).toHaveBeenCalledWith(citasMock[0])
  })

  it('click en eliminar llama onEliminar con la cita seleccionada', () => {
    const onEliminar = vi.fn()
    render(
      <AgendaListView
        citas={citasMock}
        onEliminar={onEliminar}
      />
    )

    const btnEliminar = screen.getByTitle('Eliminar cita')
    fireEvent.click(btnEliminar)

    expect(onEliminar).toHaveBeenCalledTimes(1)
    expect(onEliminar).toHaveBeenCalledWith(citasMock[0])
  })
})
