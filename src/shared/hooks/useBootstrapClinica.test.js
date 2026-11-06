import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBootstrapClinica } from './useBootstrapClinica'

// Mock de authService preservando getClinicaActivaSync
vi.mock('../../infrastructure/auth/authService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    bootstrapClinica: vi.fn(),
    invitarMiembro: vi.fn(),
    supabaseSignOut: vi.fn().mockResolvedValue(undefined),
    getClinicaActivaSync: vi.fn(() => 'clinica-123'),
  }
})

// Mock de sedesService
vi.mock('../../domains/organization/clinic/services/sedesService', () => ({
  sedesService: {
    guardarSedes: vi.fn(() => true),
    establecerSedeActiva: vi.fn(),
    sincronizarSedesDesdeSupabase: vi.fn().mockResolvedValue([{ id: 'sede-1', estado: 'activa', esPrincipal: true }]),
    obtenerSedes: vi.fn(() => []),
  },
}))

vi.mock('../../domains/organization/clinic/services/boxesClinicosService', () => ({
  boxesClinicosService: { crear: vi.fn().mockResolvedValue({ id: 'box-1' }) },
}))

vi.mock('../../domains/organization/prestations/services/prestacionesSupabaseService', () => ({
  prestacionesSupabaseService: { importarPlantilla: vi.fn().mockResolvedValue([]) },
}))

// Mock de clinicStorageService
vi.mock('../../domains/organization/clinic/services/clinicStorageService', () => ({
  clinicStorageService: {
    sincronizarClinicaDesdeSupabase: vi.fn().mockResolvedValue({ nombreClinica: 'Clínica Dental Pro' }),
    obtenerClinica: vi.fn(() => ({ nombreClinica: 'Clínica Dental Pro' })),
    guardarClinicaCompleta: vi.fn().mockResolvedValue(true),
    guardarConfiguracionConvenios: vi.fn().mockResolvedValue(true),
    guardarConfiguracionFinanciera: vi.fn().mockResolvedValue(true),
  },
}))

