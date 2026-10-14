import { describe, it, expect, vi, beforeEach } from 'vitest'
import { soundEffects, playSound } from './soundEffects'

describe('soundEffects', () => {
  let mockOscillator: any
  let mockGain: any
  let mockCtx: any

  beforeEach(() => {
    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }

    mockOscillator = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 0 },
      type: '',
    }

    mockCtx = {
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      destination: {},
      currentTime: 0,
    }

    global.AudioContext = vi.fn().mockImplementation(() => mockCtx) as any
  })

  it('plays selection sound (1200Hz)', () => {
    soundEffects.selection()
    expect(mockOscillator.frequency.value).toBe(1200)
    expect(mockOscillator.start).toHaveBeenCalled()
  })

  it('plays save sound with two tones', () => {
    soundEffects.save()
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2)
  })

  it('plays alertCritical sound (220Hz)', () => {
    soundEffects.alertCritical()
    expect(mockOscillator.frequency.value).toBe(220)
  })

  it('handles missing AudioContext gracefully', () => {
    delete (global as any).AudioContext
    expect(() => soundEffects.selection()).not.toThrow()
  })

  it('playSound alias works', () => {
    playSound('selection')
    expect(mockOscillator.start).toHaveBeenCalled()
  })
})
