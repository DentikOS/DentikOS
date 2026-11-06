import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PresupuestosPaciente } from './PresupuestosPaciente'
import { presupuestosStorageService } from '../../../../../billing/budget/services/presupuestosStorageService'
import { pagosService } from '../../../../../billing/budget/services/pagosService'
import { historialPagosPresupuestoService } from '../../../../../billing/budget/services/historialPagosPresupuestoService'
import { imputacionesPagoService } from '../../../../../billing/budget/services/imputacionesPagoService'
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
vi.mock('../../../../../billing/budget/services/imputacionesPagoService', () => ({
  imputacionesPagoService: { listar: vi.fn(), imputar: vi.fn(), revertir: vi.fn() },
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
const snapshot = {
  presupuestoId: presupuesto.id,
  items: [{ id: '00000000-0000-4000-8000-000000000011', nombre: 'Control', valorBruto: 100000,
    montoNeto: 100000, montoImputado: 0, saldoPendiente: 100000, estadoFinanciero: 'pendiente' as const }],
  pagos: [{ id: '00000000-0000-4000-8000-000000000021', monto: 25000, metodoPago: 'transferencia',
    fecha: '2026-10-30', referencia: 'Ref-123', montoImputado: 0, montoSinImputar: 25000 }],
  imputaciones: [],
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
    vi.mocked(historialPagosPresupuestoService.listar).mockResolvedValue([{
      id: snapshot.pagos[0].id, monto: 25000, metodoPago: 'transferencia', fecha: '2026-10-30', referencia: 'Ref-123',
    }])
    vi.mocked(imputacionesPagoService.listar).mockResolvedValue(snapshot)
  })

  it('recepción ve solo presupuestos del paciente y registra su abono', async () => {
    render(<PresupuestosPaciente pacienteId="pac-1" />)
    expect(screen.getByText(/PRE-001/)).toBeInTheDocument()
    expect(screen.queryByText(/PRE-002/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(screen.getByTestId('modal-registrar-pago')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('btn-confirmar-registro-pago')).not.toBeDisabled())
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

  it('muestra la distribución del abono y permite asignarlo a prestaciones', async () => {
    render(<PresupuestosPaciente pacienteId="pac-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver pagos' }))
    await waitFor(() => expect(imputacionesPagoService.listar).toHaveBeenCalledWith(presupuesto.id))
    expect(screen.getByRole('region', { name: 'Pagos de PRE-001' })).toHaveTextContent(/Asignado CLP\s*0 · Sin asignar CLP\s*25\.000/)
    fireEvent.click(screen.getByRole('button', { name: 'Asignar o corregir' }))
    expect(screen.getByTestId('modal-imputar-pago')).toBeInTheDocument()
    expect(screen.getByText(/Control · Pendiente/)).toBeInTheDocument()
  })

  it('mantiene el historial de pagos si falla el cálculo de imputaciones', async () => {
    vi.mocked(imputacionesPagoService.listar).mockRejectedValue(new Error('Importes requieren revisión'))
    render(<PresupuestosPaciente pacienteId="pac-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver pagos' }))
    expect(await screen.findByText(/Se muestran los abonos, pero no se pudieron calcular saldos/)).toBeInTheDocument()
    expect(screen.getByText(/CLP\s*25\.000 · transferencia/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar o corregir' })).not.toBeInTheDocument()
  })
})
