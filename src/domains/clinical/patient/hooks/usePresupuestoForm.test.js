import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHandleEliminarAbono = vi.fn()

vi.mock('../utils/pacientesCalculations', () => ({
  obtenerDescuentoConvenio: vi.fn((conv) => {
    if (conv === 'Fonasa') return 20
    if (conv === 'Isapre') return 10
    return 0
  })
}))

vi.mock('../../../../domains/organization/prestations/services/prestacionesStorageService', () => ({
  prestacionesStorageService: {
    obtenerPrestaciones: vi.fn(() => [
      { id: 1, nombre: 'Corona', precio: 100000 },
      { id: 2, nombre: 'Limpieza', precio: 30000 }
    ])
  }
}))

vi.mock('../services/pacientesStorageService', () => ({
  pacientesStorageService: {
    guardarItem: vi.fn(),
    obtenerPacientes: vi.fn(() => [])
  }
}))

vi.mock('./useEliminarAbono', () => ({
  useEliminarAbono: () => ({ handleEliminarAbono: mockHandleEliminarAbono })
}))

import { usePresupuestoForm } from './usePresupuestoForm'
import { pacientesStorageService } from '../services/pacientesStorageService'
import { prestacionesStorageService } from '../../../../domains/organization/prestations/services/prestacionesStorageService'
import { obtenerDescuentoConvenio } from '../utils/pacientesCalculations'

