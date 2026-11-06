/**
 * F7-10: Tests de setClinicaActiva, getClinicaActiva, listarMisClinicas
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de supabaseClient
vi.mock('../supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    auth: {
      updateUser: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      getUser: vi.fn()
    },
    from: vi.fn()
  }
}))

import { setClinicaActiva, getClinicaActiva, listarMisClinicas } from './authService'
import { supabase } from '../supabase/supabaseClient'

describe('F7-10: setClinicaActiva', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe actualizar user_metadata.clinica_id', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.refreshSession.mockResolvedValue({ 
      data: { session: { user: { user_metadata: { clinica_id: 'clinica-123' } } } }, 
      error: null 
    })

    const result = await setClinicaActiva('clinica-123')

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { clinica_id: 'clinica-123' }
    })
    expect(supabase.auth.refreshSession).toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  it('debe retornar error si clinicaId es vacío', async () => {
    const result = await setClinicaActiva('')
    expect(result.success).toBe(false)
    expect(result.error).toContain('requerido')
  })

  it('debe retornar error si updateUser falla', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: new Error('DB error') })

    const result = await setClinicaActiva('clinica-123')
    expect(result.success).toBe(false)
  })
})

describe('F7-10: getClinicaActiva', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar clinica_id desde user_metadata', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { user_metadata: { clinica_id: 'clinica-456' } } },
      error: null
    })

    const result = await getClinicaActiva()
    expect(result).toBe('clinica-456')
  })

  it('debe retornar null si no hay clinica_id', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null
    })

    const result = await getClinicaActiva()
    expect(result).toBeNull()
  })

  it('debe retornar null si no hay usuario', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await getClinicaActiva()
    expect(result).toBeNull()
  })
})

describe('F7-10: listarMisClinicas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe listar clínicas con membresía activa', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    })

    const _mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { clinica_id: 'c1', rol: 'admin', clinicas: { nombre: 'Clínica A' } },
        { clinica_id: 'c2', rol: 'dentista', clinicas: { nombre: 'Clínica B' } }
      ],
      error: null
    })
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder })
    
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: mockOrder
          })
        })
      })
    })

    const result = await listarMisClinicas()
    expect(result).toHaveLength(2)
    expect(result[0].nombre).toBe('Clínica A')
    expect(result[0].rol).toBe('admin')
  })

  it('debe retornar array vacío si no hay usuario', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await listarMisClinicas()
    expect(result).toEqual([])
  })
})
