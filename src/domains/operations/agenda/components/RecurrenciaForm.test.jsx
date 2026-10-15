import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { RecurrenciaForm } from './RecurrenciaForm'

describe('RecurrenciaForm (BP05 §07)', () => {
  const defaultProps = {
    recurrencia: 'ninguna',
    setRecurrencia: vi.fn(),
    frecuencia: 1,
    setFrecuencia: vi.fn(),
    diaSemana: 1,
    setDiaSemana: vi.fn(),
    diaMes: 1,
    setDiaMes: vi.fn(),
    fechaFin: '',
    setFechaFin: vi.fn(),
    numInstancias: 4,
    setNumInstancias: vi.fn(),
    proximasCitas: [],
  }

  it('muestra los 5 patrones oficiales de recurrencia (BP05 §07)', () => {
    render(<RecurrenciaForm {...defaultProps} />)

    expect(screen.getByText('Diario (cada día)')).toBeInTheDocument()
    expect(screen.getByText('Semanal')).toBeInTheDocument()
    expect(screen.getByText('Quincenal (cada 2 semanas)')).toBeInTheDocument()
    expect(screen.getByText('Mensual')).toBeInTheDocument()
    expect(screen.getByText('Personalizado (cada X días)')).toBeInTheDocument()
  })

  it('permite maximo 100 citas por serie', () => {
    render(<RecurrenciaForm {...defaultProps} recurrencia="semanal" />)

    const input = screen.getByLabelText(/Cuántas citas generar/i)
    expect(input).toHaveAttribute('max', '100')
  })

  it('muestra selector de dia de semana para semanal y quincenal', () => {
    const { rerender } = render(<RecurrenciaForm {...defaultProps} recurrencia="semanal" />)
    expect(screen.getByLabelText('Día de la semana')).toBeInTheDocument()

    rerender(<RecurrenciaForm {...defaultProps} recurrencia="quincenal" />)
    expect(screen.getByLabelText('Día de la semana')).toBeInTheDocument()

    rerender(<RecurrenciaForm {...defaultProps} recurrencia="diario" />)
    expect(screen.queryByLabelText('Día de la semana')).not.toBeInTheDocument()
  })
})
