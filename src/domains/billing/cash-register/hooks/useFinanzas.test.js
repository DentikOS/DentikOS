import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFinanzas } from './useFinanzas'
import { finanzasStorageService } from '../services/finanzasStorageService'
import { pagosStorageService } from '../../payment/services/pagosStorageService'
import { obtenerAbonosPorPaciente } from '../../payment/services/pagosAbonosLegacyService'
import { calcularBalanceFinanzas } from '../utils/finanzasCalculations'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'

vi.mock('../services/finanzasStorageService', () => ({
  finanzasStorageService: {
    obtenerMovimientos: vi.fn(),
    guardarMovimientos: vi.fn(),
    obtenerConvenios: vi.fn(),
    guardarConvenios: vi.fn()
  }
}))

vi.mock('../../payment/services/pagosStorageService', () => ({
  pagosStorageService: {
    obtenerPagos: vi.fn(),
    sincronizarDesdeSupabase: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('../../payment/services/pagosAbonosLegacyService', () => ({
  obtenerAbonosPorPaciente: vi.fn(),
  eliminarAbono: vi.fn()
}))

vi.mock('../utils/finanzasCalculations', () => ({
  calcularBalanceFinanzas: vi.fn()
}))


describe('useFinanzas', () => {
  const fechaHoy = new Date().toLocaleDateString('es-CL')
  
  const mockMovimientos = [
    { id: 1, fecha: fechaHoy, tipo: 'Ingreso', categoria: 'Efectivo', monto: 10000, metodoPago: 'Efectivo' },
    { id: 2, fecha: fechaHoy, tipo: 'Egreso', categoria: 'Insumos', monto: -5000, metodoPago: 'Transferencia' }
  ]

  const mockConvenios = [
    { id: 1, nombre: 'Fonasa', descuentoDefecto: 15 },
    { id: 2, nombre: 'Isapre', descuentoDefecto: 20 }
  ]

  const mockPagosGlobales = [
    { id: 1, fecha: fechaHoy, monto: 50000, metodoPago: 'Tarjeta', pacienteNombre: 'Juan Pérez' },
    { id: 2, fecha: '10/08/2026', monto: 30000, metodoPago: 'Efectivo', pacienteNombre: 'María López' }
  ]

  const mockPacientes = [
    { id: 1, nombre: 'Ana García' },
    { id: 2, nombre: 'Carlos Ruiz' }
  ]

  // Ids de abonos NO colisionan con ids de pagos globales (reflejo de producción:
  // los abonos de ficha tienen timestamps, los pagos globales tienen otros ids).
  const mockAbonosPaciente1 = [
    { id: 101, fecha: fechaHoy, monto: 20000, metodoPago: 'Efectivo' }
  ]

  const mockAbonosPaciente2 = [
    { id: 102, fecha: fechaHoy, monto: 15000, metodoPago: 'Transferencia' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    finanzasStorageService.obtenerMovimientos.mockReturnValue(mockMovimientos)
    finanzasStorageService.obtenerConvenios.mockReturnValue(mockConvenios)
    finanzasStorageService.guardarMovimientos.mockImplementation(() => {})
    finanzasStorageService.guardarConvenios.mockImplementation(() => {})
    
    pagosStorageService.obtenerPagos.mockReturnValue(mockPagosGlobales)
    pagosStorageService.sincronizarDesdeSupabase.mockResolvedValue([])
    obtenerAbonosPorPaciente.mockImplementation((pacienteId) => {
      if (pacienteId === 1) return mockAbonosPaciente1
      if (pacienteId === 2) return mockAbonosPaciente2
      return []
    })
    
    calcularBalanceFinanzas.mockReturnValue({
      totalIngresos: 95000,
      totalEgresos: -5000,
      balance: 90000
    })
    
  })

  describe('Inicialización', () => {
    it('carga movimientos manuales desde storage', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      expect(finanzasStorageService.obtenerMovimientos).toHaveBeenCalledWith([])
      expect(result.current.movimientos).toBeDefined()
    })

    it('carga convenios desde storage con defaults', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      expect(finanzasStorageService.obtenerConvenios).toHaveBeenCalled()
      expect(result.current.convenios).toEqual(mockConvenios)
    })

    it('inicializa fechaArqueo con fecha de hoy', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      expect(result.current.fechaArqueo).toBe(fechaHoy)
    })

    it('consolida pagos globales y abonos de pacientes al montar', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      // Debe tener: 2 movimientos manuales + 2 pagos globales + 2 abonos
      expect(result.current.movimientos).toHaveLength(6)
    })
  })

  describe('Consolidación de transacciones', () => {
    it('incluye pagos globales en movimientos con origen "Pagos"', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      const pagosGlobalesConsolidados = result.current.movimientos.filter(
        m => m.origen === 'Pagos'
      )
      expect(pagosGlobalesConsolidados).toHaveLength(2)
      expect(pagosGlobalesConsolidados[0].pacienteNombre).toBe('Juan Pérez')
      expect(pagosGlobalesConsolidados[0].monto).toBe(50000)
    })

    it('clasifica las ventas de inventario dentro de los ingresos de caja', () => {
      pagosStorageService.obtenerPagos.mockReturnValue([{
        id: 'venta-1', fecha: fechaHoy, monto: 1190, metodoPago: 'Tarjeta',
        concepto: 'Venta de inventario VTA-001', pacienteNombre: ''
      }])
      const { result } = renderHook(() => useFinanzas(mockPacientes))
      const venta = result.current.movimientos.find((movimiento) => movimiento.id === 'pago_global_venta-1')
      expect(venta).toMatchObject({
        tipo: 'Ingreso', categoria: 'Venta de Inventario', monto: 1190,
        pacienteNombre: 'Venta de inventario', origen: 'Pagos'
      })
    })

    it('refresca la caja al recibir un cambio Realtime de pagos', async () => {
      renderHook(() => useFinanzas(mockPacientes))
      await act(async () => {
        window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.PAGOS_CHANGED))
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(pagosStorageService.sincronizarDesdeSupabase).toHaveBeenCalledOnce()
    })

    it('incluye abonos de pacientes en movimientos con origen "Presupuestos"', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      const abonosConsolidados = result.current.movimientos.filter(
        m => m.origen === 'Presupuestos'
      )
      expect(abonosConsolidados).toHaveLength(2)
      expect(abonosConsolidados[0].pacienteNombre).toBe('Ana García')
      expect(abonosConsolidados[0].monto).toBe(20000)
    })

    it('combina movimientos manuales con cobros de pacientes', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      // Movimientos manuales no tienen campo 'origen'
      const manuales = result.current.movimientos.filter(m => !m.origen)
      expect(manuales).toHaveLength(2)
      expect(manuales[0].categoria).toBe('Efectivo')
    })

    it('maneja errores al cargar pagos globales sin romper', () => {
      pagosStorageService.obtenerPagos.mockImplementation(() => {
        throw new Error('Storage error')
      })

      const { result } = renderHook(() => useFinanzas(mockPacientes))

      // Debe seguir funcionando con movimientos manuales + abonos
      expect(result.current.movimientos).toHaveLength(4)
    })

    it('maneja errores al cargar abonos de un paciente sin romper', () => {
      obtenerAbonosPorPaciente.mockImplementation((pacienteId) => {
        if (pacienteId === 1) throw new Error('Storage error')
        return mockAbonosPaciente2
      })

      const { result } = renderHook(() => useFinanzas(mockPacientes))

      // Debe seguir funcionando: 2 manuales + 2 pagos + 1 abono (paciente 2)
      expect(result.current.movimientos).toHaveLength(5)
    })

    it('excluye abonos cuyo id coincide con un pago global (anti-doble-conteo)', () => {
      // Regla contable: el mismo dinero no puede sumar dos veces
      // (pago global + su abono sincronizado en ficha)
      obtenerAbonosPorPaciente.mockImplementation((pacienteId) => {
        // El paciente 1 tiene un abono con id 1 que colisiona con el pago global id 1
        if (pacienteId === 1) return [{ id: 1, fecha: fechaHoy, monto: 20000 }]
        if (pacienteId === 2) return [{ id: 999, fecha: fechaHoy, monto: 15000 }]
        return []
      })

      const { result } = renderHook(() => useFinanzas(mockPacientes))

      // Solo debe consolidar: 2 manuales + 2 pagos globales + 1 abono (el id 999)
      // El abono con id 1 se excluye porque ya existe el pago global con id 1
      expect(result.current.movimientos).toHaveLength(5)
      const abonosConsolidados = result.current.movimientos.filter(
        m => m.origen === 'Presupuestos'
      )
      expect(abonosConsolidados).toHaveLength(1)
      expect(abonosConsolidados[0].id).toBe('abono_2_999')
    })

    it('excluye pagos purgados de la consolidación (Commit I)', () => {
      pagosStorageService.obtenerPagos.mockReturnValue([
        { id: 1, fecha: fechaHoy, monto: 50000, metodoPago: 'Efectivo', pacienteNombre: 'A', estado: 'Purgado' },
        { id: 2, fecha: fechaHoy, monto: 30000, metodoPago: 'Efectivo', pacienteNombre: 'B', estado: 'Emitido' }
      ])
      const { result } = renderHook(() => useFinanzas(mockPacientes))
      const pagosConsolidados = result.current.movimientos.filter(m => m.origen === 'Pagos')
      expect(pagosConsolidados).toHaveLength(1)
      expect(pagosConsolidados[0].monto).toBe(30000)
    })
  })

  describe('Filtrado por fecha de arqueo', () => {
    it('filtra transacciones por fechaArqueo', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      // Solo transacciones de hoy
      const transaccionesHoy = result.current.transaccionesDiaArqueo
      expect(transaccionesHoy.length).toBeGreaterThan(0)
      transaccionesHoy.forEach(t => {
        expect(t.fecha).toBe(fechaHoy)
      })
    })

    it('actualiza transaccionesDiaArqueo cuando cambia fechaArqueo', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      const _transaccionesHoy = result.current.transaccionesDiaArqueo.length

      act(() => {
        result.current.setFechaArqueo('10/08/2026')
      })

      const transaccionesAyer = result.current.transaccionesDiaArqueo
      expect(transaccionesAyer.length).toBeGreaterThan(0)
      transaccionesAyer.forEach(t => {
        expect(t.fecha).toBe('10/08/2026')
      })
    })

    it('retorna array vacío si no hay transacciones para la fecha', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      act(() => {
        result.current.setFechaArqueo('01/01/2020')
      })

      expect(result.current.transaccionesDiaArqueo).toHaveLength(0)
    })
  })

  describe('Balance global', () => {
    it('calcula balance usando calcularBalanceFinanzas', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      expect(calcularBalanceFinanzas).toHaveBeenCalledWith(result.current.movimientos)
      expect(result.current.balanceGlobal).toEqual({
        totalIngresos: 95000,
        totalEgresos: -5000,
        balance: 90000
      })
    })

    it('recalcula cuando cambian los movimientos', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      const llamadasIniciales = calcularBalanceFinanzas.mock.calls.length

      act(() => {
        result.current.agregarMovimiento({
          id: 100,
          fecha: fechaHoy,
          tipo: 'Ingreso',
          categoria: 'Nuevo',
          monto: 5000
        })
      })

      // Debe haberse llamado al menos una vez más
      expect(calcularBalanceFinanzas.mock.calls.length).toBeGreaterThan(llamadasIniciales)
    })
  })

  describe('agregarMovimiento', () => {
    it('agrega movimiento al inicio del array', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))
      const nuevoMov = { id: 100, fecha: fechaHoy, tipo: 'Ingreso', categoria: 'Nuevo', monto: 5000 }

      act(() => {
        result.current.agregarMovimiento(nuevoMov)
      })

      // Debe estar al inicio de los movimientos manuales (no del consolidado)
      const manualesActualizados = result.current.movimientos.filter(m => !m.origen)
      expect(manualesActualizados[0].id).toBe(100)
    })

    it('persiste movimientos manuales en storage', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))
      const nuevoMov = { id: 100, fecha: fechaHoy, tipo: 'Ingreso', monto: 5000 }

      act(() => {
        result.current.agregarMovimiento(nuevoMov)
      })

      expect(finanzasStorageService.guardarMovimientos).toHaveBeenCalled()
      const savedMovs = finanzasStorageService.guardarMovimientos.mock.calls[0][0]
      expect(savedMovs[0].id).toBe(100)
    })
  })

  describe('actualizarDescuentoConvenio', () => {
    it('actualiza descuento de un convenio específico', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      act(() => {
        result.current.actualizarDescuentoConvenio(1, 25)
      })

      const convenioActualizado = result.current.convenios.find(c => c.id === 1)
      expect(convenioActualizado.descuentoDefecto).toBe(25)
    })

    it('persiste convenios en storage', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      act(() => {
        result.current.actualizarDescuentoConvenio(1, 25)
      })

      expect(finanzasStorageService.guardarConvenios).toHaveBeenCalled()
      const savedConvenios = finanzasStorageService.guardarConvenios.mock.calls[0][0]
      expect(savedConvenios.find(c => c.id === 1).descuentoDefecto).toBe(25)
    })

    it('maneja valores inválidos como 0', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      act(() => {
        result.current.actualizarDescuentoConvenio(1, 'invalid')
      })

      const convenioActualizado = result.current.convenios.find(c => c.id === 1)
      expect(convenioActualizado.descuentoDefecto).toBe(0)
    })

    it('no afecta otros convenios', () => {
      const { result } = renderHook(() => useFinanzas(mockPacientes))

      act(() => {
        result.current.actualizarDescuentoConvenio(1, 25)
      })

      const convenio2 = result.current.convenios.find(c => c.id === 2)
      expect(convenio2.descuentoDefecto).toBe(20)
    })
  })

  describe('Listener de evento storage', () => {
    it('registra listener al montar', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      renderHook(() => useFinanzas(mockPacientes))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
    })

    it('desregistra listener al desmontar', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => useFinanzas(mockPacientes))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      )

      removeEventListenerSpy.mockRestore()
    })
  })
})
