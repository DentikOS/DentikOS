import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProfileSync } from './useProfileSync'
import { useSesionStore } from '../../app/stores/sesionStore'
import { profileService } from '../../infrastructure/auth/profileService'

vi.mock('../../infrastructure/auth/profileService', () => ({
  profileService: {
    obtenerPerfil: vi.fn(),
    actualizarPerfil: vi.fn(),
    subirFoto: vi.fn(),
  },
}))

vi.mock('../../infrastructure/logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

describe('useProfileSync', () => {
  const mockActualizarPerfilStore = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useSesionStore.setState({
      userProfile: {
        email: 'doctor@dentikos.cl',
        nombreCompleto: 'Dr. Roberto Gómez',
        especialidad: 'Ortodoncia',
        telefono: '+56 9 1234 5678',
        rut: '12.345.678-9',
      },
      actualizarPerfil: mockActualizarPerfilStore,
    })
  })

  it('carga perfil desde Supabase al montar si hay sesión activa', async () => {
    vi.mocked(profileService.obtenerPerfil).mockResolvedValue({
      id: 'usr-1',
      email: 'doctor@dentikos.cl',
      fullName: 'Dr. Roberto Gómez (Sincronizado)',
      especialidad: 'Ortodoncia Avanzada',
      telefono: '+56 9 1111 2222',
      rut: '12.345.678-9',
      fotoUrl: 'https://cdn.dentikos.cl/avatar.png',
      biografia: 'Cirujano especialista',
      redesSociales: {},
    })

    renderHook(() => useProfileSync())

    // Esperar microtasks de Promise
    await act(async () => {
      await Promise.resolve()
    })

    expect(profileService.obtenerPerfil).toHaveBeenCalled()
    expect(mockActualizarPerfilStore).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreCompleto: 'Dr. Roberto Gómez (Sincronizado)',
        especialidad: 'Ortodoncia Avanzada',
        fotoUrl: 'https://cdn.dentikos.cl/avatar.png',
      })
    )
  })

  it('actualizar guarda en Supabase y propaga a sesionStore', async () => {
    vi.mocked(profileService.obtenerPerfil).mockResolvedValue(null)
    vi.mocked(profileService.actualizarPerfil).mockResolvedValue({
      id: 'usr-1',
      email: 'doctor@dentikos.cl',
      fullName: 'Dr. Roberto G.',
      especialidad: 'Implantología',
      telefono: '+56 9 3333 4444',
      rut: '12.345.678-9',
      fotoUrl: null,
      biografia: null,
      redesSociales: {},
    })

    const { result } = renderHook(() => useProfileSync())

    let res
    await act(async () => {
      res = await result.current.actualizar({
        fullName: 'Dr. Roberto G.',
        especialidad: 'Implantología',
      })
    })

    expect(res?.success).toBe(true)
    expect(profileService.actualizarPerfil).toHaveBeenCalledWith({
      fullName: 'Dr. Roberto G.',
      especialidad: 'Implantología',
    })
    expect(mockActualizarPerfilStore).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreCompleto: 'Dr. Roberto G.',
        especialidad: 'Implantología',
      })
    )
  })

  it('subirFoto sube imagen y actualiza perfil con fotoUrl', async () => {
    vi.mocked(profileService.obtenerPerfil).mockResolvedValue(null)
    vi.mocked(profileService.subirFoto).mockResolvedValue('https://storage.supabase.co/foto.png')
    vi.mocked(profileService.actualizarPerfil).mockResolvedValue({
      id: 'usr-1',
      email: 'doctor@dentikos.cl',
      fullName: 'Dr. Roberto Gómez',
      especialidad: 'Ortodoncia',
      telefono: null,
      rut: null,
      fotoUrl: 'https://storage.supabase.co/foto.png',
      biografia: null,
      redesSociales: {},
    })

    const { result } = renderHook(() => useProfileSync())
    const file = new File(['abc'], 'test.png', { type: 'image/png' })

    let res
    await act(async () => {
      res = await result.current.subirFoto(file)
    })

    expect(res?.success).toBe(true)
    expect(res?.fotoUrl).toBe('https://storage.supabase.co/foto.png')
    expect(profileService.actualizarPerfil).toHaveBeenCalledWith({
      fotoUrl: 'https://storage.supabase.co/foto.png',
    })
    expect(mockActualizarPerfilStore).toHaveBeenCalledWith({
      fotoUrl: 'https://storage.supabase.co/foto.png',
    })
  })
})
