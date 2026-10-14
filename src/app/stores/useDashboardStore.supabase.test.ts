import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDashboardStore } from './useDashboardStore'

// Mock Supabase
vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    functions: {
      invoke: vi.fn()
    }
  }
}))

// Mock sesionStore
vi.mock('./sesionStore', () => ({
  useSesionStore: {
    getState: vi.fn(() => ({
      userProfile: { clinicaId: 'clinica-test-123' },
      clinicaActual: 'clinica-test-123'
    }))
  }
}))

describe('useDashboardStore - Supabase Sync', () => {
  beforeEach(async () => {
    const { supabase } = await import('../../infrastructure/supabase/supabaseClient')
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } }
    } as any)
    vi.mocked(supabase!.functions.invoke).mockResolvedValue({
      data: {
        widgetOrder: ['agenda', 'alertas_clinicas', 'pacientes_recientes'],
        hiddenWidgets: ['pagos_pendientes']
      },
      error: null
    } as any)

    useDashboardStore.setState({
      widgets: [
        { id: 'agenda', tipo: 'agenda', visible: true, orden: 1 },
        { id: 'alertas_clinicas', tipo: 'alertas_clinicas', visible: true, orden: 2 },
        { id: 'pacientes_recientes', tipo: 'pacientes_recientes', visible: true, orden: 3 }
      ],
      widgetOrder: ['agenda', 'alertas_clinicas', 'pacientes_recientes']
    })
  })

  it('syncFromSupabase actualiza el orden de widgets desde Supabase', async () => {
    await useDashboardStore.getState().syncFromSupabase()

    const state = useDashboardStore.getState()
    expect(state.widgetOrder).toEqual(['agenda', 'alertas_clinicas', 'pacientes_recientes'])
  })

  it('reorderWidgets guarda en Supabase después de actualizar localStorage', async () => {
    const { supabase } = await import('../../infrastructure/supabase/supabaseClient')

    await useDashboardStore.getState().reorderWidgets(['pacientes_recientes', 'agenda', 'alertas_clinicas'])

    expect(supabase?.functions.invoke).toHaveBeenCalledWith('save-dashboard-preferences', {
      body: expect.objectContaining({
        widgetOrder: ['pacientes_recientes', 'agenda', 'alertas_clinicas']
      })
    })
  })
})
