import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Periodontograma } from './Periodontograma'

describe('Periodontograma EPB (BP06)', () => {
  it('renderiza los 6 sextantes clínicos y cuadro de observaciones', () => {
    render(<Periodontograma />)
    expect(screen.getByTestId('periodontograma-bp06')).toBeInTheDocument()
    expect(screen.getByTestId('card-sextante-S1')).toBeInTheDocument()
    expect(screen.getByTestId('card-sextante-S2')).toBeInTheDocument()
    expect(screen.getByTestId('card-sextante-S3')).toBeInTheDocument()
    expect(screen.getByTestId('card-sextante-S4')).toBeInTheDocument()
    expect(screen.getByTestId('card-sextante-S5')).toBeInTheDocument()
    expect(screen.getByTestId('card-sextante-S6')).toBeInTheDocument()
    expect(screen.getByTestId('textarea-epb-observaciones')).toBeInTheDocument()
  })

  it('permite cambiar el código de un sextante a 4 y *', () => {
    render(<Periodontograma />)
    const btnCod4 = screen.getByTestId('btn-codigo-S1-4')
    fireEvent.click(btnCod4)
    expect(screen.getByTestId('card-sextante-S1')).toHaveTextContent('Cód. 4')

    const btnCodFurca = screen.getByTestId('btn-codigo-S1-*')
    fireEvent.click(btnCodFurca)
    expect(screen.getByTestId('card-sextante-S1')).toHaveTextContent('Cód. *')
  })

  it('permite ingresar observaciones y disparar onGuardar', () => {
    const onGuardar = vi.fn()
    render(<Periodontograma onGuardar={onGuardar} />)

    const textarea = screen.getByTestId('textarea-epb-observaciones')
    fireEvent.change(textarea, { target: { value: 'Furcación pieza 1.6' } })
    expect(textarea).toHaveValue('Furcación pieza 1.6')

    const btnGuardar = screen.getByTestId('btn-guardar-epb')
    fireEvent.click(btnGuardar)
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        observaciones: 'Furcación pieza 1.6',
      })
    )
  })
})
