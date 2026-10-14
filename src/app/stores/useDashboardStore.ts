import { create } from 'zustand'
import type {
  WidgetConfig,
  WidgetType,
  MorningBriefData,
  QuickResumeData,
  ContextualData
} from '../../shared/types/dashboardTypes'
import { WIDGET_CONFIG, WIDGETS_POR_ROL } from '../../application/analytics/dashboard/constants/dashboardConstants'
import { leerJSON, escribirJSON } from '../../infrastructure/storage/localStorageRepository'
import { supabase, USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from './sesionStore'

const PREFS_KEY = 'dashboard_widget_prefs_v1'
const DEFAULT_ORDER: string[] = Object.keys(WIDGET_CONFIG)
const DEFAULT_WIDGETS: WidgetConfig[] = Object.values(WIDGET_CONFIG)

export interface DashboardState {
  widgets: WidgetConfig[]
  widgetOrder: string[]
  morningBriefData: MorningBriefData
  focusMode: boolean
  presentationMode: boolean
  quickResumeData: QuickResumeData | null
  contextualData: ContextualData
  setWidgets: (widgets: WidgetConfig[]) => void
  reorderWidgets: (newOrder: string[]) => Promise<void>
  toggleWidget: (id: string, visible?: boolean) => Promise<void>
  setMorningBriefData: (data: MorningBriefData) => void
  setFocusMode: (val: boolean) => void
  setPresentationMode: (val: boolean) => void
  setQuickResumeData: (data: QuickResumeData | null) => void
  setContextualData: (data: ContextualData) => void
  initParaRol: (rol?: string) => Promise<void>
  syncFromSupabase: () => Promise<void>
}

const getInitialPrefs = () => {
  const saved = leerJSON<{ order: string[]; hidden: string[] }>(PREFS_KEY, {
    order: DEFAULT_ORDER,
    hidden: []
  })
  const order = saved.order?.length ? saved.order : DEFAULT_ORDER
  const hiddenSet = new Set(saved.hidden || [])
  const widgets = DEFAULT_WIDGETS.map((w, idx) => ({
    ...w,
    visible: !hiddenSet.has(w.id),
    orden: order.indexOf(w.id) !== -1 ? order.indexOf(w.id) + 1 : idx + 1
  }))
  return { order, widgets }
}

const initial = getInitialPrefs()

export const useDashboardStore = create<DashboardState>((set, get) => ({
  widgets: initial.widgets,
  widgetOrder: initial.order,
  morningBriefData: { lineas: [], fechaActualizacion: '' },
  focusMode: false,
  presentationMode: false,
  quickResumeData: null,
  contextualData: { mensaje: null },

  setWidgets: (widgets) => set({ widgets }),

  reorderWidgets: async (newOrder) => {
    const state = get()
    const updated = state.widgets.map((w) => {
      const idx = newOrder.indexOf(w.id)
      return idx !== -1 ? { ...w, orden: idx + 1 } : w
    })

    const hiddenWidgets = updated.filter((w) => !w.visible).map((w) => w.id)

    // Guardar en localStorage inmediatamente (fast path)
    escribirJSON(PREFS_KEY, {
      order: newOrder,
      hidden: hiddenWidgets
    })

    set({ widgetOrder: newOrder, widgets: updated })

    // Sincronizar con Supabase (async, no bloquea UI)
    if (USE_SUPABASE && supabase) {
      try {
        const userProfile = useSesionStore.getState().userProfile
        const clinicaActual = useSesionStore.getState().clinicaActual
        const clinicaId = clinicaActual || (userProfile as { clinicaId?: string } | null)?.clinicaId

        if (clinicaId) {
          const sessionData = await supabase.auth.getSession()
          const session = sessionData?.data?.session
          if (session) {
            await supabase.functions.invoke('save-dashboard-preferences', {
              body: {
                clinicId: clinicaId,
                widgetOrder: newOrder,
                hiddenWidgets
              }
            })
          }
        }
      } catch (e) {
        console.error('Error sincronizando preferencias con Supabase:', e)
        // Silencioso: localStorage ya tiene los datos
      }
    }
  },

  toggleWidget: async (id, visible) => {
    const state = get()
    const updated = state.widgets.map((w) =>
      w.id === id ? { ...w, visible: visible !== undefined ? visible : !w.visible } : w
    )

    const hiddenWidgets = updated.filter((w) => !w.visible).map((w) => w.id)

    // Guardar en localStorage inmediatamente
    escribirJSON(PREFS_KEY, {
      order: state.widgetOrder,
      hidden: hiddenWidgets
    })

    set({ widgets: updated })

    // Sincronizar con Supabase
    if (USE_SUPABASE && supabase) {
      try {
        const userProfile = useSesionStore.getState().userProfile
        const clinicaActual = useSesionStore.getState().clinicaActual
        const clinicaId = clinicaActual || (userProfile as { clinicaId?: string } | null)?.clinicaId

        if (clinicaId) {
          const sessionData = await supabase.auth.getSession()
          const session = sessionData?.data?.session
          if (session) {
            await supabase.functions.invoke('save-dashboard-preferences', {
              body: {
                clinicId: clinicaId,
                widgetOrder: state.widgetOrder,
                hiddenWidgets
              }
            })
          }
        }
      } catch (e) {
        console.error('Error sincronizando preferencias con Supabase:', e)
      }
    }
  },

  syncFromSupabase: async () => {
    if (!USE_SUPABASE || !supabase) return

    try {
      const userProfile = useSesionStore.getState().userProfile
      const clinicaActual = useSesionStore.getState().clinicaActual
      const clinicaId = clinicaActual || (userProfile as { clinicaId?: string } | null)?.clinicaId

      if (!clinicaId) return

      const sessionData = await supabase.auth.getSession()
      const session = sessionData?.data?.session
      if (!session) return

      const { data, error } = await supabase.functions.invoke('get-dashboard-preferences', {
        body: { clinicId: clinicaId }
      })

      if (error) throw error

      if (data?.widgetOrder) {
        const state = get()
        const hiddenList: string[] = data.hiddenWidgets || []
        const updated = state.widgets.map((w) => {
          const idx = data.widgetOrder.indexOf(w.id)
          return {
            ...w,
            orden: idx !== -1 ? idx + 1 : w.orden,
            visible: !hiddenList.includes(w.id)
          }
        })

        set({ widgetOrder: data.widgetOrder, widgets: updated })

        // Actualizar localStorage con datos de Supabase
        escribirJSON(PREFS_KEY, {
          order: data.widgetOrder,
          hidden: hiddenList
        })
      }
    } catch (e) {
      console.error('Error sincronizando preferencias desde Supabase:', e)
    }
  },

  setMorningBriefData: (morningBriefData) => set({ morningBriefData }),
  setFocusMode: (focusMode) => set({ focusMode }),
  setPresentationMode: (presentationMode) => set({ presentationMode }),
  setQuickResumeData: (quickResumeData) => set({ quickResumeData }),
  setContextualData: (contextualData) => set({ contextualData }),

  initParaRol: async (rol = 'admin') => {
    const permitidos = new Set(WIDGETS_POR_ROL[rol] || WIDGETS_POR_ROL.admin || [])
    const aplicarFiltrado = () => {
      const saved = leerJSON<{ order: string[]; hidden: string[] }>(PREFS_KEY, {
        order: DEFAULT_ORDER,
        hidden: []
      })
      const hiddenSet = new Set(saved.hidden || [])
      const { widgets, widgetOrder } = get()
      const filtrados = widgets.map((w) => ({
        ...w,
        visible: permitidos.has(w.tipo as WidgetType) && !hiddenSet.has(w.id)
      }))
      set({ widgets: filtrados, widgetOrder })
    }

    aplicarFiltrado()

    if (USE_SUPABASE && supabase) {
      await get().syncFromSupabase()
      aplicarFiltrado()
    }
  }
}))
