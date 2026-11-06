import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalRegistrarPago } from './ModalRegistrarPago'
import { imputacionesPagoService } from '../../services/imputacionesPagoService'

vi.mock('../../services/imputacionesPagoService', () => ({
  imputacionesPagoService: { listar: vi.fn() },
}))

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
    expect(screen.getAllByText(/CLP\s300\.000/)).toHaveLength(2)
    expect(screen.getByText(/CLP\s600\.000/)).toBeInTheDocument()
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

  it('envía solo las prestaciones que el usuario asigna de forma explícita', async () => {
    const itemId = '00000000-0000-4000-8000-000000000001'
    vi.mocked(imputacionesPagoService.listar).mockResolvedValue({
      presupuestoId: '00000000-0000-4000-8000-000000000099',
      items: [{ id: itemId, nombre: 'Control', valorBruto: 40000, montoNeto: 40000,
        montoImputado: 0, saldoPendiente: 40000, estadoFinanciero: 'pendiente' }],
      pagos: [], imputaciones: [],
    })
    const onRegistrar = vi.fn()
    render(
      <ModalRegistrarPago
        presupuestoId="00000000-0000-4000-8000-000000000099"
        saldoPendiente={60000}
        totalPresupuesto={60000}
        onRegistrarPago={onRegistrar}
        onCerrar={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByTestId(`input-imputacion-${itemId}`)).toBeInTheDocument())
    fireEvent.change(screen.getByTestId(`input-imputacion-${itemId}`), { target: { value: '25000' } })
    fireEvent.click(screen.getByTestId('btn-confirmar-registro-pago'))
    await waitFor(() => expect(onRegistrar).toHaveBeenCalledWith(expect.objectContaining({
      imputaciones: [{ itemId, monto: 25000 }],
    })))
  })
})
