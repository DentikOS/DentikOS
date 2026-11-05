import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clinicStorageService } from './clinicStorageService'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'
import { notificationService } from '../../../../infrastructure/notification/notificationService'
import { useSesionStore } from '../../../../app/stores/sesionStore'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('../../../../infrastructure/notification/notificationService', () => ({
  notificationService: {
    mostrar: vi.fn(),
  },
}))

describe('clinicStorageService - Sincronización y Fail-Safe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('clinica_active_user', 'admin@test.cl')
    localStorage.setItem('profile_admin@test.cl', JSON.stringify({ clinicaId: 'clinica-123' }))
    useSesionStore.setState({ clinicaActual: 'clinica-123' })
  })

  it('sincronizarClinicaDesdeSupabase: lee de Supabase, escribe en caché y emite evento', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const filaDb = {
      id: 'clinica-123',
      nombre: 'Clínica Dental Sincronizada',
      razon_social: 'Servicios Dentales SpA',
      rut_empresa: '76.123.456-7',
      direccion: 'Av. Providencia 100',
      ciudad: 'Santiago, Chile',
      comuna: 'Providencia',
      region: 'Región Metropolitana',
      giro_comercial: 'Servicios odontológicos',
      sitio_web: 'https://clinica.example',
      instagram: '@clinica',
      facebook: 'facebook.com/clinica',
      registro_seremi: 'SEREMI-123',
      registro_isp: 'ISP-456',
      idioma_documentos: 'es-CL',
      moneda: 'CLP',
      configuracion_documentos: { diseno: 'moderno', colorTitulos: '#123456' },
      eslogan: 'Salud para todos',
      zona_horaria: 'America/Santiago',
      logo_url: 'https://cdn.example/logo.png',
    }

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: filaDb, error: null }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: selectMock,
    })

    const resultado = await clinicStorageService.sincronizarClinicaDesdeSupabase('clinica-123')

    expect(resultado?.nombreClinica).toBe('Clínica Dental Sincronizada')
    expect(resultado?.razonSocial).toBe('Servicios Dentales SpA')
    expect(resultado?.ciudad).toBe('Santiago, Chile')
    expect(resultado?.comuna).toBe('Providencia')
    expect(resultado?.region).toBe('Región Metropolitana')
    expect(resultado?.giroComercial).toBe('Servicios odontológicos')
    expect(resultado?.sitioWeb).toBe('https://clinica.example')
    expect(resultado?.instagram).toBe('@clinica')
    expect(resultado?.facebook).toBe('facebook.com/clinica')
    expect(resultado?.registroSeremi).toBe('SEREMI-123')
    expect(resultado?.registroIsp).toBe('ISP-456')
    expect(resultado?.idiomaDocumentos).toBe('es-CL')
    expect(resultado?.moneda).toBe('CLP')
    expect(resultado?.configuracionMembrete).toMatchObject({ diseno: 'moderno', colorTitulos: '#123456' })
    expect(resultado?.eslogan).toBe('Salud para todos')
    expect(resultado?.zonaHoraria).toBe('America/Santiago')
    expect(resultado?.logoUrl).toBe('https://cdn.example/logo.png')
    expect(clinicStorageService.obtenerClinica()?.nombreClinica).toBe('Clínica Dental Sincronizada')
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'clinica_actualizada',
        detail: expect.objectContaining({
          clinicaId: 'clinica-123',
          nombre: 'Clínica Dental Sincronizada',
          datos: expect.objectContaining({ ciudad: 'Santiago, Chile' }),
        }),
      })
    )
  })

  it('guardarClinicaCompleta con error 403 (no admin): muestra toast de error y NO toca caché', async () => {
    // Configurar estado inicial en caché
    clinicStorageService.guardarClinica({
      nombreClinica: 'Clínica Original Intacta',
    })
    expect(clinicStorageService.obtenerClinica()?.nombreClinica).toBe('Clínica Original Intacta')

    // Mockear Supabase devolviendo 0 filas por RLS (código 403 / sin permisos)
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [], // 0 filas actualizadas
          error: null,
          status: 403,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      update: updateMock,
    })

    const ok = await clinicStorageService.guardarClinicaCompleta('clinica-123', {
      nombreClinica: 'Intento de Cambio Ilegítimo',
    })

    expect(ok).toBe(false)
    expect(notificationService.mostrar).toHaveBeenCalledWith(
      'Solo administradores pueden editar datos de la clínica',
      expect.objectContaining({ tipo: 'error' })
    )
    // Fail-safe verificado: el caché NO fue modificado
    expect(clinicStorageService.obtenerClinica()?.nombreClinica).toBe('Clínica Original Intacta')
  })

  it('guardarClinicaCompleta exitoso: persiste en Supabase, actualiza caché y emite evento', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'clinica-123', nombre: 'Clínica Actualizada Admin' }],
          error: null,
          status: 200,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      update: updateMock,
    })

    const ok = await clinicStorageService.guardarClinicaCompleta('clinica-123', {
      nombreClinica: 'Clínica Actualizada Admin',
      razonSocial: 'Servicios Dentales SpA',
      ciudad: 'Santiago, Chile',
      comuna: 'Providencia',
      region: 'Región Metropolitana',
      giroComercial: 'Servicios odontológicos',
      sitioWeb: 'https://clinica.example',
      instagram: '@clinica',
      facebook: 'facebook.com/clinica',
      registroSeremi: 'SEREMI-123',
      registroIsp: 'ISP-456',
      idiomaDocumentos: 'es-CL',
      moneda: 'CLP',
      configuracionMembrete: { diseno: 'minimalista', colorTitulos: '#123456' },
      eslogan: 'Salud para todos',
      zonaHoraria: 'America/Santiago',
      logoUrl: 'https://pub-account.r2.dev/clinic-logo.png',
    })

    expect(ok).toBe(true)
    expect(updateMock).toHaveBeenCalledWith({
      nombre: 'Clínica Actualizada Admin',
      razon_social: 'Servicios Dentales SpA',
      ciudad: 'Santiago, Chile',
      comuna: 'Providencia',
      region: 'Región Metropolitana',
      giro_comercial: 'Servicios odontológicos',
      sitio_web: 'https://clinica.example',
      instagram: '@clinica',
      facebook: 'facebook.com/clinica',
      registro_seremi: 'SEREMI-123',
      registro_isp: 'ISP-456',
      idioma_documentos: 'es-CL',
      moneda: 'CLP',
      configuracion_documentos: { diseno: 'minimalista', colorTitulos: '#123456' },
      eslogan: 'Salud para todos',
      zona_horaria: 'America/Santiago',
      logo_url: 'https://pub-account.r2.dev/clinic-logo.png',
    })
    expect(clinicStorageService.obtenerClinica()?.nombreClinica).toBe('Clínica Actualizada Admin')
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'clinica_actualizada',
        detail: expect.objectContaining({
          clinicaId: 'clinica-123',
          nombre: 'Clínica Actualizada Admin',
        }),
      })
    )
  })

  it('no intenta sincronizar un logo data URL en Supabase', async () => {
    const ok = await clinicStorageService.guardarClinicaCompleta('clinica-123', {
      nombreClinica: 'Clínica Central',
      logoUrl: 'data:image/png;base64,AAAA',
    })

    expect(ok).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(clinicStorageService.obtenerClinica()).toBeNull()
  })
})
