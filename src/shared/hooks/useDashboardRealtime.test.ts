import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardRealtime } from './useDashboardRealtime'

// Mock Supabase
vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED')
        return { unsubscribe: vi.fn() }
      })
    })),
    removeChannel: vi.fn()
  }
}))

// Mock store
vi.mock('../../app/stores/sesionStore', () => ({
  useSesionStore: vi.fn((selector) =>
    selector({
      userProfile: { clinicaId: 'clinica-test-123' },
      clinicaActual: 'clinica-test-123'
    })
  )
}))

describe('useDashboardRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('se suscribe al canal de Realtime al montar', async () => {
    renderHook(() => useDashboardRealtime())

    const { supabase } = await import('../../infrastructure/supabase/supabaseClient')
    expect(supabase?.channel).toHaveBeenCalledWith('dashboard-realtime-clinica-test-123')
  })

  it('se desuscribe al desmontar', async () => {
    const { unmount } = renderHook(() => useDashboardRealtime())
    unmount()

    const { supabase } = await import('../../infrastructure/supabase/supabaseClient')
    expect(supabase?.removeChannel).toHaveBeenCalled()
  })
})
