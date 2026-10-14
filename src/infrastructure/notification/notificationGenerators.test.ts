import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificationGenerators } from './notificationGenerators'
import { notificationRepository } from './notificationRepository'

vi.mock('./notificationRepository', () => ({
  notificationRepository: {
    crear: vi.fn().mockResolvedValue('notif-id-123'),
  },
}))

vi.mock('../logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

describe('notificationGenerators', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(notificationRepository.crear).mockResolvedValue('notif-id-123')
  })

  describe('alergiaDetectada (crítica)', () => {
    it('crea notificación con severidad critical', async () => {
      const result = await notificationGenerators.alergiaDetectada({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-1',
        pacienteNombre: 'Juan Pérez',
        alergeno: 'Penicilina',
        gravedad: 'severa',
      })

      expect(result.id).toBe('notif-id-123')
      expect(result.deduplicado).toBe(false)
      expect(notificationRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          title: expect.stringContaining('Penicilina'),
          expiresInHours: null,
        })
      )
    })

    it('deduplica en 24h', async () => {
      await notificationGenerators.alergiaDetectada({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-1',
        pacienteNombre: 'Juan Pérez',
        alergeno: 'Penicilina',
        gravedad: 'severa',
      })

      const result2 = await notificationGenerators.alergiaDetectada({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-1',
        pacienteNombre: 'Juan Pérez',
        alergeno: 'Penicilina',
        gravedad: 'severa',
      })

      expect(result2.deduplicado).toBe(true)
      expect(result2.id).toBeNull()
      expect(notificationRepository.crear).toHaveBeenCalledTimes(1)
    })
  })

  describe('pagoVencido (crítica)', () => {
    it('crea notificación crítica para pago vencido', async () => {
      const result = await notificationGenerators.pagoVencido({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-1',
        pacienteNombre: 'Carlos Silva',
        monto: 150000,
        diasVencido: 35,
        facturaId: 'fac-101',
      })

      expect(result.id).toBe('notif-id-123')
      expect(result.deduplicado).toBe(false)
      expect(notificationRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          title: expect.stringContaining('150.000'),
          expiresInHours: null,
        })
      )
    })

    it('deduplica pago vencido repetido', async () => {
      await notificationGenerators.pagoVencido({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-1',
        pacienteNombre: 'Carlos Silva',
        monto: 150000,
        diasVencido: 35,
        facturaId: 'fac-101',
      })

      const result2 = await notificationGenerators.pagoVencido({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-1',
        pacienteNombre: 'Carlos Silva',
        monto: 150000,
        diasVencido: 35,
        facturaId: 'fac-101',
      })

      expect(result2.deduplicado).toBe(true)
      expect(result2.id).toBeNull()
    })
  })

  describe('stockCritico (operativa)', () => {
    it('crea notificación con expiración 24h', async () => {
      const result = await notificationGenerators.stockCritico({
        userId: 'user-1',
        clinicId: 'clinic-1',
        productoId: 'prod-1',
        productoNombre: 'Guantes látex',
        stockActual: 5,
        stockMinimo: 20,
      })

      expect(result.deduplicado).toBe(false)
      expect(notificationRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'operational',
          expiresInHours: 24,
        })
      )
    })
  })

  describe('citaConfirmada (operativa)', () => {
    it('crea notificación de cita confirmada con 24h de expiración', async () => {
      const result = await notificationGenerators.citaConfirmada({
        userId: 'user-1',
        clinicId: 'clinic-1',
        citaId: 'cita-55',
        pacienteNombre: 'Ana Soto',
        fecha: '15/10/2026',
        hora: '10:30',
        motivo: 'Limpieza',
      })

      expect(result.deduplicado).toBe(false)
      expect(notificationRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'operational',
          expiresInHours: 24,
          title: '✅ Cita confirmada',
        })
      )
    })
  })

  describe('cicloEsterilizacion (operativa)', () => {
    it('crea notificación de autoclave con 24h de expiración', async () => {
      const result = await notificationGenerators.cicloEsterilizacion({
        userId: 'user-1',
        clinicId: 'clinic-1',
        cicloId: 'ciclo-9',
        autoclaveNombre: 'Autoclave B',
        instrumentosCount: 15,
        duracion: '45m',
      })

      expect(result.deduplicado).toBe(false)
      expect(notificationRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'operational',
          expiresInHours: 24,
          title: '🧪 Esterilización completada',
        })
      )
    })
  })

  describe('cumpleanosPaciente (informativa)', () => {
    it('crea notificación silenciosa con expiración 48h', async () => {
      const result = await notificationGenerators.cumpleanosPaciente({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-1',
        pacienteNombre: 'María González',
        edad: 45,
      })

      expect(result.deduplicado).toBe(false)
      expect(notificationRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'informational',
          expiresInHours: 48,
        })
      )
    })
  })

  describe('recordatorioCita (informativa)', () => {
    it('crea notificación de recordatorio con 48h de expiración', async () => {
      const result = await notificationGenerators.recordatorioCita({
        userId: 'user-1',
        clinicId: 'clinic-1',
        citaId: 'cita-102',
        pacienteNombre: 'Diego Morales',
        fecha: '14/10/2026',
        hora: '16:00',
      })

      expect(result.deduplicado).toBe(false)
      expect(notificationRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'informational',
          expiresInHours: 48,
        })
      )
    })
  })

  it('todos los generadores están exportados', () => {
    expect(notificationGenerators.alergiaDetectada).toBeDefined()
    expect(notificationGenerators.pagoVencido).toBeDefined()
    expect(notificationGenerators.stockCritico).toBeDefined()
    expect(notificationGenerators.citaConfirmada).toBeDefined()
    expect(notificationGenerators.cicloEsterilizacion).toBeDefined()
    expect(notificationGenerators.cumpleanosPaciente).toBeDefined()
    expect(notificationGenerators.recordatorioCita).toBeDefined()
  })
})
