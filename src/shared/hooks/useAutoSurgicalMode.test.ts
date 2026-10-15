import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoSurgicalMode } from './useAutoSurgicalMode'
import { useThemeStore } from '../../app/stores/useThemeStore'
import { useAgendaStore } from '../../app/stores/useAgendaStore'

vi.mock('../../infrastructure/notification/notificationService', () => ({
  notificationService: {
    success: vi.fn(),
    info: vi.fn(),
  }
}))

describe('useAutoSurgicalMode (BP05 §10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useThemeStore.setState({ theme: 'light' })
    useAgendaStore.setState({ citas: [] })
  })

  it('activa modo quirúrgico automáticamente con cita urgente en atención', () => {
    useAgendaStore.setState({
      citas: [
        { 
          id: '1', 
          estado: 'En atención', 
          pacienteNombre: 'Juan',
          esUrgencia: true 
        } as any
      ]
    })

    renderHook(() => useAutoSurgicalMode())

    expect(useThemeStore.getState().theme).toBe('surgical')
  })

  it('activa modo quirúrgico con procedimiento largo (cirugía)', () => {
    useAgendaStore.setState({
      citas: [
        { 
          id: '1', 
          estado: 'En atención', 
          pacienteNombre: 'María',
          motivo: 'Extracción tercer molar'
        } as any
      ]
    })

    renderHook(() => useAutoSurgicalMode())

    expect(useThemeStore.getState().theme).toBe('surgical')
  })

  it('NO activa si la cita no es urgente ni procedimiento largo', () => {
    useAgendaStore.setState({
      citas: [
        { 
          id: '1', 
          estado: 'En atención', 
          pacienteNombre: 'Pedro',
          motivo: 'Control ortodoncia'
        } as any
      ]
    })

    renderHook(() => useAutoSurgicalMode())

    expect(useThemeStore.getState().theme).toBe('light')
  })
})
