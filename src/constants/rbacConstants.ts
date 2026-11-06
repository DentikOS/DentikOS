/**
 * Constantes de RBAC — Archivo público (F3-05, Commit C unificación / Migración TypeScript)
 *
 * Re-exporta ROLES y PERMISOS desde rbacConstantsBase.js, que es la ÚNICA
 * fuente de verdad. Este archivo existe como fachada pública para mantener
 * estabilidad de imports en el resto del códigobase.
 */

// Fuente única de verdad de ROLES y PERMISOS
export { ROLES, PERMISOS } from './rbacConstantsBase'

// Matriz de permisos por rol y tipos
export { PERMISOS_POR_ROL, type RolKey, type PermisoValue } from './rbacPermisosPorRol'

// Nombres y descripciones legibles (locales a este archivo)
import { ROLES } from './rbacConstantsBase'
import type { RolKey } from './rbacPermisosPorRol'

export const NOMBRES_ROLES: Record<RolKey, string> = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.DENTISTA]: 'Dentista',
  [ROLES.ASISTENTE]: 'Asistente Dental',
  [ROLES.RECEPCION]: 'Recepción'
}

export const DESCRIPCIONES_ROLES: Record<RolKey, string> = {
  [ROLES.ADMIN]: 'Acceso total al sistema, incluyendo configuración y gestión de usuarios',
  [ROLES.DENTISTA]: 'Acceso clínico completo y datos financieros, sin configuración del sistema',
  [ROLES.ASISTENTE]: 'Acceso a módulos clínicos básicos, sin datos financieros',
  [ROLES.RECEPCION]: 'Solo agenda y registro básico de pacientes'
}

export const MODULOS_SIDEBAR = {
  DASHBOARD: 'Dashboard',
  AGENDA: 'Agenda',
  PACIENTES: 'Pacientes',
  ODONTOGRAMA: 'Odontograma',
  PRESUPUESTOS: 'Presupuestos',
  PAGOS: 'Pagos',
  INVENTARIO: 'Inventario',
  ESTERILIZACION: 'Esterilización',
  COMUNICACIONES: 'Comunicaciones',
  REPORTES: 'Reportes',
  FINANZAS: 'Finanzas',
  ADMINISTRACION: 'Administración DentikOS',
} as const

export type ModuloSidebar = typeof MODULOS_SIDEBAR[keyof typeof MODULOS_SIDEBAR]

