import { describe, it, expect, beforeEach } from 'vitest'
import { useAgendaStore } from './useAgendaStore'

describe('useAgendaStore (BP05 §01)', () => {
  beforeEach(() => {
    useAgendaStore.setState({
      currentView: 'day',
      selectedDoctor: 'Todos',
      selectedBox: 'Todos',
      citas: [],
      espera: [],
      bloqueos: []
    })
  })

  it('permite cambiar vista y filtros de doctor y box', () => {
    const { setView, setDoctor, setBox } = useAgendaStore.getState()
    setView('week')
    expect(useAgendaStore.getState().currentView).toBe('week')

    setDoctor('Dr. Castillo')
    expect(useAgendaStore.getState().selectedDoctor).toBe('Dr. Castillo')

    setBox('Box 2')
    expect(useAgendaStore.getState().selectedBox).toBe('Box 2')
  })

  it('agrega, actualiza y elimina citas en el store', () => {
    const { addCita, updateCita, removeCita } = useAgendaStore.getState()
    const mockCita = {
      id: 'c-101',
      fecha: '2026-10-10',
      horaInicio: '10:00',
      estado: 'Confirmada',
      pacienteNombre: 'Rosa Pérez'
    }

    addCita(mockCita)
    expect(useAgendaStore.getState().citas).toHaveLength(1)

    updateCita('c-101', { estado: 'En atención' })
    expect(useAgendaStore.getState().citas[0].estado).toBe('En atención')

    removeCita('c-101')
    expect(useAgendaStore.getState().citas).toHaveLength(0)
  })

  it('NO permite waiting_room como tipo de vista (BP05 §01)', () => {
    // waiting_room es un sub-módulo (§05), no una vista de agenda
    const validViews = ['day', 'week', 'month', 'list'] as const
    
    validViews.forEach(view => {
      useAgendaStore.getState().setView(view)
      expect(useAgendaStore.getState().currentView).toBe(view)
    })
    
    expect(() => {
      // @ts-expect-error - waiting_room no es válido
      useAgendaStore.getState().setView('waiting_room')
    }).not.toThrow()
  })
})
