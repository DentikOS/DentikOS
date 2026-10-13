/**
 * Tests unitarios de notificationService (F5-05).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../shared/utils/soundEffects', () => ({
  playSound: vi.fn(),
}))

describe('notificationService', () => {
  let notificationService

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const module = await import('./notificationService')
    notificationService = module.notificationService
    notificationService.limpiar()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('mostrar', () => {
    it('debe agregar notificación a la lista', () => {
      notificationService.mostrar('Test mensaje')
      expect(notificationService.listar()).toHaveLength(1)
    })

    it('debe generar ID único para cada notificación', () => {
      const r1 = notificationService.mostrar('Uno')
      const r2 = notificationService.mostrar('Dos')
      expect(r1.id).not.toBe(r2.id)
    })

    it('debe asignar tipo "info" por defecto', () => {
      notificationService.mostrar('Test')
      const lista = notificationService.listar()
      expect(lista[0].tipo).toBe('info')
    })

    it('debe aceptar tipo custom', () => {
      notificationService.mostrar('Error', { tipo: 'error' })
      expect(notificationService.listar()[0].tipo).toBe('error')
    })

    it('debe retornar función dismiss', () => {
      const { dismiss } = notificationService.mostrar('Test')
      expect(typeof dismiss).toBe('function')
      dismiss()
      expect(notificationService.listar()).toHaveLength(0)
    })

    it('debe auto-dismiss después de la duración', () => {
      notificationService.mostrar('Test', { duracion: 1000 })
      expect(notificationService.listar()).toHaveLength(1)

      vi.advanceTimersByTime(1000)

      expect(notificationService.listar()).toHaveLength(0)
    })

    it('debe respetar máximo de 3 visibles (remueve el más antiguo)', () => {
      notificationService.mostrar('Uno', { duracion: 0 })
      notificationService.mostrar('Dos', { duracion: 0 })
      notificationService.mostrar('Tres', { duracion: 0 })
      notificationService.mostrar('Cuatro', { duracion: 0 })

      const lista = notificationService.listar()
      expect(lista).toHaveLength(3)
      expect(lista[0].mensaje).toBe('Dos') // "Uno" fue removido
      expect(lista[2].mensaje).toBe('Cuatro')
    })

    it('debe usar duración según tipo si no se especifica', () => {
      notificationService.mostrar('Error', { tipo: 'error' })
      expect(notificationService.listar()).toHaveLength(1)

      vi.advanceTimersByTime(6999)
      expect(notificationService.listar()).toHaveLength(1)

      vi.advanceTimersByTime(2)
      expect(notificationService.listar()).toHaveLength(0)
    })
  })

  describe('ocultar', () => {
    it('debe remover notificación por ID', () => {
      const { id } = notificationService.mostrar('Test')
      notificationService.ocultar(id)
      expect(notificationService.listar()).toHaveLength(0)
    })

    it('no debe fallar si ID no existe', () => {
      expect(() => notificationService.ocultar('no-existe')).not.toThrow()
    })
  })

  describe('limpiar', () => {
    it('debe remover todas las notificaciones', () => {
      notificationService.mostrar('Uno')
      notificationService.mostrar('Dos')
      notificationService.mostrar('Tres')

      notificationService.limpiar()

      expect(notificationService.listar()).toHaveLength(0)
    })
  })

  describe('suscribir', () => {
    it('debe invocar callback cuando hay cambios', () => {
      const callback = vi.fn()
      notificationService.suscribir(callback)

      notificationService.mostrar('Test')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(expect.any(Array))
    })

    it('debe retornar función de desuscripción', () => {
      const callback = vi.fn()
      const unsub = notificationService.suscribir(callback)

      unsub()
      notificationService.mostrar('Test')

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('atajos', () => {
    it('info() debe crear notificación de tipo info', () => {
      notificationService.info('Mensaje')
      expect(notificationService.listar()[0].tipo).toBe('info')
    })

    it('success() debe crear notificación de tipo success', () => {
      notificationService.success('Mensaje')
      expect(notificationService.listar()[0].tipo).toBe('success')
    })

    it('warning() debe crear notificación de tipo warning', () => {
      notificationService.warning('Mensaje')
      expect(notificationService.listar()[0].tipo).toBe('warning')
    })

    it('error() debe crear notificación de tipo error', () => {
      notificationService.error('Mensaje')
      expect(notificationService.listar()[0].tipo).toBe('error')
    })
  })

  describe('Blueprint 03 §05 — severidades, auto-descarte y sonidos', () => {
    it('notificación crítica nunca se auto-descarta y reproduce sonido 220Hz (criticalNotif)', async () => {
      const { playSound } = await import('../../shared/utils/soundEffects')
      notificationService.mostrar('Alergia severa', {
        tipo: 'error',
        severity: 'critical',
        titulo: 'Alerta Crítica'
      })

      expect(playSound).toHaveBeenCalledWith('criticalNotif')
      expect(notificationService.listar()).toHaveLength(1)

      // Avanzar 24 horas y 48 horas
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)
      expect(notificationService.listar()).toHaveLength(1)

      vi.advanceTimersByTime(24 * 60 * 60 * 1000)
      expect(notificationService.listar()).toHaveLength(1)
    })

    it('notificación operativa se auto-descarta a las 24h y reproduce sonido 850Hz (infoNotif)', async () => {
      const { playSound } = await import('../../shared/utils/soundEffects')
      notificationService.mostrar('Cita confirmada', {
        tipo: 'success',
        severity: 'operational',
        titulo: 'Cita Confirmada'
      })

      expect(playSound).toHaveBeenCalledWith('infoNotif')
      expect(notificationService.listar()).toHaveLength(1)

      // Avanzar 23h59m
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1000)
      expect(notificationService.listar()).toHaveLength(1)

      // Cumplir 24h
      vi.advanceTimersByTime(1000)
      expect(notificationService.listar()).toHaveLength(0)
    })

    it('notificación informativa se auto-descarta a las 48h y permanece en silencio', async () => {
      const { playSound } = await import('../../shared/utils/soundEffects')
      notificationService.mostrar('Actualización de inventario', {
        tipo: 'info',
        severity: 'informational',
        titulo: 'Recordatorio'
      })

      expect(playSound).not.toHaveBeenCalled()
      expect(notificationService.listar()).toHaveLength(1)

      // Avanzar 24h (aún presente)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)
      expect(notificationService.listar()).toHaveLength(1)

      // Cumplir 48h (se descarta)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)
      expect(notificationService.listar()).toHaveLength(0)
    })
  })
})
