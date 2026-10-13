import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebarStore } from './useSidebarStore'

describe('useSidebarStore (Blueprint 02 §09)', () => {
  beforeEach(() => {
    useSidebarStore.setState({
      mode: 'expanded',
      activeModule: 'Dashboard',
      sedeActiva: null,
      theme: 'light',
      badges: {},
      connectivityStatus: 'connected',
      lastSyncAt: null,
      activeDevices: 1,
      preSurgicalMode: null,
      focusMode: false,
      mobileOpen: false,
    })
  })

  it('inicializa con los valores por defecto esperados', () => {
    const state = useSidebarStore.getState()
    expect(state.mode).toBe('expanded')
    expect(state.activeModule).toBe('Dashboard')
    expect(state.sedeActiva).toBeNull()
    expect(state.theme).toBe('light')
    expect(state.badges).toEqual({})
    expect(state.connectivityStatus).toBe('connected')
    expect(state.lastSyncAt).toBeNull()
    expect(state.activeDevices).toBe(1)
  })

  it('permite alternar mode con toggleCollapsed y toggleMode', () => {
    useSidebarStore.getState().toggleCollapsed()
    expect(useSidebarStore.getState().mode).toBe('collapsed')

    useSidebarStore.getState().toggleCollapsed()
    expect(useSidebarStore.getState().mode).toBe('expanded')

    useSidebarStore.getState().toggleMode()
    expect(useSidebarStore.getState().mode).toBe('collapsed')
  })

  it('permite cambiar tema y módulo activo', () => {
    useSidebarStore.getState().setTheme('surgical')
    expect(useSidebarStore.getState().theme).toBe('surgical')

    useSidebarStore.getState().setActiveModule('Pacientes')
    expect(useSidebarStore.getState().activeModule).toBe('Pacientes')

    useSidebarStore.getState().setActiveSede('sede-central')
    expect(useSidebarStore.getState().sedeActiva).toBe('sede-central')
  })

  it('gestiona badges en tiempo real (updateBadge y clearBadge)', () => {
    useSidebarStore.getState().updateBadge('Pacientes', 5)
    useSidebarStore.getState().updateBadge('Agenda', 2)

    expect(useSidebarStore.getState().badges).toEqual({
      Pacientes: 5,
      Agenda: 2,
    })

    useSidebarStore.getState().clearBadge('Pacientes')
    expect(useSidebarStore.getState().badges).toEqual({
      Agenda: 2,
    })
  })

  it('actualiza estado del sistema (connectivity, sync, devices)', () => {
    useSidebarStore.getState().setConnectivityStatus('pending')
    expect(useSidebarStore.getState().connectivityStatus).toBe('pending')

    const now = Date.now()
    useSidebarStore.getState().setLastSyncAt(now)
    expect(useSidebarStore.getState().lastSyncAt).toBe(now)

    useSidebarStore.getState().setActiveDevices(3)
    expect(useSidebarStore.getState().activeDevices).toBe(3)
  })

  it('mantiene compatibilidad con acciones previas (focusMode, mobileOpen, preSurgicalMode)', () => {
    useSidebarStore.getState().setMobileOpen(true)
    expect(useSidebarStore.getState().mobileOpen).toBe(true)

    useSidebarStore.getState().toggleFocusMode()
    expect(useSidebarStore.getState().focusMode).toBe(true)

    useSidebarStore.getState().setPreSurgicalMode('expanded')
    expect(useSidebarStore.getState().preSurgicalMode).toBe('expanded')
  })
})
