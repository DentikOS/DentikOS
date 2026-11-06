import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import type { TreasurySnapshot } from '../services/treasuryCloudService'

const { mockCargar } = vi.hoisted(() => ({ mockCargar: vi.fn() }))

vi.mock('../services/treasuryCloudService', () => ({
  treasuryCloudService: { cargar: mockCargar }
}))
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: true }))
vi.mock('../../../../infrastructure/realtime/realtimeService', () => ({
  suscribirseATabla: vi.fn(() => null)
}))

import { useTreasury } from './useTreasury'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function snapshot(clinicaId: string): TreasurySnapshot {
  return { clinicaId, rol: 'admin' } as TreasurySnapshot
}

describe('useTreasury clinic-scoped hydration', () => {
  beforeEach(() => {
    mockCargar.mockReset()
    useSesionStore.setState({ clinicaActual: 'clinic-a', userProfile: { email: 'admin@example.test', rol: 'admin' } })
  })

  it('discards a slower response from the previous clinic after switching tenants', async () => {
    const clinicA = deferred<TreasurySnapshot>()
    const clinicB = deferred<TreasurySnapshot>()
    mockCargar.mockReturnValueOnce(clinicA.promise).mockReturnValueOnce(clinicB.promise)
    const { result } = renderHook(() => useTreasury())
    await waitFor(() => expect(mockCargar).toHaveBeenCalledTimes(1))

    act(() => useSesionStore.setState({ clinicaActual: 'clinic-b' }))
    await waitFor(() => expect(mockCargar).toHaveBeenCalledTimes(2))

    await act(async () => { clinicB.resolve(snapshot('clinic-b')) })
    expect(result.current.snapshot?.clinicaId).toBe('clinic-b')

    await act(async () => { clinicA.resolve(snapshot('clinic-a')) })
    expect(result.current.snapshot?.clinicaId).toBe('clinic-b')
  })
})
