import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboardStore } from './useDashboardStore'

describe('useDashboardStore (BP04 §01)', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      widgetOrder: ['agenda', 'sala_espera'],
      widgets: [
        { id: 'agenda', tipo: 'agenda', visible: true, orden: 1 },
        { id: 'sala_espera', tipo: 'sala_espera', visible: true, orden: 2 }
      ],
      focusMode: false,
      presentationMode: false,
      quickResumeData: null
    })
  })

  it('permite reordenar widgets y actualiza el orden interno', () => {
    const { reorderWidgets } = useDashboardStore.getState()
    reorderWidgets(['sala_espera', 'agenda'])

    const state = useDashboardStore.getState()
    expect(state.widgetOrder).toEqual(['sala_espera', 'agenda'])
    const sala = state.widgets.find((w) => w.id === 'sala_espera')
    expect(sala?.orden).toBe(1)
    const agenda = state.widgets.find((w) => w.id === 'agenda')
    expect(agenda?.orden).toBe(2)
  })

  it('permite alternar visibilidad de un widget con toggleWidget', () => {
    const { toggleWidget } = useDashboardStore.getState()
    toggleWidget('agenda', false)

    let state = useDashboardStore.getState()
    expect(state.widgets.find((w) => w.id === 'agenda')?.visible).toBe(false)

    toggleWidget('agenda', true)
    state = useDashboardStore.getState()
    expect(state.widgets.find((w) => w.id === 'agenda')?.visible).toBe(true)
  })

  it('actualiza morningBriefData correctamente', () => {
    const { setMorningBriefData } = useDashboardStore.getState()
    const mockData = {
      lineas: [
        { id: '1', icono: 'Calendar', texto: '8 citas hoy', seccion: 'Agenda', severidad: 'info' }
      ],
      fechaActualizacion: '2026-10-10'
    }
    setMorningBriefData(mockData)

    const state = useDashboardStore.getState()
    expect(state.morningBriefData.lineas.length).toBe(1)
    expect(state.morningBriefData.lineas[0].texto).toBe('8 citas hoy')
  })

  it('inicializa visibilidad de widgets según el rol', () => {
    const { initParaRol } = useDashboardStore.getState()
    initParaRol('recepcion')

    const state = useDashboardStore.getState()
    const agenda = state.widgets.find((w) => w.id === 'agenda')
    expect(agenda?.visible).toBe(true)
  })
})
