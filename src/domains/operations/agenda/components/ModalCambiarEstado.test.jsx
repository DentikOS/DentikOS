import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalCambiarEstado } from './ModalCambiarEstado'

describe('ModalCambiarEstado', () => {
  const citaPendiente = {
    id: 'test-1',
    fecha: '2026-10-15',
    horaInicio: '10:00',
    pacienteNombre: 'Juan Perez',
    estado: 'Pendiente',
  }

  it('desde estado Pendiente renderiza 8 botones; 4 habilitados y 4 deshabilitados', () => {
    render(
      <ModalCambiarEstado
        isOpen={true}
        cita={citaPendiente}
        alCerrar={vi.fn()}
        alCambiar={vi.fn()}
      />
    )

    expect(screen.getByText(/Cambiar estado de la cita/i)).toBeInTheDocument()
    expect(screen.getByText('Juan Perez')).toBeInTheDocument()

    // 8 botones en total para los 8 estados core
    const botones = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('title')?.includes('Transición') || btn.getAttribute('title')?.includes('Cambiar a')
    )
    expect(botones).toHaveLength(8)

    const habilitados = botones.filter((btn) => !btn.disabled)
    const deshabilitados = botones.filter((btn) => btn.disabled)

    // Desde Pendiente: transiciones válidas son Confirmada, En sala de espera, Cancelada, No-show
    expect(habilitados).toHaveLength(4)
    expect(deshabilitados).toHaveLength(4)
  })

  it('click en habilitado llama alCambiar y alCerrar', () => {
    const alCambiar = vi.fn()
    const alCerrar = vi.fn()

    render(
      <ModalCambiarEstado
        isOpen={true}
        cita={citaPendiente}
        alCerrar={alCerrar}
        alCambiar={alCambiar}
      />
    )

    const btnConfirmar = screen.getByText(/→ Confirmada/i)
    expect(btnConfirmar).not.toBeDisabled()
    fireEvent.click(btnConfirmar)

    expect(alCambiar).toHaveBeenCalledWith('test-1', 'Confirmada')
    expect(alCerrar).toHaveBeenCalledTimes(1)
  })

  it('click en deshabilitado NO llama alCambiar', () => {
    const alCambiar = vi.fn()
    const alCerrar = vi.fn()

    render(
      <ModalCambiarEstado
        isOpen={true}
        cita={citaPendiente}
        alCerrar={alCerrar}
        alCambiar={alCambiar}
      />
    )

    // 'En atención' no es válida desde Pendiente
    const btnInvalido = screen.getByRole('button', { name: 'En atención' })
    expect(btnInvalido).toBeDisabled()
    fireEvent.click(btnInvalido)

    expect(alCambiar).not.toHaveBeenCalled()
    expect(alCerrar).not.toHaveBeenCalled()
  })
})
