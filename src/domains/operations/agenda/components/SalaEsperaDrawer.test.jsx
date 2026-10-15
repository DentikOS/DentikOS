import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SalaEsperaDrawer } from './SalaEsperaDrawer'

describe('SalaEsperaDrawer', () => {
  it('cuando está cerrado (open=false) no renderiza nada', () => {
    const { container } = render(
      <SalaEsperaDrawer
        open={false}
        citasHoy={[]}
        alCerrar={vi.fn()}
        alCheckIn={vi.fn()}
        alLlamar={vi.fn()}
        alIniciar={vi.fn()}
        alNoShow={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza vía portal en document.body cuando open=true', () => {
    const { container } = render(
      <SalaEsperaDrawer
        open={true}
        citasHoy={[]}
        alCerrar={vi.fn()}
        alCheckIn={vi.fn()}
        alLlamar={vi.fn()}
        alIniciar={vi.fn()}
        alNoShow={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
    expect(document.body.querySelector('[role="dialog"][aria-label="Sala de espera virtual"]')).toBeInTheDocument()
  })

  it('cuando está vacío muestra empty state', () => {
    render(
      <SalaEsperaDrawer
        open={true}
        citasHoy={[]}
        alCerrar={vi.fn()}
        alCheckIn={vi.fn()}
        alLlamar={vi.fn()}
        alIniciar={vi.fn()}
        alNoShow={vi.fn()}
      />
    )

    expect(screen.getByText('Sin pacientes en espera')).toBeInTheDocument()
    expect(screen.getByText('No hay citas confirmadas pendientes hoy.')).toBeInTheDocument()
  })

  it('con citas "En sala de espera" muestra tarjetas con minutos y botones de acción', () => {
    const alLlamar = vi.fn()
    const alIniciar = vi.fn()
    const alNoShow = vi.fn()

    const citas = [
      {
        id: 'cita-1',
        pacienteNombre: 'María González',
        horaInicio: '08:00',
        estado: 'En sala de espera',
        boxAsignado: 'Box 2',
        doctor: 'Dra. Silva',
      },
    ]

    render(
      <SalaEsperaDrawer
        open={true}
        citasHoy={citas}
        alCerrar={vi.fn()}
        alCheckIn={vi.fn()}
        alLlamar={alLlamar}
        alIniciar={alIniciar}
        alNoShow={alNoShow}
      />
    )

    expect(screen.getByText('María González')).toBeInTheDocument()
    expect(screen.getByText(/min/i)).toBeInTheDocument()

    // Botones de acción
    const btnLlamar = screen.getByText('Llamar')
    fireEvent.click(btnLlamar)
    expect(alLlamar).toHaveBeenCalledWith('cita-1')

    const btnIniciar = screen.getByText('Iniciar')
    fireEvent.click(btnIniciar)
    expect(alIniciar).toHaveBeenCalledWith('cita-1')

    const btnNoShow = screen.getByTitle('No-show')
    fireEvent.click(btnNoShow)
    expect(alNoShow).toHaveBeenCalledWith('cita-1')
  })

  it('con citas "Confirmada" muestra botón Check-in y al click llama alCheckIn', () => {
    const alCheckIn = vi.fn()

    const citas = [
      {
        id: 'cita-2',
        pacienteNombre: 'Carlos Ruiz',
        horaInicio: '11:00',
        estado: 'Confirmada',
        boxAsignado: 'Box 1',
      },
    ]

    render(
      <SalaEsperaDrawer
        open={true}
        citasHoy={citas}
        alCerrar={vi.fn()}
        alCheckIn={alCheckIn}
        alLlamar={vi.fn()}
        alIniciar={vi.fn()}
        alNoShow={vi.fn()}
      />
    )

    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument()
    const btnCheckIn = screen.getByRole('button', { name: /Check-in/i })
    expect(btnCheckIn).toBeInTheDocument()

    fireEvent.click(btnCheckIn)
    expect(alCheckIn).toHaveBeenCalledWith('cita-2')
  })
})
