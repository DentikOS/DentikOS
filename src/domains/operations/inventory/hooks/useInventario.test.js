import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInventario } from './useInventario'
import { inventarioStorageService } from '../services/inventarioStorageService'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: false }))

vi.mock('../services/inventarioStorageService', () => ({
  inventarioStorageService: {
    obtenerItems: vi.fn(),
    guardarItems: vi.fn()
  }
}))

describe('useInventario', () => {
  const mockItems = [
    { id: 1, nombre: 'Resina A2', categoria: 'Restauración', cantidad: 5, proveedor: 'DentalSupply' },
    { id: 2, nombre: 'Guantes', categoria: 'EPP', cantidad: 10, proveedor: 'MedSupply' },
    { id: 3, nombre: 'Anestesia', categoria: 'Insumos', cantidad: 20, proveedor: 'DentalSupply' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    inventarioStorageService.obtenerItems.mockReturnValue(mockItems)
    inventarioStorageService.guardarItems.mockImplementation(() => {})
  })

  describe('Inicialización', () => {
    it('carga items desde storage al iniciar', () => {
      const { result } = renderHook(() => useInventario())

      expect(inventarioStorageService.obtenerItems).toHaveBeenCalled()
      expect(result.current.items).toEqual(mockItems)
    })

    it('inicializa filtros con valores por defecto', () => {
      const { result } = renderHook(() => useInventario())

      expect(result.current.busqueda).toBe('')
      expect(result.current.categoriaFiltro).toBe('Todas')
    })

    it('calcula resumen basado en items iniciales', () => {
     const { result } = renderHook(() => useInventario())

     expect(result.current.resumen).toBeDefined()
     expect(result.current.resumen.totalInsumos).toBe(3)
     expect(result.current.resumen.stockCriticoCount).toBe(0)
     expect(result.current.resumen.porVencerCount).toBe(0)
    })
  })

  describe('Filtrado de items', () => {
    it('filtra por categoría', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.setCategoriaFiltro('EPP')
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].nombre).toBe('Guantes')
    })

    it('filtra por búsqueda en nombre', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.setBusqueda('resina')
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].nombre).toBe('Resina A2')
    })

    it('filtra por búsqueda en proveedor', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.setBusqueda('dental')
      })

      expect(result.current.items).toHaveLength(2)
    })

    it('combina filtro de categoría y búsqueda', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.setCategoriaFiltro('Insumos')
        result.current.setBusqueda('anestesia')
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].nombre).toBe('Anestesia')
    })

    it('retorna array vacío si no hay coincidencias', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.setBusqueda('xyz')
      })

      expect(result.current.items).toHaveLength(0)
    })
  })

  describe('agregarOActualizarItem', () => {
    it('agrega nuevo item con id Date.now()', () => {
      const { result } = renderHook(() => useInventario())
      const newItem = { nombre: 'Nuevo', categoria: 'Test', cantidad: 1 }

      act(() => {
        result.current.agregarOActualizarItem(newItem)
      })

      expect(result.current.items).toHaveLength(4)
      const agregado = result.current.items.find(i => i.nombre === 'Nuevo')
      expect(agregado).toBeDefined()
      expect(agregado.id).toBeDefined()
      expect(typeof agregado.id).toBe('number')
    })

    it('actualiza item existente por id', () => {
      const { result } = renderHook(() => useInventario())
      const updatedItem = { ...mockItems[0], cantidad: 100 }

      act(() => {
        result.current.agregarOActualizarItem(updatedItem)
      })

      expect(result.current.items).toHaveLength(3)
      const actualizado = result.current.items.find(i => i.id === 1)
      expect(actualizado.cantidad).toBe(100)
    })

    it('persiste cambios en storage', () => {
      const { result } = renderHook(() => useInventario())
      const newItem = { nombre: 'Test', categoria: 'Test', cantidad: 1 }

      act(() => {
        result.current.agregarOActualizarItem(newItem)
      })

      expect(inventarioStorageService.guardarItems).toHaveBeenCalled()
      const savedItems = inventarioStorageService.guardarItems.mock.calls[0][0]
      expect(savedItems).toHaveLength(4)
    })
  })

  describe('ajustarCantidadStock', () => {
    it('incrementa cantidad', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.ajustarCantidadStock(1, 2)
      })

      const item = result.current.items.find(i => i.id === 1)
      expect(item.cantidad).toBe(7)
    })

    it('decrementa cantidad', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.ajustarCantidadStock(1, -2)
      })

      const item = result.current.items.find(i => i.id === 1)
      expect(item.cantidad).toBe(3)
    })

    it('no permite cantidad negativa', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.ajustarCantidadStock(1, -100)
      })

      const item = result.current.items.find(i => i.id === 1)
      expect(item.cantidad).toBe(0)
    })

    it('maneja stocks fraccionales (F2-12a)', () => {
      inventarioStorageService.obtenerItems.mockReturnValue([
        { id: 1, nombre: 'Resina', cantidad: 0.5 }
      ])
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.ajustarCantidadStock(1, 0.25)
      })

      const item = result.current.items.find(i => i.id === 1)
      expect(item.cantidad).toBe(0.75)
    })

    it('persiste cambios en storage', () => {
      const { result } = renderHook(() => useInventario())

      act(() => {
        result.current.ajustarCantidadStock(1, 1)
      })

      expect(inventarioStorageService.guardarItems).toHaveBeenCalled()
    })
  })


  describe('Listener de evento inventario_actualizado (F2-12b)', () => {
    it('registra listener al montar', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      renderHook(() => useInventario())

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'inventario_actualizado',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
    })

    it('desregistra listener al desmontar', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => useInventario())

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'inventario_actualizado',
        expect.any(Function)
      )

      removeEventListenerSpy.mockRestore()
    })

    it('recarga items cuando se dispara evento', () => {
      const updatedItems = [
        { id: 1, nombre: 'Resina A2', cantidad: 100 }
      ]
      inventarioStorageService.obtenerItems
        .mockReturnValueOnce(mockItems)
        .mockReturnValueOnce(updatedItems)

      const { result } = renderHook(() => useInventario())

      expect(result.current.items).toHaveLength(3)

      act(() => {
        window.dispatchEvent(new CustomEvent('inventario_actualizado'))
      })

      expect(inventarioStorageService.obtenerItems).toHaveBeenCalledTimes(2)
      expect(result.current.items).toEqual(updatedItems)
    })
  })

  describe('Computed values', () => {
    it('recalcula resumen cuando cambian items', () => {
     const { result } = renderHook(() => useInventario())

     const resumenInicial = result.current.resumen

    act(() => {
      result.current.agregarOActualizarItem({
      id: 4,
      nombre: 'Nuevo',
      categoria: 'Test',
      cantidad: 10
    })
  })

  expect(result.current.resumen).not.toEqual(resumenInicial)
  expect(result.current.resumen.totalInsumos).toBe(4)
})

    it('recalcula items filtrados cuando cambia búsqueda', () => {
      const { result } = renderHook(() => useInventario())

      const filtradosInicial = result.current.items

      act(() => {
        result.current.setBusqueda('guantes')
      })

      expect(result.current.items).not.toEqual(filtradosInicial)
      expect(result.current.items).toHaveLength(1)
    })
  })
})
