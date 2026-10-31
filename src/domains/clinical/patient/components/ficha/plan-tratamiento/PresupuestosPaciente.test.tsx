import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PresupuestosPaciente } from './PresupuestosPaciente'
import { presupuestosStorageService } from '../../../../../billing/budget/services/presupuestosStorageService'
import { pagosService } from '../../../../../billing/budget/services/pagosService'
import { historialPagosPresupuestoService } from '../../../../../billing/budget/services/historialPagosPresupuestoService'
import { getClinicaActivaSync } from '../../../../../../infrastructure/auth/authService'
import { useRBAC } from '../../../../../../shared/hooks/useRBAC'

vi.mock('../../../../../billing/budget/services/presupuestosStorageService', () => ({
  presupuestosStorageService: { obtenerPresupuestos: vi.fn(), sincronizarDesdeSupabase: vi.fn() },
}))
vi.mock('../../../../../billing/budget/services/pagosService', () => ({
  pagosService: { registrarPagoManual: vi.fn() },
}))
vi.mock('../../../../../billing/budget/services/historialPagosPresupuestoService', () => ({
  historialPagosPresupuestoService: { listar: vi.fn() },
}))
vi.mock('../../../../../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: vi.fn(),
}))
vi.mock('../../../../../../shared/hooks/useRBAC', () => ({
  useRBAC: vi.fn(),
}))

const presupuesto = {
  id: '00000000-0000-4000-8000-000000000001', pacienteId: 'pac-1',
  folio: 'PRE-001', estado: 'aprobado', montoTotal: 100000, montoAbonado: 0,
  sincronizado: true, pacienteNombre: 'Paciente uno',
}

describe('Presupuestos del paciente BP07', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getClinicaActivaSync).mockReturnValue('clinica-1')
    vi.mocked(useRBAC).mockReturnValue({ rol: 'recepcion' } as ReturnType<typeof useRBAC>)
    vi.mocked(presupuestosStorageService.obtenerPresupuestos).mockReturnValue([
      presupuesto, { ...presupuesto, id: '00000000-0000-4000-8000-000000000002', pacienteId: 'pac-2', folio: 'PRE-002' },
    ])
    vi.mocked(presupuestosStorageService.sincronizarDesdeSupabase).mockResolvedValue([])
    vi.mocked(pagosService.registrarPagoManual).mockResolvedValue({ exito: true, pagoId: 'pago', montoAbonado: 100000, estado: 'completado' })
    vi.mocked(historialPagosPresupuestoService.listar).mockResolvedValue([])
  })

  it('recepción ve solo presupuestos del paciente y registra su abono', async () => {
    render(<PresupuestosPaciente pacienteId="pac-1" />)
    expect(screen.getByText(/PRE-001/)).toBeInTheDocument()
    expect(screen.queryByText(/PRE-002/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(screen.getByTestId('modal-registrar-pago')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-confirmar-registro-pago'))
    await waitFor(() => expect(pagosService.registrarPagoManual).toHaveBeenCalledWith(expect.objectContaining({
      presupuestoId: presupuesto.id, monto: 100000,
    })))
  })

  it('sin clínica activa no lee presupuestos ni ofrece un pago', () => {
    vi.mocked(getClinicaActivaSync).mockReturnValue(null)
    render(<PresupuestosPaciente pacienteId="pac-1" />)
    expect(presupuestosStorageService.obtenerPresupuestos).not.toHaveBeenCalled()
    expect(presupuestosStorageService.sincronizarDesdeSupabase).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument()
  })

  it('muestra a recepción los abonos del presupuesto seleccionado', async () => {
    vi.mocked(historialPagosPresupuestoService.listar).mockResolvedValue([{
      id: 'pago-1', monto: 25000, metodoPago: 'transferencia', fecha: '2026-10-30', referencia: 'Ref-123',
    }])
    render(<PresupuestosPaciente pacienteId="pac-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver pagos' }))
    await waitFor(() => expect(historialPagosPresupuestoService.listar).toHaveBeenCalledWith(presupuesto.id, 'pac-1'))
    expect(screen.getByRole('region', { name: 'Pagos de PRE-001' })).toHaveTextContent('$25.000 · transferencia · Ref. Ref-123')
  })
})
