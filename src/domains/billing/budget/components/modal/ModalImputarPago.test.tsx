import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalImputarPago } from './ModalImputarPago'
import type { ImputacionRegistrada, PagoImputable, PrestacionImputable } from '../../services/imputacionesPagoService'

const pago: PagoImputable = {
  id: '00000000-0000-4000-8000-000000000001', monto: 5000, metodoPago: 'efectivo',
  fecha: '2026-11-04', referencia: null, montoImputado: 1000, montoSinImputar: 4000,
}
const prestacion: PrestacionImputable = {
  id: '00000000-0000-4000-8000-000000000002', nombre: 'Control', valorBruto: 5000,
  montoNeto: 5000, montoImputado: 1000, saldoPendiente: 4000, estadoFinanciero: 'parcial',
}
const imputacion: ImputacionRegistrada = {
  id: '00000000-0000-4000-8000-000000000003', pagoId: pago.id, itemId: prestacion.id,
  itemNombre: 'Control', monto: 1000, montoRevertido: 0, montoVigente: 1000,
  actorUserId: '00000000-0000-4000-8000-000000000004', createdAt: '2026-11-04T12:00:00Z', reversiones: [],
}

describe('ModalImputarPago', () => {
  it('imputa solo el monto que se asigna manualmente', async () => {
    const onImputar = vi.fn().mockResolvedValue(true)
    render(<ModalImputarPago pago={pago} prestaciones={[prestacion]} imputaciones={[]}
      onImputar={onImputar} onRevertir={vi.fn()} onCerrar={vi.fn()} />)
    fireEvent.change(screen.getByTestId(`input-imputacion-${prestacion.id}`), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /Asignar\sCLP\s2\.000/ }))
    await waitFor(() => expect(onImputar).toHaveBeenCalledWith(pago.id, [{ itemId: prestacion.id, monto: 2000 }]))
  })

  it('requiere motivo para revertir una imputación', async () => {
    const onRevertir = vi.fn().mockResolvedValue(true)
    render(<ModalImputarPago pago={pago} prestaciones={[prestacion]} imputaciones={[imputacion]}
      onImputar={vi.fn()} onRevertir={onRevertir} onCerrar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Corregir' }))
    fireEvent.change(screen.getByLabelText('Motivo de la corrección'), { target: { value: 'Prestación incorrecta' } })
    fireEvent.click(screen.getByRole('button', { name: /Revertir\sCLP\s1\.000/ }))
    await waitFor(() => expect(onRevertir).toHaveBeenCalledWith(imputacion.id, 'Prestación incorrecta'))
  })
})
