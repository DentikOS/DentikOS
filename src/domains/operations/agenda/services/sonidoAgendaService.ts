import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('sonidoAgendaService')

/**
 * BP05 §08 / §10: Identidad sonora de la Agenda
 * 
 * Coherente con Brand Manual Parte III §3:
 * "Sonidos sutiles y profesionales. Respetan la quietud de box.
 *  Prohibidos sonidos de caja registradora o alertas cómicas."
 * 
 * Generación mediante Web Audio API (oscillators + gains).
 * No requiere archivos .mp3 ni .wav.
 */

export type SonidoAgenda =
  | 'nueva_cita'
  | 'cita_confirmada'
  | 'cita_cancelada'
  | 'paciente_espera_larga'
  | 'recordatorio_5min'
  | 'cita_movida'

const playTone = (
  frecuencia: number,
  duracionMs: number,
  tipo: OscillatorType = 'sine',
  volumen: number = 0.1
): void => {
  try {
    if (typeof window === 'undefined') return
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const audioCtx = new AudioContextClass()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.type = tipo
    oscillator.frequency.value = frecuencia
    gainNode.gain.value = volumen

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    const ahora = audioCtx.currentTime
    oscillator.start(ahora)

    // Fade out suave para evitar clics
    gainNode.gain.setValueAtTime(volumen, ahora)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ahora + duracionMs / 1000)

    oscillator.stop(ahora + duracionMs / 1000)
  } catch (e) {
    log.warn('No se pudo reproducir sonido:', e)
  }
}

export const sonidoAgendaService = {
  play: (sonido: SonidoAgenda): void => {
    switch (sonido) {
      case 'nueva_cita':
      case 'cita_movida':
        // Doble pulso armónico 680Hz→850Hz, 80ms total
        playTone(680, 40, 'sine', 0.08)
        setTimeout(() => playTone(850, 40, 'sine', 0.08), 40)
        break

      case 'cita_confirmada':
        // Micro-clic suave 850Hz, 30ms
        playTone(850, 30, 'sine', 0.06)
        break

      case 'cita_cancelada':
        // Tono grave breve 320Hz, 60ms
        playTone(320, 60, 'triangle', 0.08)
        break

      case 'paciente_espera_larga':
        // Tono de precaución 440Hz, 120ms
        playTone(440, 120, 'sine', 0.10)
        break

      case 'recordatorio_5min':
        // Micro-clic sutil 1200Hz, 15ms
        playTone(1200, 15, 'sine', 0.05)
        break
    }
  },
}
