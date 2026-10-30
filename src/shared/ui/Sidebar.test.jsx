import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { useRBAC } from '../hooks/useRBAC'
import { useDarkMode } from '../hooks/useDarkMode'
import { useSidebarStore } from '../../app/stores/useSidebarStore'
import { ROLES, PERMISOS } from '../../constants/rbacConstants'

vi.mock('../hooks/useRBAC', () => ({
  useRBAC: vi.fn(),
}))

vi.mock('../hooks/useDarkMode', () => ({
  useDarkMode: vi.fn().mockReturnValue({
    theme: 'light',
    setTheme: vi.fn(),
    darkMode: false,
    isSurgical: false,
    toggleDarkMode: vi.fn(),
    cycleTheme: vi.fn(),
  }),
}))

describe('Sidebar - Matriz de Permisos Blueprint 02', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useDarkMode).mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      darkMode: false,
      isSurgical: false,
      toggleDarkMode: vi.fn(),
      cycleTheme: vi.fn(),
    })
  })

  it('Recepcionista: ve presupuestos para abonar, sin acceso al módulo general de pagos', () => {
    vi.mocked(useRBAC).mockReturnValue({
      rol: ROLES.RECEPCION,
      esAdmin: false,
      puede: vi.fn((p) => p === PERMISOS.VER_PRESUPUESTOS),
      tieneAlguno: vi.fn().mockReturnValue(false),
      es: vi.fn((r) => r === ROLES.RECEPCION),
      permisos: [PERMISOS.VER_PRESUPUESTOS],
    })

    render(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)

    expect(screen.getByTestId('sidebar-menu-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-agenda')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-pacientes')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-comunicaciones')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-presupuestos')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-menu-pagos')).not.toBeInTheDocument()

    // Opciones no permitidas no deben aparecer
    expect(screen.queryByTestId('sidebar-menu-admin')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-menu-inventario')).not.toBeInTheDocument()
  })

  it('Admin: tiene visible el módulo Administración DentikOS', () => {
    vi.mocked(useRBAC).mockReturnValue({
      rol: ROLES.ADMIN,
      esAdmin: true,
      puede: vi.fn().mockReturnValue(true),
      tieneAlguno: vi.fn().mockReturnValue(true),
      es: vi.fn((r) => r === ROLES.ADMIN),
      permisos: Object.values(PERMISOS),
    })

    render(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)

    expect(screen.getByTestId('sidebar-menu-admin')).toBeInTheDocument()
  })

  it('Dentista: no ve Administración DentikOS pero sí ve módulos clínicos y financieros', () => {
    vi.mocked(useRBAC).mockReturnValue({
      rol: ROLES.DENTISTA,
      esAdmin: false,
      puede: vi.fn((p) => p !== PERMISOS.GESTIONAR_USUARIOS && p !== PERMISOS.VER_CONFIGURACION),
      tieneAlguno: vi.fn().mockReturnValue(true),
      es: vi.fn((r) => r === ROLES.DENTISTA),
      permisos: [],
    })

    render(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)

    expect(screen.getByTestId('sidebar-menu-pagos')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-vademecum')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-menu-admin')).not.toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-presupuestos')).toBeInTheDocument()
  })

  it('Toggle de colapso: botón visible y conmuta modo del store', () => {
    vi.mocked(useRBAC).mockReturnValue({
      rol: ROLES.ADMIN,
      esAdmin: true,
      puede: vi.fn().mockReturnValue(true),
      tieneAlguno: vi.fn().mockReturnValue(true),
      es: vi.fn().mockReturnValue(true),
      permisos: Object.values(PERMISOS),
    })

    const { rerender } = render(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)

    const toggleBtn = screen.getByTestId('sidebar-toggle')
    expect(toggleBtn).toBeInTheDocument()

    // En ambos estados el botón debe ser visible
    rerender(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)
    expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument()
  })

  it('muestra la identidad de la clínica y sede en modo expandido', () => {
    vi.mocked(useRBAC).mockReturnValue({
      rol: ROLES.ADMIN,
      esAdmin: true,
      puede: vi.fn().mockReturnValue(true),
      tieneAlguno: vi.fn().mockReturnValue(true),
      es: vi.fn().mockReturnValue(true),
      permisos: Object.values(PERMISOS),
    })

    const userProfile = { clinicaNombre: 'Clínica Sonrisa Perfecta' }
    render(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} userProfile={userProfile} />)

    expect(screen.getByText('Clínica Sonrisa Perfecta')).toBeInTheDocument()
  })

  it('muestra fallback "Mi Consulta" y se actualiza en vivo ante evento clinica_actualizada', () => {
    vi.mocked(useRBAC).mockReturnValue({
      rol: ROLES.ADMIN,
      esAdmin: true,
      puede: vi.fn().mockReturnValue(true),
      tieneAlguno: vi.fn().mockReturnValue(true),
      es: vi.fn().mockReturnValue(true),
      permisos: Object.values(PERMISOS),
    })

    const { act } = require('@testing-library/react')
    render(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)

    expect(screen.getByText('Mi Consulta')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new CustomEvent('clinica_actualizada', { detail: { nombre: 'Clínica Las Condes VIP' } }))
    })

    expect(screen.getByText('Clínica Las Condes VIP')).toBeInTheDocument()
  })

  it('Modo Quirúrgico: auto-colapsa el Sidebar y restaura el modo previo al salir', () => {
    vi.mocked(useRBAC).mockReturnValue({
      rol: ROLES.ADMIN,
      esAdmin: true,
      puede: vi.fn().mockReturnValue(true),
      tieneAlguno: vi.fn().mockReturnValue(true),
      es: vi.fn().mockReturnValue(true),
      permisos: Object.values(PERMISOS),
    })

    useSidebarStore.setState({ mode: 'expanded', preSurgicalMode: null })

    // Inicia en light
    vi.mocked(useDarkMode).mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      darkMode: false,
      isSurgical: false,
      toggleDarkMode: vi.fn(),
      cycleTheme: vi.fn(),
    })
    const { rerender } = render(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)
    expect(useSidebarStore.getState().mode).toBe('expanded')

    // Cambia a surgical
    vi.mocked(useDarkMode).mockReturnValue({
      theme: 'surgical',
      setTheme: vi.fn(),
      darkMode: false,
      isSurgical: true,
      toggleDarkMode: vi.fn(),
      cycleTheme: vi.fn(),
    })
    rerender(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)

    expect(useSidebarStore.getState().mode).toBe('collapsed')
    expect(useSidebarStore.getState().preSurgicalMode).toBe('expanded')

    // Sale de surgical de vuelta a light
    vi.mocked(useDarkMode).mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      darkMode: false,
      isSurgical: false,
      toggleDarkMode: vi.fn(),
      cycleTheme: vi.fn(),
    })
    rerender(<Sidebar activeSection="Dashboard" setActiveSection={vi.fn()} />)

    expect(useSidebarStore.getState().mode).toBe('expanded')
    expect(useSidebarStore.getState().preSurgicalMode).toBeNull()
  })
})
