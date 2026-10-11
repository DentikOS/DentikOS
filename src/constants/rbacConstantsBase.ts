/**
 * Constantes base de RBAC (Role-Based Access Control) — Studio Dental (F3-05 / Migración TypeScript)
 * 
 * Este archivo define los roles y permisos disponibles. Se separa de 
 * rbacConstants.js para evitar dependencias circulares con rbacPermisosPorRol.ts.
 */

export const ROLES = {
  ADMIN: 'admin',
  DENTISTA: 'dentista',
  ASISTENTE: 'asistente',
  RECEPCION: 'recepcion'
} as const

export type Rol = typeof ROLES[keyof typeof ROLES]

/**
 * Permisos disponibles en el sistema.
 * Cada permiso representa una capacidad específica que puede ser otorgada o denegada por rol.
 */
export const PERMISOS = {
  // Módulos críticos (visibilidad en Sidebar)
  VER_FINANZAS: 'ver_finanzas',
  VER_PRESUPUESTOS: 'ver_presupuestos',
  VER_PAGOS: 'ver_pagos',
  VER_REPORTES: 'ver_reportes',
  VER_CONFIGURACION: 'ver_configuracion',
  VER_INVENTARIO: 'ver_inventario',
  VER_LABORATORIO: 'ver_laboratorio',
  VER_ESTERILIZACION: 'ver_esterilizacion',
  VER_URGENCIAS_GES: 'ver_urgencias_ges',

  // Permisos de edición/operación
  EDITAR_PRECIOS: 'editar_precios',
  ELIMINAR_PACIENTES: 'eliminar_pacientes',

  // Permisos clínicos
  VER_HISTORIA_CLINICA_COMPLETA: 'ver_historia_clinica_completa',

  // Permisos administrativos
  GESTIONAR_USUARIOS: 'gestionar_usuarios',
  VER_LOGS_SISTEMA: 'ver_logs_sistema',

  // Vademécum
  VER_VADEMECUM: 'ver_vademecum',
  ADMINISTRAR_VADEMECUM: 'administrar_vademecum',

  // Papelera (F6-L)
  VER_PAPELERA: 'ver_papelera',

  // Vaciar papelera (Feature 1: eliminación permanente)
  VACIAR_PAPELERA: 'vaciar_papelera',

  // Auditoría financiera de pagos (Commit B)
  PURGAR_PAGOS: 'purgar_pagos',
  EXPORTAR_AUDITORIA_PAGOS: 'exportar_auditoria_pagos'
} as const

export type Permiso = typeof PERMISOS[keyof typeof PERMISOS]
