/**
 * F7-11b: Tests de bootstrap de clínica nueva (self-service)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de supabaseClient
vi.mock('../supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    rpc: vi.fn(),
    auth: {
      updateUser: vi.fn(),
      getSession: vi.fn()
    }
  }
}))

import { 
  verificarBootstrapNecesario, 
  bootstrapClinica
} from './authService'
import { supabase } from '../supabase/supabaseClient'

describe('F7-11b: verificarBootstrapNecesario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar necesario=true si el usuario no tiene clínica', async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null })

    const result = await verificarBootstrapNecesario()

    expect(result.necesario).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith('verificar_bootstrap_necesario')
  })

  it('debe retornar necesario=false si el usuario tiene clínica', async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null })

    const result = await verificarBootstrapNecesario()

    expect(result.necesario).toBe(false)
  })

  it('debe manejar error de red', async () => {
    supabase.rpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'Network error' } 
    })

    const result = await verificarBootstrapNecesario()

    expect(result.necesario).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('debe manejar excepciones', async () => {
    supabase.rpc.mockRejectedValue(new Error('Connection failed'))

    const result = await verificarBootstrapNecesario()

    expect(result.necesario).toBe(false)
    expect(result.error).toBe('Connection failed')
  })
})

describe('F7-11b: bootstrapClinica', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock de setClinicaActiva para no interferir
    vi.mock('./authService', async () => {
      const actual = await vi.importActual('./authService')
      return {
        ...actual,
        setClinicaActiva: vi.fn().mockResolvedValue({ success: true })
      }
    })
  })

  it('debe crear clínica exitosamente', async () => {
    supabase.rpc.mockResolvedValue({ 
      data: 'clinica-uuid-123', 
      error: null 
    })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getSession.mockResolvedValue({ 
      data: { session: { user: { id: 'user-123' } } },
      error: null 
    })

    const result = await bootstrapClinica({
      nombre: 'Clínica Test',
      rutEmpresa: '76.123.456-7',
      direccion: 'Av. Siempre Viva 123',
      telefono: '+56912345678',
      emailContacto: 'contacto@test.com'
    })

    expect(result.success).toBe(true)
    expect(result.clinicaId).toBe('clinica-uuid-123')
    expect(supabase.rpc).toHaveBeenCalledWith('bootstrap_clinica', {
      p_nombre: 'Clínica Test',
      p_rut_empresa: '76.123.456-7',
      p_direccion: 'Av. Siempre Viva 123',
      p_telefono: '+56912345678',
      p_email_contacto: 'contacto@test.com'
    })
  })

  it('debe crear clínica sin campos opcionales', async () => {
    supabase.rpc.mockResolvedValue({ data: 'clinica-uuid-456', error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getSession.mockResolvedValue({ 
      data: { session: { user: { id: 'user-123' } } },
      error: null 
    })

    const result = await bootstrapClinica({ nombre: 'Clínica Básica' })

    expect(result.success).toBe(true)
    expect(result.clinicaId).toBe('clinica-uuid-456')
    expect(supabase.rpc).toHaveBeenCalledWith('bootstrap_clinica', {
      p_nombre: 'Clínica Básica',
      p_rut_empresa: null,
      p_direccion: null,
      p_telefono: null,
      p_email_contacto: null
    })
  })

  it('debe rechazar nombre vacío', async () => {
    const result = await bootstrapClinica({ nombre: '' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Nombre de clínica requerido')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('debe rechazar nombre muy corto', async () => {
    const result = await bootstrapClinica({ nombre: 'AB' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Nombre de clínica requerido')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('debe rechazar nombre muy largo', async () => {
    const nombreLargo = 'A'.repeat(101)
    const result = await bootstrapClinica({ nombre: nombreLargo })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Nombre de clínica muy largo')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('debe rechazar datos inválidos', async () => {
    const result = await bootstrapClinica(null)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Datos de clínica requeridos')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('debe traducir error YA_TIENE_CLINICA', async () => {
    supabase.rpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'YA_TIENE_CLINICA: ya tienes una clínica activa' } 
    })

    const result = await bootstrapClinica({ nombre: 'Clínica Test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Ya tienes una clínica activa. No puedes crear otra.')
  })

  it('debe traducir error RATE_LIMIT', async () => {
    supabase.rpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'RATE_LIMIT: ya creaste una clínica recientemente' } 
    })

    const result = await bootstrapClinica({ nombre: 'Clínica Test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Ya creaste una clínica recientemente. Espera 24 horas.')
  })

  it('debe traducir error RUT_DUPLICADO', async () => {
    supabase.rpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'RUT_DUPLICADO: ya existe una clínica con este RUT' } 
    })

    const result = await bootstrapClinica({ nombre: 'Clínica Test', rutEmpresa: '76.123.456-7' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Ya existe una clínica con este RUT')
  })

  it('debe traducir error NOMBRE_MUY_CORTO', async () => {
    supabase.rpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'NOMBRE_MUY_CORTO: el nombre debe tener al menos 3 caracteres' } 
    })

    const result = await bootstrapClinica({ nombre: 'Clínica Test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('El nombre debe tener al menos 3 caracteres')
  })

  it('debe manejar excepciones', async () => {
    supabase.rpc.mockRejectedValue(new Error('Unexpected error'))

    const result = await bootstrapClinica({ nombre: 'Clínica Test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unexpected error')
  })
})
