import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEstadosPresupuesto } from './useEstadosPresupuesto'
import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'
import { generarHashForense, generarPayloadQRVerificacion } from '../utils/esteganografia'
import type { Presupuesto } from '../schemas/presupuestoSchema'

const mockPresupuesto: Presupuesto = {
  id: 'pres-1',
  folio: 'P-001',
  pacienteNombre: 'Camila Reyes',
  pacienteRut: '18.901.234-5',
  estado: 'borrador',
  totalAPagar: 200000,
  montoAbonado: 0,
}

describe('useEstadosPresupuesto & Esteganografía (BP07)', () => {
  beforeEach(() => {
    usePresupuestosStore.setState({
      presupuestos: [mockPresupuesto],
      presupuestoActivo: mockPresupuesto,
    })
  })

  it('verifica transiciones de estado válidas e inválidas', () => {
    const { result } = renderHook(() => useEstadosPresupuesto())
    expect(result.current.puedeTransicionar('borrador', 'enviado')).toBe(true)
    expect(result.current.puedeTransicionar('borrador', 'completado')).toBe(false)
    expect(result.current.puedeTransicionar('en-curso', 'completado')).toBe(true)
  })

  it('transiciona estados: borrador -> enviado -> aprobado', () => {
    const { result } = renderHook(() => useEstadosPresupuesto())

    act(() => {
      result.current.enviarPresupuesto(mockPresupuesto)
    })
    expect(usePresupuestosStore.getState().presupuestos[0].estado).toBe('enviado')

    act(() => {
      result.current.aprobarPresupuesto(mockPresupuesto)
    })
    expect(usePresupuestosStore.getState().presupuestos[0].estado).toBe('aprobado')
  })

  it('procesa pago y transiciona a completado automáticamente al saldar', () => {
    const { result } = renderHook(() => useEstadosPresupuesto())

    act(() => {
      result.current.procesarPagoAutomatico(mockPresupuesto, 200000)
    })

    const p = usePresupuestosStore.getState().presupuestos[0]
    expect(p.montoAbonado).toBe(200000)
    expect(p.estado).toBe('completado')
  })

  it('procesa pago parcial y transiciona a en-curso', () => {
    const { result } = renderHook(() => useEstadosPresupuesto())
    act(() => {
      result.current.procesarPagoAutomatico(mockPresupuesto, 50000)
    })
    const p = usePresupuestosStore.getState().presupuestos[0]
    expect(p.montoAbonado).toBe(50000)
    expect(p.estado).toBe('en-curso')
  })

  it('marca presupuestos enviados como vencidos al pasar fecha de validez', () => {
    const pVencido: Presupuesto = {
      ...mockPresupuesto,
      id: 'pres-vencido',
      estado: 'enviado',
      fechaVencimiento: new Date(Date.now() - 86400000).toISOString(),
    }
    usePresupuestosStore.setState({ presupuestos: [pVencido] })

    const { result } = renderHook(() => useEstadosPresupuesto())
    act(() => {
      result.current.verificarYMarcarVencidos()
    })
    expect(usePresupuestosStore.getState().presupuestos[0].estado).toBe('vencido')
  })

  it('genera hash y payload de esteganografía forense', () => {
    const hash = generarHashForense({
      documentoId: 'P-001',
      pacienteRut: '18.901.234-5',
      montoTotal: 200000,
      timestamp: '2026-10-10T00:00:00Z',
    })
    expect(hash).toMatch(/^SEC-STEG-[A-F0-9]+$/)

    const qr = generarPayloadQRVerificacion({
      documentoId: 'P-001',
      pacienteRut: '18.901.234-5',
      montoTotal: 200000,
    })
    expect(qr).toContain('studio-dental.app/verify')
    expect(qr).toContain('doc=P-001')
  })
})
