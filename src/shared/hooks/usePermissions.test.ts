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

  it('recepcionista: conserva entrada diaria, comunicaciones y acceso limitado al laboratorio', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.RECEPCION, nombre: 'Ana' },
    })

    const { result } = renderHook(() => usePermissions())
    const todosLosSlugs = result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))

    expect(todosLosSlugs).toContain('dashboard')
    expect(todosLosSlugs).toContain('agenda')
    expect(todosLosSlugs).toContain('pacientes')
    expect(todosLosSlugs).toContain('comunicaciones')
    expect(todosLosSlugs).toContain('laboratorio')
    expect(todosLosSlugs).toContain('urgencias-ges')
    expect(todosLosSlugs).toContain('finanzas')
    expect(todosLosSlugs).not.toContain('reportes')

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

  it('dentista: no ve Administración DentikOS ni el módulo BP15', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.DENTISTA, nombre: 'Dr. Dentista' },
    })

    const { result } = renderHook(() => usePermissions())
    const todosLosSlugs = result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))

    expect(todosLosSlugs).toContain('vademecum')
    expect(todosLosSlugs).toContain('urgencias-ges')
    expect(todosLosSlugs).toContain('laboratorio')
    expect(todosLosSlugs).not.toContain('finanzas')
    expect(todosLosSlugs).toContain('urgencias-ges')
    expect(todosLosSlugs).not.toContain('admin')
  })

  it('asistente: puede abrir laboratorio sin recibir módulos financieros', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.ASISTENTE, nombre: 'Asistente' },
    })

    const { result } = renderHook(() => usePermissions())
    const todosLosSlugs = result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))

    expect(todosLosSlugs).toContain('laboratorio')
    expect(todosLosSlugs).not.toContain('pagos')
    expect(todosLosSlugs).not.toContain('reportes')
  })

  it('conserva el acceso clínico de usuarios con permisos explícitos antiguos', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.DENTISTA, nombre: 'Dentista', permisos: [PERMISOS.VER_URGENCIAS_GES] },
    })

    const { result } = renderHook(() => usePermissions())
    const todosLosSlugs = result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))
    expect(todosLosSlugs).toContain('urgencias-ges')
  })

  it('permite la entrada BP15 a admin y recepción con perfiles explícitos anteriores', () => {
    useSesionStore.setState({
      userProfile: { rol: ROLES.ADMIN, nombre: 'Admin antiguo', permisos: [PERMISOS.VER_FINANZAS] },
    })
    const admin = renderHook(() => usePermissions())
    expect(admin.result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))).toContain('finanzas')
    admin.unmount()

    useSesionStore.setState({
      userProfile: { rol: ROLES.RECEPCION, nombre: 'Recepción antigua', permisos: [PERMISOS.VER_LABORATORIO] },
    })
    const reception = renderHook(() => usePermissions())
    const slugs = reception.result.current.seccionesFiltradas.flatMap((s) => s.items.map((i) => i.slug))
    expect(slugs).toContain('finanzas')
    expect(slugs).not.toContain('presupuestos')
  })
})
