import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted: mocks estables entre el hook y el test (misma referencia)
const { mockAlert, mockConfirm } = vi.hoisted(() => ({
  mockAlert: vi.fn(() => Promise.resolve()),
  mockConfirm: vi.fn(() => Promise.resolve(true))
}))

vi.mock('../services/pagosStorageService', () => ({
  pagosStorageService: {
    obtenerPagos: vi.fn(() => []),
    guardarPagos: vi.fn(),
    registrarPago: vi.fn(),
    purgarPago: vi.fn(() => true),
    obtenerPagosParaAuditoria: vi.fn(() => [])
  }
}))

vi.mock('../services/pagosAbonosLegacyService', () => ({
  sincronizarAbonoConFichaPaciente: vi.fn(),
  removerAbonoDeFichaPaciente: vi.fn(() => true)
}))

vi.mock('../services/pagosExportService', () => ({
  exportarAuditoriaPagosXLSX: vi.fn(() => Promise.resolve({ ok: true, total: 2, nombreArchivo: 'test.xlsx' }))
}))

vi.mock('../../../../shared/hooks/useAppDialog', () => ({
  useAppDialog: () => ({
    confirm: mockConfirm,
    alert: mockAlert
  })
}))

vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: (selector) => selector({
    userProfile: { email: 'admin@test.com', rol: 'admin' }
  })
}))

import { usePagos } from './usePagos'
import { pagosStorageService } from '../services/pagosStorageService'
import { sincronizarAbonoConFichaPaciente, removerAbonoDeFichaPaciente } from '../services/pagosAbonosLegacyService'
import { exportarAuditoriaPagosXLSX } from '../services/pagosExportService'

