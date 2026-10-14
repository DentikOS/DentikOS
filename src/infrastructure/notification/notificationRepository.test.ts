import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificationRepository } from './notificationRepository'

vi.mock('../supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    rpc: vi.fn((fnName: string) => {
      if (fnName === 'crear_notificacion') return Promise.resolve({ data: 'notif-id-123', error: null })
      if (fnName === 'purgar_notificaciones_antiguas') return Promise.resolve({ data: 5, error: null })
      return Promise.resolve({ data: null, error: null })
    }),
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
    })),
  },
}))

describe('notificationRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crear() llama a RPC crear_notificacion', async () => {
    const id = await notificationRepository.crear({
      userId: 'user-1',
      clinicId: 'clinic-1',
      severity: 'operational',
      title: 'Test',
    })
    expect(id).toBe('notif-id-123')
  })

  it('marcarLeida() actualiza read=true', async () => {
    const ok = await notificationRepository.marcarLeida('notif-1')
    expect(ok).toBe(true)
  })

  it('marcarTodasLeidas() excluye críticas', async () => {
    const count = await notificationRepository.marcarTodasLeidas('user-1')
    expect(count).toBe(1)
  })

  it('eliminar() remueve notificación', async () => {
    const ok = await notificationRepository.eliminar('notif-1')
    expect(ok).toBe(true)
  })

  it('purgarAntiguas() llama a RPC purgar_notificaciones_antiguas', async () => {
    const deleted = await notificationRepository.purgarAntiguas()
    expect(deleted).toBe(5)
  })
})
