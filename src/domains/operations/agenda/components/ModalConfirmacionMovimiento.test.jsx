import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalConfirmacionMovimiento } from './ModalConfirmacionMovimiento'

describe('ModalConfirmacionMovimiento (BP05 §08)', () => {
  const citaMock = {
    id: 1,
    pacienteNombre: 'Juan Pérez',
    fecha: '2026-10-15',
    horaInicio: '10:00',
    horaFin: '11:00',
    doctor: 'Dr. Martínez',
    boxAsignado: 'Box 2',
    estado: 'Confirmada',
  }

  const nuevoHorarioMock = {
    fecha: '2026-10-15',
    horaInicio: '11:30',
    horaFin: '12:30',
    doctor: 'Dr. Martínez',
    box: 'Box 2',
  }

  it('muestra información de origen y destino', () => {
    render(
      <ModalConfirmacionMovimiento
        isOpen={true}
        cita={citaMock}
        nuevoHorario={nuevoHorarioMock}
        alCerrar={() => {}}
        alConfirmar={() => {}}
      />
    )

    expect(screen.getByText(/Juan Pérez/)).toBeInTheDocument()
    expect(screen.getByText(/10:00/)).toBeInTheDocument()
    expect(screen.getByText(/11:30/)).toBeInTheDocument()
  })

  it('muestra checkbox de notificación WhatsApp', () => {
    render(
      <ModalConfirmacionMovimiento
        isOpen={true}
        cita={citaMock}
        nuevoHorario={nuevoHorarioMock}
        alCerrar={() => {}}
        alConfirmar={() => {}}
      />
    )

    expect(screen.getByText(/Notificar al paciente por WhatsApp/)).toBeInTheDocument()
  })

  it('muestra alerta de sobrecupo cuando hay conflicto', () => {
    render(
      <ModalConfirmacionMovimiento
        isOpen={true}
        cita={citaMock}
        nuevoHorario={nuevoHorarioMock}
        hayConflicto={true}
        citasEnConflicto={[
          { id: 2, pacienteNombre: 'María González', horaInicio: '11:30', fecha: '2026-10-15', estado: 'Confirmada' }
        ]}
        alCerrar={() => {}}
        alConfirmar={() => {}}
      />
    )

    expect(screen.getByText(/Sobrecupo detectado/)).toBeInTheDocument()
    expect(screen.getByText(/María González/)).toBeInTheDocument()
  })

  it('llama a alConfirmar con valor de checkbox', () => {
    const alConfirmar = vi.fn()
    render(
      <ModalConfirmacionMovimiento
        isOpen={true}
        cita={citaMock}
        nuevoHorario={nuevoHorarioMock}
        alCerrar={() => {}}
        alConfirmar={alConfirmar}
      />
    )

    fireEvent.click(screen.getByText('Confirmar movimiento'))
    expect(alConfirmar).toHaveBeenCalledWith(true)
  })
})
