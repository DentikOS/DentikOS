import { describe, it, expect, vi, beforeEach } from 'vitest'
import { confirmacionWhatsAppService, PLANTILLA_WHATSAPP_OFICIAL } from './confirmacionWhatsAppService'
import { useSesionStore } from '../../../../app/stores/sesionStore'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: {
    getState: vi.fn(),
  },
}))

describe('confirmacionWhatsAppService (BP05 §04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSesionStore.getState).mockReturnValue({
      userProfile: {
        clinicaId: 'clinica-test-uuid',
        id: 'user-test-uuid',
        nombreCompleto: 'Usuario Test',
        rol: 'admin',
      },
    } as any)
  })

  it('genera plantilla oficial de WhatsApp con formato correcto', () => {
    const mensaje = PLANTILLA_WHATSAPP_OFICIAL({
      nombrePaciente: 'Juan Pérez',
      fecha: 'martes 15 de octubre',
      hora: '10:00',
      profesional: 'Dr. Martínez',
      clinica: 'Studio Dental',
    })

    expect(mensaje).toContain('Estimado(a) Juan Pérez')
    expect(mensaje).toContain('martes 15 de octubre')
    expect(mensaje).toContain('10:00')
    expect(mensaje).toContain('Dr. Martínez')
    expect(mensaje).toContain('Studio Dental')
    expect(mensaje).toContain('1 para Confirmar asistencia')
    expect(mensaje).toContain('2 para Solicitar reagendamiento')
    expect(mensaje).toContain('DentikOS Clinical Gateway')
  })

  it('prepara URL de WhatsApp correctamente', () => {
    const url = confirmacionWhatsAppService.prepararMensajeWhatsApp({
      telefono: '+56912345678',
      nombrePaciente: 'Juan',
      fecha: '15 Oct',
      hora: '10:00',
      profesional: 'Dr. Test',
      clinica: 'Clínica',
    })

    expect(url).toContain('https://wa.me/56912345678')
    expect(url).toContain('text=')
  })

  it('registra una confirmación correctamente', async () => {
    const registro = await confirmacionWhatsAppService.registrarConfirmacion({
      appointmentId: 'apt-1',
      tipo: 'telefono',
    })

    expect(registro).not.toBeNull()
    expect(registro?.appointmentId).toBe('apt-1')
    expect(registro?.tipo).toBe('telefono')
    expect(registro?.canal).toBe('telefono')
    expect(registro?.registradoPorNombre).toBe('Usuario Test')
  })

  it('retorna null al registrar si no hay clinicaId', async () => {
    vi.mocked(useSesionStore.getState).mockReturnValue({
      userProfile: {},
    } as any)

    const registro = await confirmacionWhatsAppService.registrarConfirmacion({
      appointmentId: 'apt-1',
      tipo: 'telefono',
    })

    expect(registro).toBeNull()
  })

  it('filtra citas sin confirmar', async () => {
    const citas = [
      { id: 1, confirmation_status: 'pendiente', estado: 'Pendiente' },
      { id: 2, confirmation_status: 'confirmado', estado: 'Confirmada' },
      { id: 3, confirmation_status: 'pendiente', estado: 'Cancelada' },
      { id: 4, confirmation_status: 'enviado', estado: 'Pendiente' },
    ]

    const sinConfirmar = await confirmacionWhatsAppService.obtenerCitasSinConfirmar(citas)
    
    expect(sinConfirmar).toHaveLength(2)
    expect(sinConfirmar.map(c => c.id)).toEqual([1, 4])
  })

  it('id legacy sin mapeo remoto NO inserta en Supabase (sin throw)', async () => {
    const { supabase } = await import('../../../../infrastructure/supabase/supabaseClient')
    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(supabase.from).mockReturnValue({
      insert: insertSpy,
    } as any)

    const registro = await confirmacionWhatsAppService.registrarConfirmacion({
      appointmentId: '123456789',
      tipo: 'telefono',
    })

    expect(registro).not.toBeNull()
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
