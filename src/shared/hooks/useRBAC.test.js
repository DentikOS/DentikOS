/**
 * Tests de integración para useRBAC (F3-05)
 *
 * Hook de RBAC que consulta permisos del usuario logueado.
 * Cubre los 4 roles definidos, fallbacks seguros y reactividad del store.
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useRBAC } from './useRBAC'
import { useSesionStore } from '../../app/stores/sesionStore'
import { ROLES, PERMISOS } from '../../constants/rbacConstants'

describe('useRBAC', () => {
  const setStore = (userProfile) => useSesionStore.setState({ userProfile })

  beforeEach(() => {
    // Resetear el store antes de cada test
    setStore(null)
  })

  describe('Inicialización y fallbacks seguros', () => {
    it('usa rol "recepcion" como fallback cuando no hay userProfile', () => {
      const { result } = renderHook(() => useRBAC())

      expect(result.current.rol).toBe(ROLES.RECEPCION)
      expect(result.current.esAdmin).toBe(false)
    })

    it('usa rol "recepcion" como fallback cuando userProfile no tiene campo rol', () => {
      setStore({ email: 'test@example.com', nombreCompleto: 'Test User' })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.rol).toBe(ROLES.RECEPCION)
    })

    it('usa rol "recepcion" como fallback cuando el rol es inválido', () => {
      setStore({ email: 'test@example.com', rol: 'rol_inventado' })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.rol).toBe(ROLES.RECEPCION)
    })

    it('acepta roles válidos correctamente', () => {
      setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.rol).toBe(ROLES.ADMIN)
      expect(result.current.esAdmin).toBe(true)
    })
  })

  describe('Método puede() por rol', () => {
    it('ADMIN tiene permiso VER_FINANZAS', () => {
      setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.puede(PERMISOS.VER_FINANZAS)).toBe(true)
      expect(result.current.puede(PERMISOS.VER_CONFIGURACION)).toBe(true)
      expect(result.current.puede(PERMISOS.GESTIONAR_USUARIOS)).toBe(true)
    })

    it('DENTISTA tiene VER_FINANZAS pero NO VER_CONFIGURACION', () => {
      setStore({ email: 'dentista@example.com', rol: ROLES.DENTISTA })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.puede(PERMISOS.VER_FINANZAS)).toBe(true)
      expect(result.current.puede(PERMISOS.EDITAR_PRECIOS)).toBe(true)
      expect(result.current.puede(PERMISOS.VER_CONFIGURACION)).toBe(false)
      expect(result.current.puede(PERMISOS.GESTIONAR_USUARIOS)).toBe(false)
    })

    it('ASISTENTE NO tiene permisos financieros', () => {
      setStore({ email: 'asistente@example.com', rol: ROLES.ASISTENTE })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.puede(PERMISOS.VER_FINANZAS)).toBe(false)
      expect(result.current.puede(PERMISOS.VER_REPORTES)).toBe(false)
      expect(result.current.puede(PERMISOS.EDITAR_PRECIOS)).toBe(false)
      // Pero sí tiene acceso clínico
      expect(result.current.puede(PERMISOS.VER_HISTORIA_CLINICA_COMPLETA)).toBe(true)
    })

    it('RECEPCION puede ver presupuestos sin acceso financiero general', () => {
      setStore({ email: 'recepcion@example.com', rol: ROLES.RECEPCION })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.puede(PERMISOS.VER_FINANZAS)).toBe(false)
      expect(result.current.puede(PERMISOS.VER_PRESUPUESTOS)).toBe(true)
      expect(result.current.puede(PERMISOS.VER_PAGOS)).toBe(false)
      expect(result.current.puede(PERMISOS.VER_CONFIGURACION)).toBe(false)
      expect(result.current.puede(PERMISOS.VER_HISTORIA_CLINICA_COMPLETA)).toBe(false)
    })

    it('retorna false para permisos desconocidos', () => {
      setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.puede('permiso_inventado')).toBe(false)
      expect(result.current.puede(null)).toBe(false)
      expect(result.current.puede(undefined)).toBe(false)
    })
  })

  describe('Método tieneAlguno()', () => {
    it('retorna true si el rol tiene al menos uno de los permisos', () => {
      setStore({ email: 'dentista@example.com', rol: ROLES.DENTISTA })

      const { result } = renderHook(() => useRBAC())

      expect(
        result.current.tieneAlguno([
          PERMISOS.VER_CONFIGURACION,  // NO tiene
          PERMISOS.VER_FINANZAS         // SÍ tiene
        ])
      ).toBe(true)
    })

    it('retorna false si el rol no tiene ninguno de los permisos', () => {
      setStore({ email: 'recepcion@example.com', rol: ROLES.RECEPCION })

      const { result } = renderHook(() => useRBAC())

      expect(
        result.current.tieneAlguno([
          PERMISOS.VER_FINANZAS,
          PERMISOS.VER_CONFIGURACION
        ])
      ).toBe(false)
    })

    it('maneja array vacío retornando false', () => {
      setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.tieneAlguno([])).toBe(false)
    })
  })

  describe('Método es() y propiedad esAdmin', () => {
    it('es() retorna true solo para el rol exacto', () => {
      setStore({ email: 'dentista@example.com', rol: ROLES.DENTISTA })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.es(ROLES.DENTISTA)).toBe(true)
      expect(result.current.es(ROLES.ADMIN)).toBe(false)
      expect(result.current.es(ROLES.ASISTENTE)).toBe(false)
    })

    it('esAdmin es true solo para rol ADMIN', () => {
      setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })
      const adminHook = renderHook(() => useRBAC())
      expect(adminHook.result.current.esAdmin).toBe(true)

      setStore({ email: 'dentista@example.com', rol: ROLES.DENTISTA })
      const dentistaHook = renderHook(() => useRBAC())
      expect(dentistaHook.result.current.esAdmin).toBe(false)
    })
  })

  describe('Propiedad permisos (lista completa)', () => {
    it('ADMIN tiene la lista más extensa de permisos', () => {
      setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })

      const { result } = renderHook(() => useRBAC())

      expect(Array.isArray(result.current.permisos)).toBe(true)
      expect(result.current.permisos.length).toBeGreaterThan(5)
      expect(result.current.permisos).toContain(PERMISOS.VER_FINANZAS)
      expect(result.current.permisos).toContain(PERMISOS.GESTIONAR_USUARIOS)
    })

    it('RECEPCION solo tiene acceso a presupuestos entre los permisos especiales', () => {
      setStore({ email: 'recepcion@example.com', rol: ROLES.RECEPCION })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.permisos).toEqual([PERMISOS.VER_PRESUPUESTOS])
    })
  })

  describe('Reactividad con cambios en el store', () => {
    it('actualiza el rol cuando cambia userProfile en el store', () => {
      setStore({ email: 'recepcion@example.com', rol: ROLES.RECEPCION })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.rol).toBe(ROLES.RECEPCION)
      expect(result.current.puede(PERMISOS.VER_FINANZAS)).toBe(false)

      act(() => {
        setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })
      })

      expect(result.current.rol).toBe(ROLES.ADMIN)
      expect(result.current.puede(PERMISOS.VER_FINANZAS)).toBe(true)
      expect(result.current.esAdmin).toBe(true)
    })

    it('vuelve al fallback cuando userProfile se limpia (logout)', () => {
      setStore({ email: 'admin@example.com', rol: ROLES.ADMIN })

      const { result } = renderHook(() => useRBAC())

      expect(result.current.rol).toBe(ROLES.ADMIN)
      expect(result.current.esAdmin).toBe(true)

      act(() => {
        setStore(null)
      })

      expect(result.current.rol).toBe(ROLES.RECEPCION)
      expect(result.current.esAdmin).toBe(false)
    })
  })
})
