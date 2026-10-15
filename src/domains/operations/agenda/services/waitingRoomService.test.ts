import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitingRoomService, calcularEstadoFlujo } from './waitingRoomService'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

describe('waitingRoomService (BP05 §05)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('calcularEstadoFlujo', () => {
    it('retorna estado vacio si no hay eventos', () => {
      const estado = calcularEstadoFlujo([])
      expect(estado.enEspera).toBe(false)
      expect(estado.llamada).toBe(false)
      expect(estado.avisado).toBe(false)
      expect(estado.enAtencion).toBe(false)
    })

    it('detecta paciente en espera tras check-in', () => {
      const eventos = [
        { tipo: 'check_in', createdAt: new Date().toISOString() } as any,
      ]
      const estado = calcularEstadoFlujo(eventos)
      expect(estado.enEspera).toBe(true)
      expect(estado.llamada).toBe(false)
    })

    it('detecta paciente avisado tras llamada', () => {
      const eventos = [
        { tipo: 'check_in', createdAt: new Date(Date.now() - 300000).toISOString() } as any,
        { tipo: 'llamar_siguiente', createdAt: new Date(Date.now() - 60000).toISOString() } as any,
        { tipo: 'paciente_avisado', createdAt: new Date().toISOString() } as any,
      ]
      const estado = calcularEstadoFlujo(eventos)
      expect(estado.enEspera).toBe(true)
      expect(estado.llamada).toBe(true)
      expect(estado.avisado).toBe(true)
      expect(estado.minutosEspera).toBeGreaterThanOrEqual(4)
    })

    it('detecta atencion iniciada', () => {
      const eventos = [
        { tipo: 'check_in', createdAt: new Date(Date.now() - 600000).toISOString() } as any,
        { tipo: 'iniciar_atencion', createdAt: new Date().toISOString() } as any,
      ]
      const estado = calcularEstadoFlujo(eventos)
      expect(estado.enAtencion).toBe(true)
      expect(estado.enEspera).toBe(false)
    })

    it('detecta no-show', () => {
      const eventos = [
        { tipo: 'check_in', createdAt: new Date(Date.now() - 600000).toISOString() } as any,
        { tipo: 'no_show', createdAt: new Date().toISOString() } as any,
      ]
      const estado = calcularEstadoFlujo(eventos)
      expect(estado.noShow).toBe(true)
      expect(estado.enEspera).toBe(false)
    })
  })

  describe('registrarEvento y obtenerHistorialCita', () => {
    it('registra evento localmente y en auditoria', async () => {
      const evento = await waitingRoomService.registrarEvento({
        appointmentId: 'c-test-1',
        tipo: 'check_in',
        doctorNombre: 'Dr. Silva',
        boxAsignado: 'Box 1',
      })

      expect(evento).not.toBeNull()
      expect(evento?.tipo).toBe('check_in')

      const historial = await waitingRoomService.obtenerHistorialCita('c-test-1')
      expect(historial.length).toBeGreaterThanOrEqual(1)
      expect(historial[0].appointmentId).toBe('c-test-1')
    })
  })
})
