import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardSaludo } from './DashboardSaludo'

describe('DashboardSaludo (BP04 §02)', () => {
  it('renderiza saludo con nombre del doctor y conteo de citas', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Carlos Silva', especialidad: 'Implantología' }}
        citasHoyCount={8}
        enEsperaCount={2}
      />
    )

    expect(screen.getByText(/Dr\. Silva/i)).toBeInTheDocument()
    expect(screen.getByText(/8 citas hoy/i)).toBeInTheDocument()
    expect(screen.getByText(/2 en sala de espera/i)).toBeInTheDocument()
    expect(screen.getByText(/Implantología/i)).toBeInTheDocument()
  })

  it('renderiza próxima cita y maneja click en ficha', () => {
    const handleVerFicha = vi.fn()
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Dra. María Paz' }}
        proximaCita={{ pacienteNombre: 'Juan Pérez', hora: '10:00', box: 'Box 2', pacienteId: 'p-123' }}
        onVerFicha={handleVerFicha}
      />
    )

    expect(screen.getByText(/Juan Pérez/i)).toBeInTheDocument()
    expect(screen.getByText(/10:00/i)).toBeInTheDocument()
    expect(screen.getByText(/Box 2/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Juan Pérez/i))
    expect(handleVerFicha).toHaveBeenCalledWith('p-123')
  })

  it('renderiza botón de personalizar widgets con icono y maneja click', () => {
    const handleAbrirConfig = vi.fn()
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Dr. Roberto Gómez' }}
        onAbrirConfig={handleAbrirConfig}
      />
    )

    const btn = screen.getByRole('button', { name: /Personalizar widgets del Dashboard/i })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(handleAbrirConfig).toHaveBeenCalledTimes(1)
  })

  it('muestra "Dr. [Apellido]" para rol dentista', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Dr. Juan Pérez', rol: 'dentista' }}
      />
    )
    expect(screen.getByText(/Dr\. Pérez/)).toBeInTheDocument()
  })

  it('muestra "Dra. [Apellido]" para rol admin con Dra.', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Dra. María González', rol: 'admin' }}
      />
    )
    expect(screen.getByText(/Dra\. González/)).toBeInTheDocument()
  })

  it('muestra solo el primer nombre para rol asistente', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'María López', rol: 'asistente' }}
      />
    )
    expect(screen.getByText(/María/)).toBeInTheDocument()
    expect(screen.queryByText(/Dra\./)).not.toBeInTheDocument()
  })

  it('muestra solo el primer nombre para rol recepcion', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Ana Ruiz', rol: 'recepcion' }}
      />
    )
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
    expect(screen.queryByText(/Dr\./)).not.toBeInTheDocument()
  })

  it('muestra "Asistente Dental" en el subtítulo para rol asistente', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'María López', rol: 'asistente' }}
      />
    )
    expect(screen.getByText('Asistente Dental')).toBeInTheDocument()
  })

  it('muestra "Recepción" en el subtítulo para rol recepcion', () => {
    render(
      <DashboardSaludo
        userProfile={{ nombreCompleto: 'Ana Ruiz', rol: 'recepcion' }}
      />
    )
    expect(screen.getByText('Recepción')).toBeInTheDocument()
  })
})
