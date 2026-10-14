import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContextualIntelligence, calcularMensajeContextual } from './useContextualIntelligence'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { useTopBarStore } from '../../app/stores/useTopBarStore'

vi.mock('../../domains/operations/agenda/services/agendaStorageService', () => ({
  agendaStorageService: {
    obtenerCitas: vi.fn(),
  },
}))

vi.mock('../../domains/billing/cash-register/services/finanzasStorageService', () => ({
  finanzasStorageService: {
    obtenerMovimientos: vi.fn(() => []),
  },
}))

vi.mock('../../infrastructure/auth/authService', () => ({
  getClinicaActivaSync: vi.fn(() => 'clinica-test'),
}))

describe('useContextualIntelligence (BP03 §08 Parte 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTopBarStore.setState({ contextualMessage: '' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mock hora 10:00 + 3 citas → mensaje "Agenda — 3 citas hoy"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 6, 10, 0, 0)) // 10:00 AM

    vi.mocked(agendaStorageService.obtenerCitas).mockReturnValue([
      { id: '1', fecha: '2026-10-06', horaInicio: '09:00', estado: 'Completado' },
      { id: '2', fecha: '2026-10-06', horaInicio: '10:30', estado: 'Confirmado' },
      { id: '3', fecha: '2026-10-06', horaInicio: '11:30', estado: 'Agendado' },
    ])

    const { result } = renderHook(() => useContextualIntelligence(null))
    expect(result.current).toBe('Agenda — 3 citas hoy')
    expect(useTopBarStore.getState().contextualMessage).toBe('Agenda — 3 citas hoy')
  })

  it('ficha abierta → "{Nombre} — Ficha activa" prioriza sobre citas', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 6, 10, 0, 0))

    vi.mocked(agendaStorageService.obtenerCitas).mockReturnValue([
      { id: '1', fecha: '2026-10-06', horaInicio: '09:00', estado: 'Completado' },
    ])

    const paciente = { id: 'p-1', nombre: 'Camila Silva' }
    const { result } = renderHook(() => useContextualIntelligence(paciente))
    expect(result.current).toBe('Camila Silva — Ficha activa')
    expect(useTopBarStore.getState().contextualMessage).toBe('Camila Silva — Ficha activa')
  })

  it('tarde 15:00 con 2 citas restantes y 1 retraso', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0)) // 15:00

    vi.mocked(agendaStorageService.obtenerCitas).mockReturnValue([
      { id: '1', fecha: '2026-10-06', horaInicio: '14:00', estado: 'Confirmado' }, // retraso (14:00 < 15:00)
      { id: '2', fecha: '2026-10-06', horaInicio: '16:00', estado: 'Confirmado' },
      { id: '3', fecha: '2026-10-06', horaInicio: '11:00', estado: 'Completado' },
    ])

    const msg = calcularMensajeContextual(null)
    expect(msg).toBe('2 citas restantes · 1 retraso')
  })

  it('fuera de horario sin citas ni paciente retorna null', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 6, 22, 0, 0)) // 22:00

    vi.mocked(agendaStorageService.obtenerCitas).mockReturnValue([])

    const msg = calcularMensajeContextual(null)
    expect(msg).toBeNull()
  })

  it('se actualiza cada 5 minutos según BP04 §06', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 6, 10, 0, 0))

    vi.mocked(agendaStorageService.obtenerCitas).mockReturnValue([
      { id: '1', fecha: '2026-10-06', horaInicio: '09:00', estado: 'Completado' },
    ])

    const setContextualMessageSpy = vi.spyOn(useTopBarStore.getState(), 'setContextualMessage')

    renderHook(() => useContextualIntelligence(null))
    const initialCalls = setContextualMessageSpy.mock.calls.length

    // Avanzar 5 minutos exactos (300000ms)
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(setContextualMessageSpy.mock.calls.length).toBeGreaterThan(initialCalls)
  })
})

