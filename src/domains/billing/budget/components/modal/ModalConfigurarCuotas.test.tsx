import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalConfigurarCuotas } from './ModalConfigurarCuotas'

describe('ModalConfigurarCuotas', () => {
  it('respeta el máximo compartido e inicializa la frecuencia configurada', () => {
    render(<ModalConfigurarCuotas
      montoTotal={120000}
      maximoCuotasSinInteres={4}
      frecuenciaInicial="quincenal"
      onConfirmar={vi.fn()}
      onCerrar={vi.fn()}
    />)

    expect(screen.getByRole('button', { name: '3x' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4x' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '6x' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('quincenal')
  })

  it('solo permite pago único cuando la clínica limita las cuotas a una', () => {
    const onConfirmar = vi.fn()
    render(<ModalConfigurarCuotas montoTotal={120000} maximoCuotasSinInteres={1} onConfirmar={onConfirmar} onCerrar={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Cuotas sin interés' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Plan' }))
    expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ modalidad: 'unico', cuotas: 1 }))
  })
})
