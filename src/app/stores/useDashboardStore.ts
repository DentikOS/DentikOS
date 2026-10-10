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
  reorderWidgets: (newOrder: string[]) => void
  toggleWidget: (id: string, visible?: boolean) => void
  setMorningBriefData: (data: MorningBriefData) => void
  setFocusMode: (val: boolean) => void
  setPresentationMode: (val: boolean) => void
  setQuickResumeData: (data: QuickResumeData | null) => void
  setContextualData: (data: ContextualData) => void
  initParaRol: (rol?: string) => void
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

  reorderWidgets: (newOrder) => {
    set((state) => {
      const updated = state.widgets.map((w) => {
        const idx = newOrder.indexOf(w.id)
        return idx !== -1 ? { ...w, orden: idx + 1 } : w
      })
      escribirJSON(PREFS_KEY, {
        order: newOrder,
        hidden: state.widgets.filter((w) => !w.visible).map((w) => w.id)
      })
      return { widgetOrder: newOrder, widgets: updated }
    })
  },

  toggleWidget: (id, visible) => {
    set((state) => {
      const updated = state.widgets.map((w) =>
        w.id === id ? { ...w, visible: visible !== undefined ? visible : !w.visible } : w
      )
      escribirJSON(PREFS_KEY, {
        order: state.widgetOrder,
        hidden: updated.filter((w) => !w.visible).map((w) => w.id)
      })
      return { widgets: updated }
    })
  },

  setMorningBriefData: (morningBriefData) => set({ morningBriefData }),
  setFocusMode: (focusMode) => set({ focusMode }),
  setPresentationMode: (presentationMode) => set({ presentationMode }),
  setQuickResumeData: (quickResumeData) => set({ quickResumeData }),
  setContextualData: (contextualData) => set({ contextualData }),

  initParaRol: (rol = 'admin') => {
    const permitidos = new Set(WIDGETS_POR_ROL[rol] || WIDGETS_POR_ROL.admin || [])
    const { widgets, widgetOrder } = get()
    const filtrados = widgets.map((w) => ({
      ...w,
      visible: permitidos.has(w.tipo as WidgetType)
    }))
    set({ widgets: filtrados, widgetOrder })
  }
}))
