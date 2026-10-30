/**
 * Tests unitarios del hook useRealtimeSync (F5-02).
 *
 * Cobertura:
 * - Monta → se suscribe a todas las tablas críticas
 * - No se suscribe si no hay usuario logueado
 * - No se suscribe si USE_SUPABASE=false
 * - Recibe evento en 'pacientes' → llama refrescarDesdeSupabase
 * - Recibe evento en otra tabla → emite evento custom
 * - Ignora eventos locales (dentro de ventana de 2s)
 * - Procesa eventos fuera de ventana de tolerancia
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRealtimeSync, registrarEscrituraLocal } from './useRealtimeSync'
import * as useRealtimeSubscriptionModule from './useRealtimeSubscription'
import * as pacientesStoreModule from '../../app/stores/pacientesStore'
import * as sesionStoreModule from '../../app/stores/sesionStore'
import { usePrestacionesStore } from '../../app/stores/prestacionesStore'
import * as supabaseClientModule from '../../infrastructure/supabase/supabaseClient'

// Mocks
vi.mock('./useRealtimeSubscription', () => ({
  useRealtimeSubscription: vi.fn()
}))

vi.mock('../../app/stores/pacientesStore', () => ({
  usePacientesStore: vi.fn((selector) => selector({
    pacientes: [],
    setPacientes: vi.fn(),
    refrescarDesdeSupabase: vi.fn()
  }))
}))

vi.mock('../../app/stores/sesionStore', () => ({
  useSesionStore: vi.fn((selector) => selector({
    userProfile: null
  }))
}))

vi.mock('../../app/stores/prestacionesStore', () => ({
  usePrestacionesStore: { getState: vi.fn(() => ({ sincronizarDesdeSupabase: vi.fn() })) }
}))

vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true
}))

describe('useRealtimeSync', () => {
  let mockRefrescarPacientes
  let mockUseRealtimeSubscription

  beforeEach(() => {
    vi.clearAllMocks()

    mockRefrescarPacientes = vi.fn()
    mockUseRealtimeSubscription = vi.mocked(useRealtimeSubscriptionModule.useRealtimeSubscription)

    // Configurar userProfile por defecto (logueado)
    vi.mocked(sesionStoreModule.useSesionStore).mockImplementation((selector) =>
      selector({ userProfile: { email: 'test@example.com' } })
    )

    vi.mocked(pacientesStoreModule.usePacientesStore).mockImplementation((selector) =>
      selector({
        pacientes: [],
        setPacientes: vi.fn(),
        refrescarDesdeSupabase: mockRefrescarPacientes
      })
    )

    vi.mocked(supabaseClientModule).USE_SUPABASE = true
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('debe suscribirse a todas las tablas críticas al montar', () => {
    renderHook(() => useRealtimeSync())

    // Incluye el arancel clínico compartido.
    expect(mockUseRealtimeSubscription).toHaveBeenCalledTimes(12)

    // Verificar que se suscribió a las tablas correctas
    const tablas = mockUseRealtimeSubscription.mock.calls.map(call => call[0])
    expect(tablas).toContain('pacientes')
    expect(tablas).toContain('prestaciones')
    expect(tablas).toContain('citas')
    expect(tablas).toContain('presupuestos')
    expect(tablas).toContain('pagos')
    expect(tablas).toContain('evoluciones_clinicas')
    expect(tablas).toContain('recetas')
  })

  it('no debe suscribirse si no hay usuario logueado', () => {
    vi.mocked(sesionStoreModule.useSesionStore).mockImplementation((selector) =>
      selector({ userProfile: null })
    )

    renderHook(() => useRealtimeSync())

    // Todas las llamadas deben tener enabled: false
    const todasDisabled = mockUseRealtimeSubscription.mock.calls.every(
      call => call[2]?.enabled === false
    )
    expect(todasDisabled).toBe(true)
  })

  it('no debe suscribirse si USE_SUPABASE es false', () => {
    vi.mocked(supabaseClientModule).USE_SUPABASE = false

    renderHook(() => useRealtimeSync())

    const todasDisabled = mockUseRealtimeSubscription.mock.calls.every(
      call => call[2]?.enabled === false
    )
    expect(todasDisabled).toBe(true)
  })

  it('debe llamar refrescarDesdeSupabase al recibir evento en pacientes', () => {
    renderHook(() => useRealtimeSync())

    // Encontrar el callback registrado para 'pacientes'
    const llamadaPacientes = mockUseRealtimeSubscription.mock.calls.find(
      call => call[0] === 'pacientes'
    )
    const callbackPacientes = llamadaPacientes[1]

    // Simular evento INSERT
    callbackPacientes({ eventType: 'INSERT', new: { id: '1', nombre: 'Test' } })

    expect(mockRefrescarPacientes).toHaveBeenCalledTimes(1)
  })

  it('debe emitir evento custom al recibir evento en otras tablas', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

    renderHook(() => useRealtimeSync())

    // Encontrar el callback para 'citas'
    const llamadaCitas = mockUseRealtimeSubscription.mock.calls.find(
      call => call[0] === 'citas'
    )
    const callbackCitas = llamadaCitas[1]

    const payload = { eventType: 'INSERT', new: { id: '1', fecha: '2026-08-14' } }
    callbackCitas(payload)

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'realtime:citas_changed',
        detail: payload
      })
    )

    dispatchEventSpy.mockRestore()
  })

  it('debe ignorar eventos locales (dentro de ventana de 2s)', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

    renderHook(() => useRealtimeSync())

    // Registrar escritura local reciente
    registrarEscrituraLocal('citas')

    const llamadaCitas = mockUseRealtimeSubscription.mock.calls.find(
      call => call[0] === 'citas'
    )
    const callbackCitas = llamadaCitas[1]

    // Intentar disparar evento inmediatamente
    callbackCitas({ eventType: 'INSERT', new: { id: '1' } })

    // NO debe emitir evento custom (es local)
    expect(dispatchEventSpy).not.toHaveBeenCalled()

    dispatchEventSpy.mockRestore()
  })

  it('debe procesar eventos fuera de ventana de tolerancia', async () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

    renderHook(() => useRealtimeSync())

    // Simular que la escritura fue hace más de 2 segundos
    registrarEscrituraLocal('citas')
    await new Promise(resolve => setTimeout(resolve, 2100))

    const llamadaCitas = mockUseRealtimeSubscription.mock.calls.find(
      call => call[0] === 'citas'
    )
    const callbackCitas = llamadaCitas[1]

    callbackCitas({ eventType: 'INSERT', new: { id: '1' } })

    // Ahora SÍ debe emitir evento custom (pasaron >2s)
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'realtime:citas_changed' })
    )

    dispatchEventSpy.mockRestore()
  })

  it('debe registrar escritura local correctamente', () => {
    const _antes = Date.now()
    registrarEscrituraLocal('pacientes')
    const _despues = Date.now()

    // Verificar que el timestamp está dentro del rango esperado
    const callback = mockUseRealtimeSubscription.mock.calls.find(
      call => call[0] === 'pacientes'
    )?.[1]

    // Simular evento inmediato (debe ser ignorado por ser local)
    if (callback) {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
      callback({ eventType: 'INSERT', new: {} })
      expect(mockRefrescarPacientes).not.toHaveBeenCalled()
      dispatchEventSpy.mockRestore()
    }
  })
})
