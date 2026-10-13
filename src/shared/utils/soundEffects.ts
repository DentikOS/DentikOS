/** Sound Effects — Identidad sonora de DentikOS (Brand Manual §III) */
let audioCtx: AudioContext | null = null
let lastCtxConstructor: unknown = null

const getAudioContext = (): AudioContext | null => {
  const Ctx = (typeof window !== 'undefined' ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext : null) || (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext
  if (!Ctx) { audioCtx = null; lastCtxConstructor = null; return null }
  if (!audioCtx || lastCtxConstructor !== Ctx) {
    try { audioCtx = new Ctx(); lastCtxConstructor = Ctx } catch { return null }
  }
  return audioCtx
}

const playTone = (frequency: number, duration: number, startTime = 0, volume = 0.1): void => {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = frequency; osc.type = 'sine'
    const startAt = ctx.currentTime + startTime
    gain.gain.setValueAtTime(volume, startAt)
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration)
    osc.start(startAt); osc.stop(startAt + duration)
  } catch { /* Silencioso si audio no disponible */ }
}

export const soundEffects = {
  selection: () => playTone(1200, 0.015, 0, 0.08),
  save: () => { playTone(680, 0.04, 0, 0.15); playTone(850, 0.04, 0.04, 0.15) },
  alertCritical: () => playTone(220, 0.18, 0, 0.12),
}

export type SoundType = 'selection' | 'save' | 'alertCritical' | 'openPalette' | 'selectResult' | 'criticalNotif' | 'infoNotif' | 'breadcrumbClick'

/** Alias para compatibilidad con código existente */
export const playSound = (type: SoundType): void => {
  if (type === 'save' || type === 'selectResult') soundEffects.save()
  else if (type === 'alertCritical' || type === 'criticalNotif') soundEffects.alertCritical()
  else if (type === 'infoNotif') playTone(850, 0.03, 0, 0.04)
  else soundEffects.selection()
}
