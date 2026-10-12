import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useHistorialBusqueda } from './useHistorialBusqueda'
import { useSesionStore } from '../../../../app/stores/sesionStore'

describe('useHistorialBusqueda', () => {
  beforeEach(() => {
    localStorage.clear()
    useSesionStore.setState({ userProfile: { id: 'usr-1', email: 'test@clinic.com', rol: 'dentista', clinicaId: 'clinica-1', nombreCompleto: 'Dr Test' } as any })
  })

  it('inicia con historial vacío si no hay datos guardados', () => {
    const { result } = renderHook(() => useHistorialBusqueda())
    expect(result.current.historial).toEqual([])
  })

  it('agrega búsquedas al inicio y no duplica', () => {
    const { result } = renderHook(() => useHistorialBusqueda())
    act(() => {
      result.current.agregarBusqueda('Camila')
    })
    expect(result.current.historial).toEqual(['Camila'])

    act(() => {
      result.current.agregarBusqueda('Carlos')
    })
    expect(result.current.historial).toEqual(['Carlos', 'Camila'])

    act(() => {
      result.current.agregarBusqueda('Camila')
    })
    expect(result.current.historial).toEqual(['Camila', 'Carlos'])
  })

  it('limita el historial a un máximo de 10 elementos', () => {
    const { result } = renderHook(() => useHistorialBusqueda())
    act(() => {
      for (let i = 1; i <= 15; i++) {
        result.current.agregarBusqueda(`Busqueda ${i}`)
      }
    })
    expect(result.current.historial.length).toBe(10)
    expect(result.current.historial[0]).toBe('Busqueda 15')
  })

  it('permite limpiar el historial', () => {
    const { result } = renderHook(() => useHistorialBusqueda())
    act(() => {
      result.current.agregarBusqueda('Prueba')
    })
    expect(result.current.historial.length).toBe(1)

    act(() => {
      result.current.limpiarHistorial()
    })
    expect(result.current.historial).toEqual([])
  })
})
