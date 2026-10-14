import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsInitialMount } from './useCascadeAnimation'

describe('useIsInitialMount', () => {
  it('retorna true inicialmente y false después de que expira el temporizador', () => {
    vi.useFakeTimers()

    const { result, rerender } = renderHook(() => useIsInitialMount(600))
    expect(result.current).toBe(true)

    // Re-render antes del timeout sigue en ventana inicial
    rerender()
    expect(result.current).toBe(true)

    // Avanza el tiempo más allá de 600ms
    act(() => {
      vi.advanceTimersByTime(650)
    })

    rerender()
    expect(result.current).toBe(false)

    vi.useRealTimers()
  })
})
