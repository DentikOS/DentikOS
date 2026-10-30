/**
 * SECCIONES_SIDEBAR — 5 Categorías Core del Blueprint 02
 * Permisos RBAC alineados y Odontograma/Presupuestos derivados a la ficha del paciente.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Calendar, LayoutDashboard, Users, Siren, Mail,
  FlaskConical, Package, BarChart3, FileText, CreditCard,
  Pill, Settings
} from 'lucide-react'
import { PERMISOS } from './rbacConstants'
import type { Permiso } from './rbacConstantsBase'

export type CounterVariant = 'info' | 'warning' | 'error' | 'success'

export interface SidebarItem {
  name: string
  icon: LucideIcon
  slug: string
  permisoRequerido?: Permiso
  counterKey?: string
  counterVariant?: CounterVariant
}

export interface SidebarSeccion {
  label: string
  categoria: 'PRINCIPAL' | 'CLINICO' | 'FINANZAS' | 'OPERACIONES' | 'ADMIN'
  items: SidebarItem[]
}

export const SECCIONES_SIDEBAR: SidebarSeccion[] = [
  {
    label: 'ENTRADA DIARIA', // Categoría 01
    categoria: 'PRINCIPAL',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, slug: 'dashboard' },
      { name: 'Agenda', icon: Calendar, slug: 'agenda', counterKey: 'agendaSinConfirmar', counterVariant: 'info' },
      { name: 'Pacientes', icon: Users, slug: 'pacientes', counterKey: 'papelera', counterVariant: 'warning' },
    ],
  },
  {
    label: 'PRÁCTICA SANITARIA', // Categoría 02
    categoria: 'CLINICO',
    items: [
      { name: 'Esterilización', icon: FlaskConical, slug: 'esterilizacion', permisoRequerido: PERMISOS.VER_ESTERILIZACION, counterKey: 'esterilizacionPendiente', counterVariant: 'warning' },
      { name: 'Urgencias GES', icon: Siren, slug: 'urgencias-ges', permisoRequerido: PERMISOS.VER_URGENCIAS_GES },
      { name: 'Vademécum', icon: Pill, slug: 'vademecum', permisoRequerido: PERMISOS.VER_VADEMECUM },
    ],
  },
  {
    label: 'GESTIÓN FINANCIERA', // Categoría 03
    categoria: 'FINANZAS',
    items: [
      { name: 'Presupuestos', icon: FileText, slug: 'presupuestos', permisoRequerido: PERMISOS.VER_PRESUPUESTOS },
      { name: 'Pagos', icon: CreditCard, slug: 'pagos', permisoRequerido: PERMISOS.VER_PAGOS },
      { name: 'Reportes', icon: BarChart3, slug: 'reportes', permisoRequerido: PERMISOS.VER_REPORTES },
    ],
  },
  {
    label: 'LOGÍSTICA OPERATIVA', // Categoría 04
    categoria: 'OPERACIONES',
    items: [
      { name: 'Inventario', icon: Package, slug: 'inventario', permisoRequerido: PERMISOS.VER_INVENTARIO, counterKey: 'inventarioBajo', counterVariant: 'error' },
      { name: 'Comunicaciones', icon: Mail, slug: 'comunicaciones', counterKey: 'mensajesNoLeidos', counterVariant: 'info' },
    ],
  },
  {
    label: 'GESTIÓN', // Categoría 05 — SOLO ADMIN
    categoria: 'ADMIN',
    items: [
      { name: 'Administración DentikOS', icon: Settings, slug: 'admin', permisoRequerido: PERMISOS.GESTIONAR_USUARIOS },
    ],
  },
]
