import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSupabaseRealtime } from './useSupabaseRealtime'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

describe('useSupabaseRealtime (Blueprint 02 §05 y §09)', () => {
  beforeEach(() => {
    useSidebarStore.setState({ connectivityStatus: 'connected', activeDevices: 1 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('actualiza connectivityStatus ante eventos online y offline', () => {
    const { unmount } = renderHook(() => useSupabaseRealtime())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(useSidebarStore.getState().connectivityStatus).toBe('pending')

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(useSidebarStore.getState().connectivityStatus).toBe('connected')

    unmount()
  })
})
