import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePermissions } from './usePermissions'
import { useSesionStore } from '../../app/stores/sesionStore'
import { ROLES, PERMISOS } from '../../constants/rbacConstants'

describe('usePermissions (Blueprint 02 §08)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSesionStore.setState({ user: null, userProfile: null })
  })

  it('recepcionista: filtra módulos clínicos/admin y deja solo entrada diaria y comunicaciones', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.RECEPCION, nombre: 'Ana' },
    })

    const { result } = renderHook(() => usePermissions())
    const todosLosSlugs = result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))

    expect(todosLosSlugs).toContain('dashboard')
    expect(todosLosSlugs).toContain('agenda')
    expect(todosLosSlugs).toContain('pacientes')
    expect(todosLosSlugs).toContain('comunicaciones')

    expect(todosLosSlugs).not.toContain('admin')
    expect(todosLosSlugs).not.toContain('inventario')
    expect(todosLosSlugs).not.toContain('reportes')
    expect(result.current.isAdmin).toBe(false)
  })

  it('admin: tiene acceso a todos los módulos incluyendo admin', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.ADMIN, nombre: 'Dr. Admin', permisos: Object.values(PERMISOS) },
    })

    const { result } = renderHook(() => usePermissions())
    const todosLosSlugs = result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))

    expect(todosLosSlugs).toContain('admin')
    expect(todosLosSlugs).toContain('dashboard')
    expect(todosLosSlugs).toContain('agenda')
    expect(todosLosSlugs).toContain('inventario')
    expect(result.current.isAdmin).toBe(true)
  })

  it('dentista: no ve administración dentikos pero sí ve clínico y finanzas', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.DENTISTA, nombre: 'Dr. Dentista' },
    })

    const { result } = renderHook(() => usePermissions())
    const todosLosSlugs = result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))

    expect(todosLosSlugs).toContain('vademecum')
    expect(todosLosSlugs).toContain('urgencias-ges')
    expect(todosLosSlugs).not.toContain('admin')
  })
})
