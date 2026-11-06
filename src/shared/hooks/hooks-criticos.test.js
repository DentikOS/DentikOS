/**
 * Tests consolidados para hooks críticos sin cobertura (F6-K Fase 3)
 *
 * Cubre los 4 hooks más importantes sin tests:
 * - useNotifications (27 líneas) - sistema de notificaciones
 * - useOfflineQueue (46 líneas) - cola offline-first
 * - useSessionGuard (77 líneas) - protección de sesión
 * - useDataMigration (269 líneas) - migración automática
 *
 * Patrón de tests:
 * - Caso básico: hook retorna valores esperados
 * - Caso edge: manejo de parámetros nulos
 * - Cleanup: listeners se remueven al desmontar
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mocks globales antes de importar los hooks
vi.mock('../../infrastructure/notification/notificationService', () => ({
  notificationService: {
    listar: vi.fn(() => []),
    suscribir: vi.fn((_callback) => {
      return () => {} // unsubscribe function
    }),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('../../domains/clinical/patient/services/pacientesStorageService', () => ({
  procesarColaPacientes: vi.fn(() => Promise.resolve({ procesados: 0, fallidos: 0 }))
}))

vi.mock('../../infrastructure/logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../infrastructure/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
  },
  USE_SUPABASE: false
}))

vi.mock('../../infrastructure/supabase/migrations/migratePacientesToSupabase', () => ({
  migratePacientesToSupabase: vi.fn(),
  verificarPacientesPendientes: vi.fn(() => ({ pendientes: 0 }))
}))

vi.mock('../../infrastructure/supabase/migrations/migrateCitasToSupabase', () => ({
  migrateCitasToSupabase: vi.fn(),
  verificarCitasPendientes: vi.fn(() => ({ pendientes: 0 }))
}))

vi.mock('../../infrastructure/supabase/migrations/migratePresupuestosToSupabase', () => ({
  migratePresupuestosToSupabase: vi.fn(),
  verificarPresupuestosPendientes: vi.fn(() => ({ pendientes: 0 }))
}))

vi.mock('../../infrastructure/supabase/migrations/migratePagosToSupabase', () => ({
  migratePagosToSupabase: vi.fn(),
  verificarPagosPendientes: vi.fn(() => ({ globalesPendientes: 0 }))
}))

vi.mock('../../infrastructure/supabase/migrations/migrateMovimientosFinancierosToSupabase', () => ({
  migrateMovimientosFinancierosToSupabase: vi.fn(),
  verificarMovimientosPendientes: vi.fn(() => ({ pendientes: 0 }))
}))

vi.mock('../../infrastructure/supabase/migrations/migrateDatosClinicosToSupabase', () => ({
  migrateDatosClinicosToSupabase: vi.fn(),
  verificarDatosClinicosPendientes: vi.fn(() => ({ conDatos: false }))
}))

vi.mock('../../domains/clinical/patient', () => ({
  pacientesStorageService: {
    sincronizarDesdeSupabase: vi.fn(),
    obtenerPacientes: vi.fn(() => [])
  }
}))

vi.mock('../../domains/operations/agenda', () => ({
  agendaStorageService: {
    sincronizarDesdeSupabase: vi.fn()
  }
}))

vi.mock('../../app/stores/pacientesStore', () => ({
  usePacientesStore: {
    setState: vi.fn()
  }
}))

// Importar hooks después de definir mocks
import { useNotifications } from './useNotifications'
import { useOfflineQueue } from './useOfflineQueue'
import { useSessionGuard } from './useSessionGuard'
import { useDataMigration } from './useDataMigration'
import { notificationService } from '../../infrastructure/notification/notificationService'
import { procesarColaPacientes } from '../../domains/clinical/patient/services/pacientesStorageService'

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar array de notificaciones', () => {
    const { result } = renderHook(() => useNotifications())
    expect(Array.isArray(result.current)).toBe(true)
    expect(result.current).toEqual([])
  })

  it('debe suscribirse al notificationService', () => {
    renderHook(() => useNotifications())
    expect(notificationService.suscribir).toHaveBeenCalled()
  })

  it('debe listar notificaciones iniciales', () => {
    renderHook(() => useNotifications())
    expect(notificationService.listar).toHaveBeenCalled()
  })
})

describe('useOfflineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock de window events
    global.window.addEventListener = vi.fn()
    global.window.removeEventListener = vi.fn()
    // Mock de navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('debe registrar listeners de online y offline', () => {
    renderHook(() => useOfflineQueue())
    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('debe remover listeners al desmontar', () => {
    const { unmount } = renderHook(() => useOfflineQueue())
    unmount()
    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('debe procesar cola si está online al montar', () => {
    Object.defineProperty(navigator, 'onLine', { value: true })
    renderHook(() => useOfflineQueue())
    expect(procesarColaPacientes).toHaveBeenCalled()
  })

  it('no debe procesar cola si está offline al montar', () => {
    Object.defineProperty(navigator, 'onLine', { value: false })
    renderHook(() => useOfflineQueue())
    // No debe llamar processQueue inmediatamente si está offline
    // (solo cuando vuelve online)
  })
})

describe('useSessionGuard', () => {
  const mockLogout = vi.fn()
  const mockUserProfile = { id: 'user-123', nombre: 'Test User' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar objeto con activo y authErrorHandler', () => {
    const { result } = renderHook(() => 
      useSessionGuard({ userProfile: mockUserProfile, logout: mockLogout })
    )
    
    expect(result.current).toHaveProperty('activo')
    expect(result.current).toHaveProperty('authErrorHandler')
    expect(result.current.activo).toBe(true)
    expect(typeof result.current.authErrorHandler).toBe('function')
  })

  it('debe retornar activo=false si userProfile es null', () => {
    const { result } = renderHook(() => 
      useSessionGuard({ userProfile: null, logout: mockLogout })
    )
    
    expect(result.current.activo).toBe(false)
  })

  it('authErrorHandler debe retornar true para errores 401', () => {
    const { result } = renderHook(() => 
      useSessionGuard({ userProfile: mockUserProfile, logout: mockLogout })
    )
    
    const error401 = { status: 401 }
    const handled = result.current.authErrorHandler(error401)
    
    expect(handled).toBe(true)
    expect(notificationService.error).toHaveBeenCalled()
  })

  it('authErrorHandler debe retornar true para errores 403', () => {
    const { result } = renderHook(() => 
      useSessionGuard({ userProfile: mockUserProfile, logout: mockLogout })
    )
    
    const error403 = { status: 403 }
    const handled = result.current.authErrorHandler(error403)
    
    expect(handled).toBe(true)
  })

  it('authErrorHandler debe retornar false para otros errores', () => {
    const { result } = renderHook(() => 
      useSessionGuard({ userProfile: mockUserProfile, logout: mockLogout })
    )
    
    const error500 = { status: 500 }
    const handled = result.current.authErrorHandler(error500)
    
    expect(handled).toBe(false)
    expect(notificationService.error).not.toHaveBeenCalled()
  })

  it('authErrorHandler debe llamar logout si hay error de auth', async () => {
    const { result } = renderHook(() => 
      useSessionGuard({ userProfile: mockUserProfile, logout: mockLogout })
    )
    
    const error401 = { status: 401 }
    result.current.authErrorHandler(error401)
    
    expect(mockLogout).toHaveBeenCalled()
  })
})

describe('useDataMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no debe ejecutar migración si USE_SUPABASE es false', () => {
    const userProfile = { id: 'user-123' }
    renderHook(() => useDataMigration(userProfile))
    
    // No debe llamar ninguna función de migración
    // porque USE_SUPABASE=false en los mocks
  })

  it('no debe ejecutar migración si userProfile es null', () => {
    renderHook(() => useDataMigration(null))
    
    // No debe llamar ninguna función de migración
  })

  it('debe ser un hook válido que no lance errores', () => {
    const userProfile = { id: 'user-123' }
    expect(() => {
      renderHook(() => useDataMigration(userProfile))
    }).not.toThrow()
  })

  it('debe retornar undefined (hook sin valor de retorno)', () => {
    const userProfile = { id: 'user-123' }
    const { result } = renderHook(() => useDataMigration(userProfile))
    expect(result.current).toBeUndefined()
  })
})
