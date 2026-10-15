import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalReasignarCita } from './ModalReasignarCita'

describe('ModalReasignarCita (BP05 §08)', () => {
  const citaMock = {
    id: '1',
    pacienteNombre: 'Juan Pérez',
    fecha: '2026-10-15',
    horaInicio: '10:00',
    doctor: 'Dr. Martínez',
    boxAsignado: 'Box 1',
    estado: 'Confirmada',
  }

  const doctoresMock = [
    { userId: 'doc-1', nombreCompleto: 'Dr. Martínez', especialidad: 'General' },
    { userId: 'doc-2', nombreCompleto: 'Dra. Soto', especialidad: 'Ortodoncia' },
  ]

  it('muestra información de la cita', () => {
    render(
      <ModalReasignarCita
        isOpen={true}
        cita={citaMock}
        doctores={doctoresMock}
        alCerrar={() => {}}
        alReasignar={() => {}}
      />
    )

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getAllByText(/Dr. Martínez/).length).toBeGreaterThan(0)
  })

  it('muestra selectores de doctor y box', () => {
    render(
      <ModalReasignarCita
        isOpen={true}
        cita={citaMock}
        doctores={doctoresMock}
        alCerrar={() => {}}
        alReasignar={() => {}}
      />
    )

    expect(screen.getByLabelText(/Nuevo profesional/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nuevo box/i)).toBeInTheDocument()
  })

  it('botón confirmar está deshabilitado si no hay cambios', () => {
    render(
      <ModalReasignarCita
        isOpen={true}
        cita={citaMock}
        doctores={doctoresMock}
        alCerrar={() => {}}
        alReasignar={() => {}}
      />
    )

    const boton = screen.getByRole('button', { name: /Confirmar reasignación/i })
    expect(boton).toBeDisabled()
  })

  it('llama a alReasignar al cambiar doctor', () => {
    const alReasignar = vi.fn()
    render(
      <ModalReasignarCita
        isOpen={true}
        cita={citaMock}
        doctores={doctoresMock}
        alCerrar={() => {}}
        alReasignar={alReasignar}
      />
    )

    const selectDoctor = screen.getByLabelText(/Nuevo profesional/i)
    fireEvent.change(selectDoctor, { target: { value: 'Dra. Soto' } })
    
    const boton = screen.getByRole('button', { name: /Confirmar reasignación/i })
    expect(boton).not.toBeDisabled()
    fireEvent.click(boton)
    
    expect(alReasignar).toHaveBeenCalledWith('1', 'Dra. Soto', 'Box 1')
  })
})
