import { describe, it, expect } from 'vitest'
import { SECCIONES_SIDEBAR } from './sidebarConstants'
import { PERMISOS } from './rbacConstants'

describe('sidebarConstants (Blueprint 02)', () => {
  it('contiene 5 secciones principales', () => {
    expect(SECCIONES_SIDEBAR).toHaveLength(5)
    expect(SECCIONES_SIDEBAR.map(s => s.label)).toEqual([
      'ENTRADA DIARIA',
      'PRÁCTICA SANITARIA',
      'GESTIÓN FINANCIERA',
      'LOGÍSTICA OPERATIVA',
      'GESTIÓN',
    ])
  })

  it('todos los items tienen nombre, icono y slug', () => {
    SECCIONES_SIDEBAR.forEach(seccion => {
      expect(seccion.items.length).toBeGreaterThan(0)
      seccion.items.forEach(item => {
        expect(typeof item.name).toBe('string')
        expect(typeof item.slug).toBe('string')
        expect(item.icon).toBeDefined()
      })
    })
  })

  it('items con permisos requeridos tienen permisos válidos', () => {
    const itemsConPermiso = SECCIONES_SIDEBAR
      .flatMap(s => s.items)
      .filter(i => i.permisoRequerido)

    expect(itemsConPermiso.length).toBeGreaterThan(0)
    itemsConPermiso.forEach(item => {
      expect(typeof item.permisoRequerido).toBe('string')
    })
  })

  it('registra el acceso al laboratorio dentro de práctica sanitaria', () => {
    const moduloLaboratorio = SECCIONES_SIDEBAR
      .find(seccion => seccion.categoria === 'CLINICO')
      ?.items.find(item => item.slug === 'laboratorio')

    expect(moduloLaboratorio?.name).toBe('Laboratorio')
    expect(moduloLaboratorio?.permisoRequerido).toBe(PERMISOS.VER_LABORATORIO)
  })

  it('expone Finanzas con un permiso de caja específico de BP15', () => {
    const finanzas = SECCIONES_SIDEBAR.find((section) => section.categoria === 'FINANZAS')
      ?.items.find((item) => item.slug === 'finanzas')

    expect(finanzas?.name).toBe('Finanzas')
    expect(finanzas?.permisoRequerido).toBe(PERMISOS.VER_CAJA_BP15)
  })
})
