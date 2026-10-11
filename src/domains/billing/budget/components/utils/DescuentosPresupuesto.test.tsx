import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DescuentosPresupuesto } from './DescuentosPresupuesto'

describe('DescuentosPresupuesto BP07', () => {
  it('renderiza selector de convenios de salud por defecto', () => {
    render(<DescuentosPresupuesto totalBruto={100000} onAplicarDescuento={vi.fn()} />)
    expect(screen.getByTestId('descuentos-presupuesto-modulo')).toBeInTheDocument()
    expect(screen.getByText(/ISAPRE Banmédica/i)).toBeInTheDocument()
  })

  it('exige motivo y autorización para aplicar el descuento', () => {
    const onAplicar = vi.fn()
    render(<DescuentosPresupuesto totalBruto={100000} onAplicarDescuento={onAplicar} />)

    fireEvent.click(screen.getByText(/Aplicar Descuento/i))
    expect(onAplicar).not.toHaveBeenCalled()
    expect(screen.getByText(/El motivo del descuento es obligatorio/i)).toBeInTheDocument()
  })

  it('calcula y aplica correctamente el descuento por porcentaje global', () => {
    const onAplicar = vi.fn()
    render(<DescuentosPresupuesto totalBruto={100000} onAplicarDescuento={onAplicar} />)

    // Cambiar a porcentaje
    fireEvent.click(screen.getByText('Porcentaje (%)'))

    // Llenar motivo y autorizador
    const inputMotivo = screen.getByPlaceholderText(/Plan familiar/i)
    const inputAutorizado = screen.getByPlaceholderText(/Director Médico/i)
    fireEvent.change(inputMotivo, { target: { value: 'Campaña Primavera' } })
    fireEvent.change(inputAutorizado, { target: { value: 'Dra. Soto' } })

    fireEvent.click(screen.getByText(/Aplicar Descuento/i))
    expect(onAplicar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'global',
        motivo: 'Campaña Primavera',
        autorizadoPor: 'Dra. Soto',
      }),
      10000 // 10% de 100.000
    )
  })
})
