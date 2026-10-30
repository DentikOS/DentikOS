import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TablaPresupuestosGlobales } from './TablaPresupuestosGlobales'
import type { PresupuestoLocal } from '../services/presupuestosStorageService'

const presupuestoBase: PresupuestoLocal = {
  id: '00000000-0000-4000-8000-000000000001',
  folio: 'PRE-001',
  pacienteNombre: 'Paciente de prueba',
  estado: 'aprobado',
  montoTotal: 100000,
  montoAbonado: 0,
  sincronizado: true,
}

const renderTabla = (presupuesto: PresupuestoLocal, onRegistrarPago = vi.fn()) => {
  render(<TablaPresupuestosGlobales
    presupuestos={[presupuesto]}
    onCambiarEstado={vi.fn().mockResolvedValue(true)}
    onVerFichaPaciente={vi.fn()}
    onVerDocumento={vi.fn()}
    onArchivar={vi.fn()}
    onRegistrarPago={onRegistrarPago}
  />)
  return onRegistrarPago
}

describe('Acceso a abonos BP07', () => {
  it('permite el primer abono de un presupuesto aprobado y sincronizado', () => {
    const onRegistrarPago = renderTabla(presupuestoBase)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(onRegistrarPago).toHaveBeenCalledWith(presupuestoBase)
  })

  it('impide registrar pagos antes de sincronizar o cuando no queda saldo', () => {
    const { unmount } = render(<TablaPresupuestosGlobales
      presupuestos={[{ ...presupuestoBase, sincronizado: false }]}
      onCambiarEstado={vi.fn().mockResolvedValue(true)}
      onVerFichaPaciente={vi.fn()}
      onVerDocumento={vi.fn()}
      onArchivar={vi.fn()}
      onRegistrarPago={vi.fn()}
    />)
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
    unmount()
    renderTabla({ ...presupuestoBase, montoAbonado: 100000 })
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument()
  })
})
