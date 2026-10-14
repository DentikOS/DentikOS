import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNotificationsRealtime } from './useNotificationsRealtime'
import { supabase } from '../../infrastructure/supabase/supabaseClient'

// Mocks
const channelMock: Record<string, any> = {}
channelMock.on = vi.fn(() => channelMock)
channelMock.subscribe = vi.fn(() => channelMock)

vi.mock('../../infrastructure/supabase/supabaseClient', () => {
  return {
    USE_SUPABASE: true,
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      channel: vi.fn(() => channelMock),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock('../../app/stores/sesionStore', () => ({
  useSesionStore: vi.fn((selector) => 
    selector({ 
      user: { id: 'user-123' },
      userProfile: { clinicaId: 'clinic-456' }
    })
  ),
}))

describe('useNotificationsRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('se monta sin errores', () => {
    const { unmount } = renderHook(() => useNotificationsRealtime())
    expect(unmount).not.toThrow()
  })

  it('limpia el canal al desmontar', () => {
    const { unmount } = renderHook(() => useNotificationsRealtime())
    unmount()
    expect(supabase?.removeChannel).toHaveBeenCalled()
  })
})
