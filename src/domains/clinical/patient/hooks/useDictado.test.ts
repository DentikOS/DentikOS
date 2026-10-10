import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDictado } from './useDictado'

describe('useDictado hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('inicializa con estado inactivo y texto vacío', () => {
    const { result } = renderHook(() => useDictado())
    expect(result.current.estaDictando).toBe(false)
    expect(result.current.textoDictado).toBe('')
  })

  it('permite limpiar texto dictado y detener dictado', () => {
    const { result } = renderHook(() => useDictado())

    act(() => {
      result.current.limpiarDictado()
      result.current.detenerDictado()
    })

    expect(result.current.estaDictando).toBe(false)
    expect(result.current.textoDictado).toBe('')
  })
})
