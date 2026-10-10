import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PlanPago } from './PlanPago'

describe('PlanPago BP07', () => {
  it('renderiza simulador de cuotas por defecto', () => {
    render(<PlanPago totalAPagar={600000} onConfirmarPlan={vi.fn()} />)
    expect(screen.getByTestId('plan-pago-modulo')).toBeInTheDocument()
    expect(screen.getByText('Cuotas Sin Interés')).toBeInTheDocument()
    expect(screen.getByText('$100.000 / mes')).toBeInTheDocument() // 600.000 / 6
  })

  it('permite cambiar a pago único', () => {
    const onConfirmar = vi.fn()
    render(<PlanPago totalAPagar={600000} onConfirmarPlan={onConfirmar} />)

    fireEvent.click(screen.getByTestId('btn-pago-unico'))
    fireEvent.click(screen.getByText('Confirmar Plan de Pagos'))

    expect(onConfirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        modalidad: 'pago-unico',
        valorCuota: 600000,
        numeroCuotas: 1,
      })
    )
  })

  it('calcula calendario de cuotas para 12 cuotas', () => {
    const onConfirmar = vi.fn()
    render(<PlanPago totalAPagar={1200000} onConfirmarPlan={onConfirmar} />)

    fireEvent.click(screen.getByText('12 cuotas'))
    fireEvent.click(screen.getByText('Confirmar Plan de Pagos'))

    expect(onConfirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        modalidad: 'cuotas-sin-interes',
        numeroCuotas: 12,
        valorCuota: 100000,
      })
    )
  })
})
