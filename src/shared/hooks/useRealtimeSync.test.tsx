import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const realtimeMocks = vi.hoisted(() => ({
  subscriptions: [] as Array<[string, (...args: unknown[]) => void, { enabled?: boolean } | undefined]>,
  sincronizarVademecum: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./useRealtimeSubscription', () => ({
  useRealtimeSubscription: (...args: [string, (...args: unknown[]) => void, { enabled?: boolean } | undefined]) => {
    realtimeMocks.subscriptions.push(args)
  },
}))
vi.mock('../../app/stores/pacientesStore', () => ({
  usePacientesStore: (selector: (state: { refrescarDesdeSupabase: () => void }) => unknown) =>
    selector({ refrescarDesdeSupabase: vi.fn() }),
}))
vi.mock('../../app/stores/prestacionesStore', () => ({
  usePrestacionesStore: { getState: () => ({ sincronizarDesdeSupabase: vi.fn() }) },
}))
vi.mock('../../app/stores/sesionStore', () => ({
  useSesionStore: (selector: (state: { userProfile: object }) => unknown) => selector({ userProfile: { id: 'usuario-test' } }),
}))
vi.mock('../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: true }))
vi.mock('../../infrastructure/notification/notificationService', () => ({ notificationService: { info: vi.fn() } }))
vi.mock('../../infrastructure/clinical-data/vademecumService', () => ({
  vademecumService: { sincronizarDesdeSupabase: realtimeMocks.sincronizarVademecum },
}))
vi.mock('./useSincronizacionInicial', () => ({ useSincronizacionInicial: vi.fn() }))
vi.mock('../../infrastructure/logging/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn() }),
}))

import { REALTIME_EVENTS } from '../../infrastructure/realtime/realtimeEvents'
import { useRealtimeSync } from './useRealtimeSync'

describe('useRealtimeSync — vademécum BP11', () => {
  beforeEach(() => {
    realtimeMocks.subscriptions = []
    realtimeMocks.sincronizarVademecum.mockClear()
  })

  it('se suscribe a todas las tablas de referencia del BP11', () => {
    renderHook(() => useRealtimeSync())

    const tablasSuscritas = realtimeMocks.subscriptions.map(([tabla]) => tabla)
    expect(tablasSuscritas).toEqual(expect.arrayContaining([
      'vademecum',
      'vademecum_urgencia',
      'vademecum_antirresortivos',
      'alergias_cruzadas',
      'interacciones_farmacologicas',
      'profilaxis_endocarditis',
      'manejo_anticoagulantes',
      'reference_data_meta',
    ]))
    expect(realtimeMocks.subscriptions.find(([tabla]) => tabla === 'vademecum')?.[2]).toEqual({ enabled: true })
  })

  it('refresca el catálogo al recibir un cambio remoto', () => {
    renderHook(() => useRealtimeSync())
    const subscription = realtimeMocks.subscriptions.find(([tabla]) => tabla === 'vademecum')

    subscription?.[1]({ eventType: 'UPDATE' })

    expect(realtimeMocks.sincronizarVademecum).toHaveBeenCalledTimes(1)
    expect(REALTIME_EVENTS.VADEMECUM_CHANGED).toBe('realtime:vademecum_changed')
  })
})