describe('usePagos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pagosStorageService.purgarPago.mockReturnValue(true)
  })

  describe('purgarPago', () => {
    it('purga pago con motivo válido y muestra success', async () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, folioComprobante: 'REC-001', estado: 'Anulado', monto: 50000 }
      ])
      const { result } = renderHook(() => usePagos())

      let ok
      await act(async () => {
        ok = await result.current.purgarPago(1, 'Error del cajero, pago duplicado')
      })

      expect(ok).toBe(true)
      expect(pagosStorageService.purgarPago).toHaveBeenCalledWith(
        1,
        'Error del cajero, pago duplicado',
        'admin@test.com'
      )
      expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
    })

    it('rechaza purga con motivo muy corto', async () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, folioComprobante: 'REC-001', estado: 'Anulado' }
      ])
      const { result } = renderHook(() => usePagos())

      let ok
      await act(async () => {
        ok = await result.current.purgarPago(1, 'corto')
      })

      expect(ok).toBe(false)
      expect(pagosStorageService.purgarPago).not.toHaveBeenCalled()
      expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning' }))
    })

    it('muestra error si el pago no existe en storage', async () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, folioComprobante: 'REC-001', estado: 'Anulado' }
      ])
      pagosStorageService.purgarPago.mockReturnValue(false)
      const { result } = renderHook(() => usePagos())

      let ok
      await act(async () => {
        ok = await result.current.purgarPago(999, 'Motivo válido para purgar pago')
      })

      expect(ok).toBe(false)
      expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    })
  })

  describe('confirmación de pagos en efectivo', () => {
    const pagoEfectivo = { id: 'local-id', folioComprobante: 'REC-EF-1', pacienteId: 'patient-1', pacienteNombre: 'Ana', monto: 25000, metodoPago: 'Efectivo' }

    it('no publica ni vincula un pago si Supabase no lo confirmó', async () => {
      pagosStorageService.registrarPago.mockResolvedValue(null)
      const { result } = renderHook(() => usePagos())
      let ok

      await act(async () => { ok = await result.current.agregarOActualizarPago(pagoEfectivo) })

      expect(ok).toBe(false)
      expect(result.current.todosLosPagos).toEqual([])
      expect(pagosStorageService.guardarPagos).not.toHaveBeenCalled()
      expect(sincronizarAbonoConFichaPaciente).not.toHaveBeenCalled()
    })

    it('publica y vincula el pago después de la confirmación del servidor', async () => {
      pagosStorageService.registrarPago.mockResolvedValue({ ...pagoEfectivo, id: 'server-id', sincronizado: true })
      const { result } = renderHook(() => usePagos())
      let ok

      await act(async () => { ok = await result.current.agregarOActualizarPago(pagoEfectivo) })

      expect(ok).toBe(true)
      expect(result.current.todosLosPagos[0]).toMatchObject({ id: 'server-id', sincronizado: true })
      expect(pagosStorageService.guardarPagos).not.toHaveBeenCalled()
      expect(sincronizarAbonoConFichaPaciente).toHaveBeenCalledWith('patient-1', expect.objectContaining({ id: 'server-id' }))
    })
  })

  describe('exportarAuditoria', () => {
    it('exporta CSV con todos los pagos (vigentes + anulados)', async () => {
      pagosStorageService.obtenerPagosParaAuditoria.mockReturnValue([
        { id: 1, estado: 'Emitido' },
        { id: 2, estado: 'Anulado' }
      ])
      const { result } = renderHook(() => usePagos())

      await act(async () => {
        await result.current.exportarAuditoria()
      })

      expect(exportarAuditoriaPagosXLSX).toHaveBeenCalledWith([
        { id: 1, estado: 'Emitido' },
        { id: 2, estado: 'Anulado' }
      ])
      expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
    })

    it('muestra error si la exportación falla', async () => {
      exportarAuditoriaPagosXLSX.mockReturnValueOnce(Promise.resolve({ ok: false, total: 0, nombreArchivo: '' }))
      const { result } = renderHook(() => usePagos())

      await act(async () => {
        await result.current.exportarAuditoria()
      })

      expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    })
  })

  describe('propagación a Plan de Tratamiento (Commit C)', () => {
    it('anularPago remueve abono de la ficha del paciente', async () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, folioComprobante: 'REC-001', estado: 'Emitido', pacienteId: 42, monto: 50000, metodoPago: 'Efectivo', pacienteNombre: 'Test', pacienteRut: '1-1' }
      ])
      const { result } = renderHook(() => usePagos())

      await act(async () => {
        await result.current.anularPago(1, 'Error de caja')
      })

      expect(removerAbonoDeFichaPaciente).toHaveBeenCalledWith(42, 1)
    })

    it('purgarPago remueve abono de la ficha del paciente', async () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, folioComprobante: 'REC-001', estado: 'Anulado', pacienteId: 42, monto: 50000 }
      ])
      const { result } = renderHook(() => usePagos())

      await act(async () => {
        await result.current.purgarPago(1, 'Motivo válido para purgar este pago')
      })

      expect(removerAbonoDeFichaPaciente).toHaveBeenCalledWith(42, 1)
    })

    it('anularPago no falla si el pago no tiene pacienteId', async () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, folioComprobante: 'REC-001', estado: 'Emitido', monto: 50000, metodoPago: 'Efectivo', pacienteNombre: 'Test', pacienteRut: '1-1' }
      ])
      const { result } = renderHook(() => usePagos())

      await act(async () => {
        await result.current.anularPago(1, 'Error de caja')
      })

      expect(removerAbonoDeFichaPaciente).not.toHaveBeenCalled()
    })
  })

  describe('todosLosPagos', () => {
    it('expone todosLosPagos sin filtrar', () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, estado: 'Emitido', metodoPago: 'Efectivo', folioComprobante: 'R1', pacienteNombre: 'A', pacienteRut: '1-1' },
        { id: 2, estado: 'Anulado', metodoPago: 'Efectivo', folioComprobante: 'R2', pacienteNombre: 'B', pacienteRut: '2-2' }
      ])
      const { result } = renderHook(() => usePagos())
      expect(result.current.todosLosPagos).toHaveLength(2)
    })
  })

  describe('robustez de datos (Commit E)', () => {
    it('pagosFiltrados no crashea con pagos sin folioComprobante ni pacienteRut', () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, estado: 'Emitido', metodoPago: 'Efectivo', pacienteNombre: 'Ana García' }
      ])
      const { result } = renderHook(() => usePagos())

      // Buscar por nombre funciona aunque falten folio y RUT
      act(() => { result.current.setBusqueda('ana') })
      expect(result.current.pagos).toHaveLength(1)

      // Buscar por folio no crashea aunque el campo no exista
      act(() => { result.current.setBusqueda('REC-2026') })
      expect(result.current.pagos).toHaveLength(0)
    })

    it('agregarOActualizarPago rechaza pago sin folioComprobante', () => {
      pagosStorageService.obtenerPagos.mockReturnValue([])
      const { result } = renderHook(() => usePagos())

      let ok
      act(() => {
        ok = result.current.agregarOActualizarPago({ id: 1, pacienteNombre: 'Ana' })
      })

      expect(ok).toBe(false)
      expect(pagosStorageService.guardarPagos).not.toHaveBeenCalled()
      expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    })

    it('agregarOActualizarPago rechaza pago sin pacienteNombre', () => {
      pagosStorageService.obtenerPagos.mockReturnValue([])
      const { result } = renderHook(() => usePagos())

      let ok
      act(() => {
        ok = result.current.agregarOActualizarPago({ id: 1, folioComprobante: 'REC-1' })
      })

      expect(ok).toBe(false)
      expect(pagosStorageService.guardarPagos).not.toHaveBeenCalled()
    })
  })

  describe('estado Purgado (Commit H)', () => {
    it('purgarPago recarga el estado desde storage (Commit K4)', async () => {
      const pagoAnulado = { id: 1, folioComprobante: 'REC-001', estado: 'Anulado', metodoPago: 'Efectivo', pacienteNombre: 'A', pacienteRut: '1-1', monto: 50000 }
      const pagoPurgado = { ...pagoAnulado, estado: 'Purgado' }
      
      pagosStorageService.obtenerPagos.mockReturnValueOnce([pagoAnulado])
      pagosStorageService.obtenerPagos.mockReturnValueOnce([pagoPurgado])
      pagosStorageService.purgarPago.mockResolvedValue(true)

      const { result } = renderHook(() => usePagos())
      expect(result.current.todosLosPagos[0].estado).toBe('Anulado')

      await act(async () => {
        await result.current.purgarPago(1, 'Motivo válido de purga aquí')
      })

      expect(pagosStorageService.purgarPago).toHaveBeenCalledWith(
        1, 
        'Motivo válido de purga aquí',
        expect.any(String)
      )
      expect(result.current.todosLosPagos[0].estado).toBe('Purgado')
    })

    it('oculta pagos purgados por defecto en pagosFiltrados', () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, estado: 'Purgado', metodoPago: 'Efectivo', folioComprobante: 'R1', pacienteNombre: 'A', pacienteRut: '1-1' },
        { id: 2, estado: 'Emitido', metodoPago: 'Efectivo', folioComprobante: 'R2', pacienteNombre: 'B', pacienteRut: '2-2' }
      ])
      const { result } = renderHook(() => usePagos())
      expect(result.current.pagos).toHaveLength(1)

      act(() => { result.current.setMostrarPurgados(true) })
      expect(result.current.pagos).toHaveLength(2)

      act(() => { result.current.setMostrarPurgados(false) })
      expect(result.current.pagos).toHaveLength(1)
    })

    it('purgarPago deja metadata completa en el estado local sin recargar (Commit K4)', async () => {
      let storage = [
        { id: 1, folioComprobante: 'REC-001', estado: 'Anulado', metodoPago: 'Efectivo', pacienteNombre: 'A', pacienteRut: '1-1', monto: 100 }
      ]
      pagosStorageService.obtenerPagos.mockImplementation(() => storage)
      pagosStorageService.purgarPago.mockImplementation(async () => {
        storage = [{ ...storage[0], estado: 'Purgado', fechaPurga: '13/09/2026', motivoPurga: 'Motivo largo de prueba', purgadoPor: 'admin@x.cl' }]
        return true
      })

      const { result } = renderHook(() => usePagos())
      expect(result.current.todosLosPagos[0].fechaPurga).toBeUndefined()

      await act(async () => {
        await result.current.purgarPago(1, 'Motivo largo de prueba')
      })

      expect(result.current.todosLosPagos[0].estado).toBe('Purgado')
      expect(result.current.todosLosPagos[0].fechaPurga).toBe('13/09/2026')
      expect(result.current.todosLosPagos[0].motivoPurga).toBe('Motivo largo de prueba')
      expect(result.current.todosLosPagos[0].purgadoPor).toBe('admin@x.cl')
    })

    it('resumen excluye pagos purgados del total recaudado (Commit I)', () => {
      const hoy = new Date().toLocaleDateString('es-CL')
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, estado: 'Purgado', monto: 50000, metodoPago: 'Efectivo', folioComprobante: 'R1', pacienteNombre: 'A', pacienteRut: '1-1', fecha: hoy },
        { id: 2, estado: 'Emitido', monto: 30000, metodoPago: 'Efectivo', folioComprobante: 'R2', pacienteNombre: 'B', pacienteRut: '2-2', fecha: hoy }
      ])
      const { result } = renderHook(() => usePagos())
      expect(result.current.resumen.totalRecaudado).toBe(30000)
      expect(result.current.resumen.totalTransacciones).toBe(1)
    })
  })
})
