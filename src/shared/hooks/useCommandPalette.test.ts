import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommandPalette } from './useCommandPalette'
import {
  buildPacienteResults,
  buildCitaResults,
  buildModuloResults,
} from '../../constants/commandPaletteConstants'

describe('useCommandPalette & commandPaletteConstants (Blueprint 03 §03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('límites consistentes: máximo 5 resultados por categoría', () => {
    const muchosPacientes = Array.from({ length: 10 }, (_, i) => ({
      id: `p-${i}`,
      nombre: `Paciente ${i}`,
      rut: `12.345.67${i}-9`,
      telefono: `+5691234567${i}`,
    }))

    const pacienteResults = buildPacienteResults(muchosPacientes as any, '', vi.fn(), vi.fn())
    expect(pacienteResults.length).toBe(5)

    const muchasCitas = Array.from({ length: 10 }, (_, i) => ({
      id: `c-${i}`,
      pacienteNombre: `Paciente ${i}`,
      motivo: `Control ${i}`,
      fecha: '2026-10-13',
    }))

    const citaResults = buildCitaResults(muchasCitas as any, '', vi.fn(), vi.fn())
    expect(citaResults.length).toBe(5)

    const muchosModulos = Array.from({ length: 10 }, (_, i) => ({
      name: `Modulo ${i}`,
      slug: `modulo-${i}`,
    }))

    const moduloResults = buildModuloResults(muchosModulos as any, '', vi.fn())
    expect(moduloResults.length).toBe(5)
  })

  it('aplica debounce de 150ms al actualizar query', () => {
    const onNavigate = vi.fn()
    const onSelectPaciente = vi.fn()

    const { result } = renderHook(() =>
      useCommandPalette({
        onNavigate,
        onSelectPaciente,
      })
    )

    expect(result.current.query).toBe('')

    act(() => {
      result.current.setQuery('Juan')
    })

    expect(result.current.query).toBe('Juan')

    // Avanzamos 100ms: aún no han pasado los 150ms de debounce
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Avanzamos 60ms más (total 160ms > 150ms)
    act(() => {
      vi.advanceTimersByTime(60)
    })

    expect(result.current.query).toBe('Juan')
  })

  it('permite abrir, cerrar y ciclar navegación con moveDown / moveUp', () => {
    const { result } = renderHook(() =>
      useCommandPalette({
        onNavigate: vi.fn(),
        onSelectPaciente: vi.fn(),
      })
    )

    act(() => {
      result.current.open()
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.moveDown()
    })
    expect(result.current.selectedIndex).toBe(1)

    act(() => {
      result.current.moveUp()
    })
    expect(result.current.selectedIndex).toBe(0)

    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)
    expect(result.current.query).toBe('')
  })
})