describe('usePresupuestoForm (Commit G3)', () => {
  const paciente = { id: 42, nombre: 'Ana', prevision: 'Particular' }

  beforeEach(() => {
    vi.clearAllMocks()
    prestacionesStorageService.obtenerPrestaciones.mockReturnValue([
      { id: 1, nombre: 'Corona', especialidad: 'Endodoncia', precio: 100000 },
      { id: 2, nombre: 'Limpieza', especialidad: 'Preventivo', precio: 30000 }
    ])
  })

  describe('inicialización', () => {
    it('carga arancel desde storage si existe', () => {
      const { result } = renderHook(() => usePresupuestoForm({ paciente }))
      expect(result.current.arancelActualizado).toHaveLength(2)
      expect(result.current.arancelActualizado[0].nombre).toBe('Corona')
    })

    it('usa paciente.prevision como convenio inicial', () => {
      const pacFonasa = { id: 1, nombre: 'Luis', prevision: 'Fonasa' }
      const { result } = renderHook(() => usePresupuestoForm({ paciente: pacFonasa }))
      expect(result.current.convenioAplicado).toBe('Fonasa')
    })

    it('usa Particular como convenio si no hay prevision', () => {
      const { result } = renderHook(() => usePresupuestoForm({ paciente }))
      expect(result.current.convenioAplicado).toBe('Particular')
    })
  })

  describe('handleSeleccionarPrestacion', () => {
    it('aplica descuento de convenio al precio base', () => {
      const pacFonasa = { id: 1, nombre: 'Luis', prevision: 'Fonasa' }
      const { result } = renderHook(() => usePresupuestoForm({ paciente: pacFonasa }))

      act(() => {
        result.current.handleSeleccionarPrestacion(1, 'Fonasa')
      })

      expect(obtenerDescuentoConvenio).toHaveBeenCalledWith('Fonasa', 'Endodoncia')
      // 100000 - 20% = 80000
      expect(result.current.valorPrestacion).toBe(80000)
      expect(result.current.precioBaseOriginal).toBe(100000)
      expect(result.current.porcentajeDescuentoAplicado).toBe(20)
      expect(result.current.nombrePrestacion).toBe('Corona')
    })

    it('Particular no aplica descuento', () => {
      const { result } = renderHook(() => usePresupuestoForm({ paciente }))

      act(() => {
        result.current.handleSeleccionarPrestacion(1, 'Particular')
      })

      expect(result.current.valorPrestacion).toBe(100000)
      expect(result.current.porcentajeDescuentoAplicado).toBe(0)
    })

    it('sin id no cambia el estado', () => {
      const { result } = renderHook(() => usePresupuestoForm({ paciente }))

      act(() => {
        result.current.handleSeleccionarPrestacion('')
      })

      expect(result.current.nombrePrestacion).toBe('')
    })
  })

  describe('handleCambiarConvenioSelect', () => {
    it('recalcula precio al cambiar convenio con prestación seleccionada', () => {
      const { result } = renderHook(() => usePresupuestoForm({ paciente }))

      // Primero seleccionar prestación (Particular, sin descuento)
      act(() => {
        result.current.handleSeleccionarPrestacion(1, 'Particular')
      })
      expect(result.current.valorPrestacion).toBe(100000)

      // Cambiar a Isapre (10% descuento)
      act(() => {
        result.current.handleCambiarConvenioSelect('Isapre')
      })

      expect(result.current.convenioAplicado).toBe('Isapre')
      // 100000 - 10% = 90000
      expect(result.current.valorPrestacion).toBe(90000)
    })
  })

  describe('handleAgregarItemPresupuesto', () => {
    it('agrega item al presupuesto y persiste', () => {
      const setItems = vi.fn()
      const { result } = renderHook(() =>
        usePresupuestoForm({
          paciente,
          itemsPresupuesto: [],
          setItemsPresupuesto: setItems
        })
      )

      act(() => {
        result.current.handleSeleccionarPrestacion(1, 'Particular')
      })

      const fakeEvent = { preventDefault: vi.fn() }
      act(() => {
        result.current.handleAgregarItemPresupuesto(fakeEvent)
      })

      expect(fakeEvent.preventDefault).toHaveBeenCalled()
      expect(setItems).toHaveBeenCalled()
      const nuevos = setItems.mock.calls[0][0]
      expect(nuevos).toHaveLength(1)
      expect(nuevos[0].prestacion).toBe('Corona')
      expect(nuevos[0].valor).toBe(100000)
      expect(nuevos[0].estado).toBe('Pendiente')
      expect(pacientesStorageService.guardarItem).toHaveBeenCalledWith(
        'presupuesto_items_42', nuevos
      )
    })

    it('sin nombre de prestación no agrega nada', () => {
      const setItems = vi.fn()
      const { result } = renderHook(() =>
        usePresupuestoForm({
          paciente,
          itemsPresupuesto: [],
          setItemsPresupuesto: setItems
        })
      )

      const fakeEvent = { preventDefault: vi.fn() }
      act(() => {
        result.current.handleAgregarItemPresupuesto(fakeEvent)
      })

      expect(setItems).not.toHaveBeenCalled()
      expect(pacientesStorageService.guardarItem).not.toHaveBeenCalled()
    })
  })

  describe('handleEliminarItem', () => {
    it('filtra el item eliminado y persiste', () => {
      const setItems = vi.fn()
      const items = [
        { id: 1, prestacion: 'Corona', valor: 100000 },
        { id: 2, prestacion: 'Limpieza', valor: 30000 }
      ]
      const { result } = renderHook(() =>
        usePresupuestoForm({
          paciente,
          itemsPresupuesto: items,
          setItemsPresupuesto: setItems
        })
      )

      act(() => {
        result.current.handleEliminarItem(1)
      })

      expect(setItems).toHaveBeenCalledWith([{ id: 2, prestacion: 'Limpieza', valor: 30000 }])
      expect(pacientesStorageService.guardarItem).toHaveBeenCalledWith(
        'presupuesto_items_42',
        [{ id: 2, prestacion: 'Limpieza', valor: 30000 }]
      )
    })
  })

  describe('handleAgregarAbono', () => {
    it('agrega abono y persiste', () => {
      const setAbonos = vi.fn()
      const { result } = renderHook(() =>
        usePresupuestoForm({
          paciente,
          abonos: [],
          setAbonos
        })
      )

      act(() => {
        result.current.setValorAbono('50000')
      })

      const fakeEvent = { preventDefault: vi.fn() }
      act(() => {
        result.current.handleAgregarAbono(fakeEvent)
      })

      expect(setAbonos).toHaveBeenCalled()
      const nuevos = setAbonos.mock.calls[0][0]
      expect(nuevos).toHaveLength(1)
      expect(nuevos[0].monto).toBe(50000)
      expect(nuevos[0].metodoPago).toBe('Efectivo')
      expect(nuevos[0].pacienteNombre).toBe('Ana')
      expect(pacientesStorageService.guardarItem).toHaveBeenCalledWith(
        'abonos_42', nuevos
      )
    })

    it('sin monto no agrega nada', () => {
      const setAbonos = vi.fn()
      const { result } = renderHook(() =>
        usePresupuestoForm({
          paciente,
          abonos: [],
          setAbonos
        })
      )

      const fakeEvent = { preventDefault: vi.fn() }
      act(() => {
        result.current.handleAgregarAbono(fakeEvent)
      })

      expect(setAbonos).not.toHaveBeenCalled()
      expect(pacientesStorageService.guardarItem).not.toHaveBeenCalled()
    })
  })

  describe('integración con useEliminarAbono', () => {
    it('re-expone handleEliminarAbono del hook', () => {
      const { result } = renderHook(() => usePresupuestoForm({ paciente }))
      expect(result.current.handleEliminarAbono).toBe(mockHandleEliminarAbono)
    })
  })
})
