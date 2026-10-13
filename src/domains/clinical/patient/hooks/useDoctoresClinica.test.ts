import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDoctoresClinica } from './useDoctoresClinica'
import * as authService from '../../../../infrastructure/auth/authService'
import * as supabaseClient from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'

describe('useDoctoresClinica', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSesionStore.setState({
      userProfile: {
        email: 'doctor@clinica.cl',
        nombreCompleto: 'Dr. Local Fallback',
        rol: 'dentista',
        clinicaId: 'clinica-1',
      },
      clinicaActual: 'clinica-1',
    })
  })

  it('carga doctores automáticamente al montar cuando Supabase está configurado', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true)
    vi.spyOn(authService, 'listarMiembros').mockResolvedValue({
      success: true,
      miembros: [
        {
          id: 'user-uuid-1',
          user_id: 'user-uuid-1',
          nombre: 'Dra. Elena Gómez',
          email: 'elena@clinica.cl',
          rol: 'dentista',
          activo: true,
        },
        {
          id: 'user-uuid-2',
          user_id: 'user-uuid-2',
          nombre: 'Dr. Roberto Soto',
          email: 'roberto@clinica.cl',
          rol: 'admin',
          activo: true,
        },
        {
          id: 'user-uuid-3',
          user_id: 'user-uuid-3',
          nombre: 'Asistente Juan',
          email: 'juan@clinica.cl',
          rol: 'recepcion',
          activo: true,
        },
      ],
    } as any)

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { result } = renderHook(() => useDoctoresClinica())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.doctores).toHaveLength(2)
      expect(result.current.doctores[0]).toEqual({
        id: 'user-uuid-1',
        nombre: 'Dra. Elena Gómez',
        rol: 'dentista',
      })
    })

    expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] useDoctoresClinica: cargando doctores')
    consoleSpy.mockRestore()
  })

  it('utiliza datos locales cuando Supabase no está configurado', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(false)

    const { result } = renderHook(() => useDoctoresClinica())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.doctores).toEqual([
        {
          id: 'doctor@clinica.cl',
          nombre: 'Dr. Local Fallback',
          rol: 'dentista',
        },
      ])
    })
  })

  it('maneja errores y hace fallback a datos locales', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true)
    vi.spyOn(authService, 'listarMiembros').mockRejectedValue(new Error('Fallo de red'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useDoctoresClinica())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('Fallo de red')
      expect(result.current.doctores).toHaveLength(1)
    })

    errorSpy.mockRestore()
  })
})
