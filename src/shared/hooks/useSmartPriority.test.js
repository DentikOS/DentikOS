import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSmartPriority } from './useSmartPriority'
import { useDashboardStore } from '../../app/stores/useDashboardStore'
import { escribirJSON } from '../../infrastructure/storage/localStorageRepository'

describe('useSmartPriority (BP04 §05)', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      widgetOrder: ['sala_espera', 'agenda', 'pacientes_recientes'],
      widgets: [
        { id: 'sala_espera', tipo: 'sala_espera', visible: true, orden: 1 },
        { id: 'agenda', tipo: 'agenda', visible: true, orden: 2 },
        { id: 'pacientes_recientes', tipo: 'pacientes_recientes', visible: true, orden: 3 }
      ]
    })
    escribirJSON('dashboard_smart_priority_clicks', [])
  })

  it('no sugiere si hay menos de 5 clicks', () => {
    const { result } = renderHook(() => useSmartPriority())
    act(() => {
      result.current.registrarClickWidget('agenda')
      result.current.registrarClickWidget('agenda')
    })
    expect(result.current.sugerencia).toBeNull()
  })

  it('sugiere mover al primer lugar si un widget tiene >50% de los clicks', () => {
    const { result } = renderHook(() => useSmartPriority())
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.registrarClickWidget('agenda')
      }
      result.current.registrarClickWidget('sala_espera')
    })

    expect(result.current.sugerencia).toEqual(
      expect.objectContaining({ widgetId: 'agenda' })
    )

    act(() => {
      result.current.aceptarSugerencia()
    })

    expect(useDashboardStore.getState().widgetOrder[0]).toBe('agenda')
    expect(result.current.sugerencia).toBeNull()
  })

  it('permite descartar la sugerencia', () => {
    const { result } = renderHook(() => useSmartPriority())
    act(() => {
      for (let i = 0; i < 6; i++) {
        result.current.registrarClickWidget('agenda')
      }
    })
    expect(result.current.sugerencia).not.toBeNull()
    act(() => {
      result.current.descartarSugerencia()
    })
    expect(result.current.sugerencia).toBeNull()
  })
})
