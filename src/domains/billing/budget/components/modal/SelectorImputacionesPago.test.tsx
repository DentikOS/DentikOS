import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectorImputacionesPago } from './SelectorImputacionesPago'
import type { PrestacionImputable } from '../../services/imputacionesPagoService'

const prestaciones: PrestacionImputable[] = [
  { id: '00000000-0000-4000-8000-000000000001', nombre: 'Control', valorBruto: 10000,
    montoNeto: 10000, montoImputado: 0, saldoPendiente: 10000, estadoFinanciero: 'pendiente' },
  { id: '00000000-0000-4000-8000-000000000002', nombre: 'Radiografía', valorBruto: 5000,
    montoNeto: 5000, montoImputado: 0, saldoPendiente: 5000, estadoFinanciero: 'pendiente' },
]

describe('SelectorImputacionesPago', () => {
  it('no distribuye automáticamente y calcula el saldo que queda sin asignar', () => {
    const onChange = vi.fn()
    render(<SelectorImputacionesPago prestaciones={prestaciones} maximoImputable={10000} valores={{}} onChange={onChange} />)
    expect(screen.getByTestId('input-imputacion-00000000-0000-4000-8000-000000000001')).toHaveValue(null)
    expect(screen.getByTestId('input-imputacion-00000000-0000-4000-8000-000000000002')).toHaveValue(null)
    expect(screen.getByText('Por asignar: $10.000')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('input-imputacion-00000000-0000-4000-8000-000000000001'), { target: { value: '3000' } })
    expect(onChange).toHaveBeenCalledWith({ '00000000-0000-4000-8000-000000000001': 3000 })
  })
})
