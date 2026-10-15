import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sonidoAgendaService, type SonidoAgenda } from './sonidoAgendaService'

describe('sonidoAgendaService (BP05 §08 & §10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no falla si AudioContext no esta disponible en el entorno', () => {
    expect(() => {
      sonidoAgendaService.play('cita_movida')
      sonidoAgendaService.play('nueva_cita')
      sonidoAgendaService.play('cita_confirmada')
      sonidoAgendaService.play('cita_cancelada')
      sonidoAgendaService.play('paciente_espera_larga')
      sonidoAgendaService.play('recordatorio_5min')
    }).not.toThrow()
  })

  it('ejecuta reproduccion si AudioContext simulado existe', () => {
    const mockOscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const mockGain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }
    const mockAudioContext = vi.fn().mockImplementation(() => ({
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      destination: {},
      currentTime: 0,
    }))

    // @ts-expect-error Mocking AudioContext
    window.AudioContext = mockAudioContext

    sonidoAgendaService.play('cita_confirmada')
    expect(mockAudioContext).toHaveBeenCalled()
    expect(mockOscillator.start).toHaveBeenCalled()
  })
})
