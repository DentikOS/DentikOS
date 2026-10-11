import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalRegistrarPago } from './ModalRegistrarPago'

describe('ModalRegistrarPago (BP07 §19)', () => {
  it('renderiza con saldo pendiente y total de presupuesto', () => {
    render(
      <ModalRegistrarPago
        saldoPendiente={300000}
        totalPresupuesto={600000}
        onRegistrarPago={vi.fn()}
        onCerrar={vi.fn()}
      />
    )

    expect(screen.getByTestId('modal-registrar-pago')).toBeInTheDocument()
    expect(screen.getByText('$300.000')).toBeInTheDocument()
    expect(screen.getByText('$600.000')).toBeInTheDocument()
  })

  it('bloquea cuando el monto excede el saldo pendiente', () => {
    render(
      <ModalRegistrarPago
        saldoPendiente={200000}
        totalPresupuesto={500000}
        onRegistrarPago={vi.fn()}
        onCerrar={vi.fn()}
      />
    )

    const inputMonto = screen.getByTestId('input-monto-pago')
    fireEvent.change(inputMonto, { target: { value: '250000' } })

    expect(screen.getByText(/El monto no puede exceder el saldo pendiente/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-confirmar-registro-pago')).toBeDisabled()
  })

  it('realiza transición a "en_curso" en pago parcial', () => {
    const onRegistrar = vi.fn()
    render(
      <ModalRegistrarPago
        saldoPendiente={400000}
        totalPresupuesto={600000}
        onRegistrarPago={onRegistrar}
        onCerrar={vi.fn()}
      />
    )

    const inputMonto = screen.getByTestId('input-monto-pago')
    fireEvent.change(inputMonto, { target: { value: '150000' } })

    fireEvent.click(screen.getByTestId('btn-confirmar-registro-pago'))

    expect(onRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        monto: 150000,
        nuevoEstado: 'en_curso',
        boletaSii: expect.objectContaining({ emitida: true }),
      })
    )
  })

  it('realiza transición a "completado" cuando se liquida el saldo restante', () => {
    const onRegistrar = vi.fn()
    render(
      <ModalRegistrarPago
        saldoPendiente={400000}
        totalPresupuesto={600000}
        onRegistrarPago={onRegistrar}
        onCerrar={vi.fn()}
      />
    )

    const inputMonto = screen.getByTestId('input-monto-pago')
    fireEvent.change(inputMonto, { target: { value: '400000' } })

    fireEvent.click(screen.getByTestId('btn-confirmar-registro-pago'))

    expect(onRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        monto: 400000,
        nuevoEstado: 'completado',
      })
    )
  })
})
