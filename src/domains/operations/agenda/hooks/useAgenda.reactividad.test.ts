import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgenda } from './useAgenda'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'

describe('useAgenda - Reactividad sin setState-during-render (FIX-9)', () => {
  beforeEach(() => {
    useAgendaStore.setState({ citas: [] })
  })

  it('guardarCita actualiza store sin error de setState-during-render', async () => {
    const { result } = renderHook(() => useAgenda([]))

    const cita = {
      id: 'test-1',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      estado: 'Pendiente',
      pacienteNombre: 'Test',
    }

    expect(() => {
      act(() => {
        result.current.guardarCita(cita as never)
      })
    }).not.toThrow()

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAgendaStore.getState().citas).toHaveLength(1)
    expect(useAgendaStore.getState().citas[0].id).toBe('test-1')
  })

  it('eliminarCita actualiza store sin error', async () => {
    const { result } = renderHook(() => useAgenda([]))

    await act(async () => {
      result.current.guardarCita({
        id: 'test-1',
        fecha: '2026-10-15',
        horaInicio: '10:00',
        estado: 'Pendiente',
        pacienteNombre: 'Test',
      } as never)
      await Promise.resolve()
    })

    expect(useAgendaStore.getState().citas).toHaveLength(1)

    expect(() => {
      act(() => {
        result.current.eliminarCita('test-1')
      })
    }).not.toThrow()

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAgendaStore.getState().citas).toHaveLength(0)
  })

  it('guardarCita NO dispara CustomEvent durante la fase síncrona de render', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { result } = renderHook(() => useAgenda([]))

    const cita = {
      id: 'test-sync-1',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      estado: 'Pendiente',
      pacienteNombre: 'Test Sync',
    }

    let customEventsDispatched = 0
    dispatchSpy.mockImplementation((ev: Event) => {
      if (ev instanceof CustomEvent && ev.type.includes('citas')) {
        customEventsDispatched++
      }
      return true
    })

    act(() => {
      result.current.guardarCita(cita as never)
    })

    expect(customEventsDispatched).toBe(0)
    dispatchSpy.mockRestore()
  })
})