// Mock de logger
vi.mock('../../infrastructure/logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

import { bootstrapClinica, invitarMiembro, supabaseSignOut } from '../../infrastructure/auth/authService'
import { sedesService } from '../../domains/organization/clinic/services/sedesService'
import { clinicStorageService } from '../../domains/organization/clinic/services/clinicStorageService'
import { boxesClinicosService } from '../../domains/organization/clinic/services/boxesClinicosService'
import { prestacionesSupabaseService } from '../../domains/organization/prestations/services/prestacionesSupabaseService'

const completarDatosRequeridos = (actualizarCampo) => {
  actualizarCampo('nombre', 'Clínica Odontológica Central')
  actualizarCampo('rutEmpresa', '76.123.456-7')
  actualizarCampo('giroComercial', 'Servicios odontológicos')
  actualizarCampo('direccion', 'Av. Providencia 1234')
  actualizarCampo('comuna', 'Providencia')
  actualizarCampo('region', 'Región Metropolitana')
  actualizarCampo('telefono', '+56 9 1234 5678')
  actualizarCampo('emailContacto', 'contacto@clinica.cl')
}

describe('useBootstrapClinica (8 pasos)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invitarMiembro).mockResolvedValue({ success: true, invitacionId: 'invitacion-1' })
    vi.mocked(sedesService.guardarSedes).mockReturnValue(true)
    vi.mocked(sedesService.sincronizarSedesDesdeSupabase).mockResolvedValue([
      { id: 'sede-1', estado: 'activa', esPrincipal: true },
    ])
  })

  it('debe inicializar en paso 1 con tipo clínica y datos vacíos', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    expect(result.current.paso).toBe(1)
    expect(result.current.tipoActividad).toBe('clinica')
    expect(result.current.datos.nombre).toBe('')
    expect(result.current.procesando).toBe(false)
    expect(result.current.errorGeneral).toBeNull()
    expect(result.current.completado).toBe(false)
  })

  it('debe permitir cambiar tipo de actividad en paso 1', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => {
      result.current.setTipoActividad('individual')
    })

    expect(result.current.tipoActividad).toBe('individual')
  })

  it('valida los datos de la clínica antes de avanzar al paso 2', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => {
      result.current.avanzarPaso()
    })

    expect(result.current.paso).toBe(1)
    expect(result.current.errores.nombre).toContain('3 caracteres')
    act(() => completarDatosRequeridos(result.current.actualizarCampo))
    act(() => result.current.avanzarPaso())
    expect(result.current.paso).toBe(2)
  })

  it('no exige datos de clínica otra vez en preferencias regionales', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => completarDatosRequeridos(result.current.actualizarCampo))
    act(() => result.current.avanzarPaso())
    expect(result.current.paso).toBe(2)

    act(() => result.current.avanzarPaso())
    expect(result.current.paso).toBe(3)
  })

  it('crea la sucursal principal al llegar al paso de sedes', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => completarDatosRequeridos(result.current.actualizarCampo))
    act(() => result.current.avanzarPaso())
    act(() => result.current.avanzarPaso())
    act(() => result.current.avanzarPaso())
    expect(result.current.paso).toBe(4)
    expect(result.current.sedes.length).toBeGreaterThan(0)
  })

  it('sincroniza catálogo y boxes de la plantilla después de revisar los precios', async () => {
    bootstrapClinica.mockResolvedValue({ success: true, clinicaId: 'clinica-123' })
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => {
      completarDatosRequeridos(result.current.actualizarCampo)
      result.current.seleccionarPlantilla('general')
    })
    expect(Object.keys(result.current.preciosPlantilla)).toHaveLength(20)

    await act(async () => { await result.current.handleSubmit() })

    expect(boxesClinicosService.crear).toHaveBeenCalledTimes(2)
    expect(prestacionesSupabaseService.importarPlantilla).toHaveBeenCalledWith('general', expect.arrayContaining([
      expect.objectContaining({ codigoInterno: 'PRE-01', precioParticular: 50000, precioFonasa: null }),
    ]))
    expect(result.current.boxesCreados).toBe(2)
    expect(result.current.catalogoPlantillaAplicado).toBe(true)
  })

  it('debe permitir agregar y eliminar sedes en paso 4', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => {
      result.current.agregarSede({
        nombre: 'Sucursal Las Condes',
        direccion: 'Apoquindo 4500',
        comuna: 'Las Condes',
        region: 'Metropolitana',
        activa: true,
      })
    })

    expect(result.current.sedes).toHaveLength(1)
    expect(result.current.sedes[0].nombre).toBe('Sucursal Las Condes')

    act(() => {
      result.current.eliminarSede(0)
    })

    expect(result.current.sedes).toHaveLength(0)
  })

  it('debe permitir agregar y eliminar miembros en paso 5', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => {
      result.current.agregarMiembro({
        email: 'colega@clinica.cl',
        rol: 'dentista',
        sedes: ['Sede Principal'],
      })
    })

    expect(result.current.equipo).toHaveLength(1)
    expect(result.current.equipo[0].email).toBe('colega@clinica.cl')

    act(() => {
      result.current.eliminarMiembro(0)
    })

    expect(result.current.equipo).toHaveLength(0)
  })

  it('debe retroceder pasos correctamente', () => {
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    act(() => completarDatosRequeridos(result.current.actualizarCampo))
    act(() => result.current.avanzarPaso())
    expect(result.current.paso).toBe(2)

    act(() => result.current.retrocederPaso())
    expect(result.current.paso).toBe(1)
  })

  it('debe crear clínica y sedes exitosamente en handleSubmit', async () => {
    bootstrapClinica.mockResolvedValue({ success: true, clinicaId: 'clinica-123' })
    const onComplete = vi.fn()

    const { result } = renderHook(() => useBootstrapClinica(onComplete))

    act(() => {
      result.current.actualizarCampo('nombre', 'Clínica Dental Pro')
      result.current.actualizarCampo('direccion', 'Calle Principal 100')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(bootstrapClinica).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Clínica Dental Pro',
        direccion: 'Calle Principal 100',
      })
    )
    expect(clinicStorageService.sincronizarClinicaDesdeSupabase).toHaveBeenCalledWith('clinica-123')
    expect(sedesService.guardarSedes).toHaveBeenCalled()
    expect(sedesService.sincronizarSedesDesdeSupabase).toHaveBeenCalledWith('clinica-123')
    expect(sedesService.establecerSedeActiva).toHaveBeenCalledWith('sede-1')
    expect(result.current.sucursalesSincronizadas).toBe(true)
    expect(result.current.completado).toBe(true)
    expect(result.current.procesando).toBe(false)
    expect(invitarMiembro).not.toHaveBeenCalled()
  })

  it('crea las invitaciones del equipo luego de crear la clínica', async () => {
    bootstrapClinica.mockResolvedValue({ success: true, clinicaId: 'clinica-123' })
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))
    act(() => {
      result.current.agregarMiembro({ email: 'Dentista@clinica.cl', rol: 'dentista', sedes: [] })
      result.current.agregarMiembro({ email: 'recepcion@clinica.cl', rol: 'recepcion', sedes: [] })
    })

    await act(async () => { await result.current.handleSubmit() })

    expect(invitarMiembro).toHaveBeenNthCalledWith(1, 'dentista@clinica.cl', 'dentista')
    expect(invitarMiembro).toHaveBeenNthCalledWith(2, 'recepcion@clinica.cl', 'recepcion')
    expect(result.current.invitacionesCreadas).toBe(2)
    expect(result.current.invitacionesPendientes).toBe(0)
    expect(result.current.completado).toBe(true)
  })

  it('evita correos duplicados y deja visibles las invitaciones fallidas para reintento', async () => {
    bootstrapClinica.mockResolvedValue({ success: true, clinicaId: 'clinica-123' })
    vi.mocked(invitarMiembro).mockResolvedValueOnce({ success: true, invitacionId: 'invitacion-1' })
      .mockResolvedValueOnce({ success: false, error: 'Invitación rechazada' })
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))
    act(() => {
      result.current.agregarMiembro({ email: 'doctor@clinica.cl', rol: 'dentista', sedes: [] })
      result.current.agregarMiembro({ email: 'doctor@clinica.cl', rol: 'asistente', sedes: [] })
      result.current.agregarMiembro({ email: 'recepcion@clinica.cl', rol: 'recepcion', sedes: [] })
    })

    await act(async () => { await result.current.handleSubmit() })

    expect(invitarMiembro).toHaveBeenCalledTimes(2)
    expect(result.current.invitacionesCreadas).toBe(1)
    expect(result.current.invitacionesPendientes).toBe(2)
    expect(result.current.completado).toBe(true)
  })

  it('mantiene el alta completada y deja visible la sucursal pendiente si la nube falla', async () => {
    bootstrapClinica.mockResolvedValue({ success: true, clinicaId: 'clinica-123' })
    vi.mocked(sedesService.sincronizarSedesDesdeSupabase).mockRejectedValue(new Error('Sin conexión'))
    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    await act(async () => { await result.current.handleSubmit() })

    expect(result.current.completado).toBe(true)
    expect(result.current.sucursalesSincronizadas).toBe(false)
    expect(result.current.sucursalesRegistradas).toBe(1)
    expect(result.current.errorSincronizacionSedes).toBe('Sin conexión')
  })

  it('debe manejar error al fallar bootstrapClinica', async () => {
    bootstrapClinica.mockResolvedValue({
      success: false,
      error: 'Error de prueba en el servidor',
    })

    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.errorGeneral).toBe('Error de prueba en el servidor')
    expect(result.current.completado).toBe(false)
    expect(result.current.procesando).toBe(false)
  })

  it('debe cerrar sesión y recargar al cancelar configuración', async () => {
    const reloadMock = vi.fn()
    vi.stubGlobal('location', { reload: reloadMock })

    const { result } = renderHook(() => useBootstrapClinica(vi.fn()))

    await act(async () => {
      await result.current.cancelarConfiguracion()
    })

    expect(supabaseSignOut).toHaveBeenCalled()
    expect(reloadMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
