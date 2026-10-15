import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppointmentCard } from './AppointmentCard'

vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: vi.fn((selector) => 
    selector({ userProfile: { id: 'user-1', rol: 'dentista' } })
  )
}))

describe('AppointmentCard (BP05 §01 & §07)', () => {
  const mockCita = {
    id: 'c1',
    fecha: '2026-10-10',
    horaInicio: '09:00',
    horaFin: '09:45',
    estado: 'Confirmada',
    pacienteNombre: 'Gonzalo Morales',
    boxAsignado: 'Box 1 - Dental',
    motivo: 'Evaluación general'
  }

  it('renderiza datos principales de la cita con pill de estado', () => {
    render(<AppointmentCard appointment={mockCita} />)
    expect(screen.getByText('Gonzalo Morales')).toBeInTheDocument()
    expect(screen.getByText(/09:00 - 09:45/)).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText('Box 1 - Dental')).toBeInTheDocument()
  })

  it('detecta urgencia y badge de serie/recurrente', () => {
    const citaUrgente = {
      ...mockCita,
      motivo: 'Control de Urgencia dental',
      recurrencia: 'semanal',
      recurrence_group_id: 'rec-123'
    }
    render(<AppointmentCard appointment={citaUrgente} />)
    expect(screen.getByText(/Urgencia/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Ver timeline de la serie/i)).toBeInTheDocument()
  })

  it('ejecuta onClick y onWhatsAppClick al interactuar', () => {
    const handleClick = vi.fn()
    const handleWhatsApp = vi.fn()
    render(
      <AppointmentCard
        appointment={mockCita}
        onClick={handleClick}
        onWhatsAppClick={handleWhatsApp}
      />
    )

    fireEvent.click(screen.getByText('Gonzalo Morales'))
    expect(handleClick).toHaveBeenCalled()

    const btnWs = screen.getByLabelText(/Confirmar por WhatsApp/i)
    fireEvent.click(btnWs)
    expect(handleWhatsApp).toHaveBeenCalled()
  })

  it('ejecuta onSerieClick al hacer click en el badge de serie', () => {
    const handleSerieClick = vi.fn()
    const citaRecurrente = {
      ...mockCita,
      recurrencia: 'semanal',
      recurrence_group_id: 'rec-123'
    }
    render(
      <AppointmentCard
        appointment={citaRecurrente}
        onSerieClick={handleSerieClick}
      />
    )

    const btnSerie = screen.getByTitle(/Ver timeline de la serie/i)
    fireEvent.click(btnSerie)
    expect(handleSerieClick).toHaveBeenCalledWith(citaRecurrente)
  })

  it('muestra botón para abrir cambio de estado y ejecuta onAbrirCambiarEstado al clickear', () => {
    const onAbrirCambiarEstado = vi.fn()
    const cita = { id: 1, estado: 'Pendiente', pacienteNombre: 'Juan', doctor: 'user-1' }
    render(
      <AppointmentCard 
        appointment={cita}
        onAbrirCambiarEstado={onAbrirCambiarEstado}
      />
    )
    
    const btn = screen.getByRole('button', { name: /Cambiar estado de Juan/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent(/Pendiente/i)
    fireEvent.click(btn)
    expect(onAbrirCambiarEstado).toHaveBeenCalledWith(cita)
  })

  it('muestra botón WhatsApp en la tarjeta', () => {
    render(
      <AppointmentCard 
        appointment={{ id: 1, estado: 'Pendiente', pacienteNombre: 'Juan' }}
        onWhatsAppClick={() => {}}
      />
    )
    
    expect(screen.getByRole('button', { name: /Confirmar por WhatsApp/i })).toBeInTheDocument()
  })
})
