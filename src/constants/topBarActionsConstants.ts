/**
 * ACCIONES_POR_MODULO — Definición de acciones contextuales por módulo del Blueprint 03
 * Sistema híbrido: Acción primaria con gradiente dorado + secundarias en menú ⋯
 */
import {
  Calendar,
  UserPlus,
  BarChart3,
  Filter,
  Lock,
  Plus,
  CreditCard,
  FileText,
  Package,
  AlertTriangle,
  Sparkles,
  Tag,
  Siren,
  ShieldAlert,
  Search,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { PERMISOS, type PermisoValue } from './rbacConstants'

export interface AccionContextualConfig {
  label: string
  icon: LucideIcon
  actionKey: string
  permisoRequerido?: PermisoValue | string
}

export interface AccionesPorModuloConfig {
  primaria: AccionContextualConfig
  secundarias: AccionContextualConfig[]
}

export const ACCIONES_POR_MODULO: Record<string, AccionesPorModuloConfig> = {
  Dashboard: {
    primaria: {
      label: 'Nuevo paciente',
      icon: UserPlus,
      actionKey: 'crearPaciente',
    },
    secundarias: [
      { label: 'Nueva cita', icon: Calendar, actionKey: 'crearCita' },
      { label: 'Reportes', icon: BarChart3, actionKey: 'abrirReportes', permisoRequerido: PERMISOS.VER_REPORTES },
    ],
  },
  Agenda: {
    primaria: {
      label: 'Nueva cita',
      icon: Calendar,
      actionKey: 'crearCita',
    },
    secundarias: [
      { label: 'Filtrar agenda', icon: Filter, actionKey: 'filtrarAgenda' },
      { label: 'Bloquear horario', icon: Lock, actionKey: 'bloquearHorario' },
    ],
  },
  Pacientes: {
    primaria: {
      label: 'Nuevo paciente',
      icon: UserPlus,
      actionKey: 'crearPaciente',
    },
    secundarias: [
      { label: 'Nuevo presupuesto', icon: FileText, actionKey: 'crearPresupuesto', permisoRequerido: PERMISOS.VER_PRESUPUESTOS },
      { label: 'Exportar', icon: BarChart3, actionKey: 'exportarPacientes', permisoRequerido: PERMISOS.VER_REPORTES },
    ],
  },
  Pagos: {
    primaria: {
      label: 'Registrar pago',
      icon: CreditCard,
      actionKey: 'registrarPago',
      permisoRequerido: PERMISOS.VER_PAGOS,
    },
    secundarias: [
      { label: 'Comprobante', icon: FileText, actionKey: 'comprobante', permisoRequerido: PERMISOS.VER_PAGOS },
    ],
  },
  Inventario: {
    primaria: {
      label: 'Añadir ítem',
      icon: Plus,
      actionKey: 'nuevoItem',
      permisoRequerido: PERMISOS.VER_INVENTARIO,
    },
    secundarias: [
      { label: 'Ajuste de stock', icon: Package, actionKey: 'ajusteStock', permisoRequerido: PERMISOS.VER_INVENTARIO },
      { label: 'Alerta crítica', icon: AlertTriangle, actionKey: 'alertaStock', permisoRequerido: PERMISOS.VER_INVENTARIO },
    ],
  },
  Esterilización: {
    primaria: {
      label: 'Nuevo ciclo',
      icon: Sparkles,
      actionKey: 'nuevoCiclo',
      permisoRequerido: PERMISOS.VER_ESTERILIZACION,
    },
    secundarias: [
      { label: 'Etiquetas', icon: Tag, actionKey: 'etiquetas', permisoRequerido: PERMISOS.VER_ESTERILIZACION },
      { label: 'Libro SEREMI', icon: FileText, actionKey: 'libroSeremi', permisoRequerido: PERMISOS.VER_ESTERILIZACION },
    ],
  },
  'Urgencias GES': {
    primaria: {
      label: 'Ingreso GES',
      icon: Siren,
      actionKey: 'ingresoGes',
      permisoRequerido: PERMISOS.VER_URGENCIAS_GES,
    },
    secundarias: [
      { label: 'Garantías MINSAL', icon: ShieldAlert, actionKey: 'garantias', permisoRequerido: PERMISOS.VER_URGENCIAS_GES },
    ],
  },
  'Urgencias y GES': {
    primaria: {
      label: 'Ingreso GES',
      icon: Siren,
      actionKey: 'ingresoGes',
      permisoRequerido: PERMISOS.VER_URGENCIAS_GES,
    },
    secundarias: [
      { label: 'Garantías MINSAL', icon: ShieldAlert, actionKey: 'garantias', permisoRequerido: PERMISOS.VER_URGENCIAS_GES },
    ],
  },
  Vademécum: {
    primaria: {
      label: 'Buscar fármaco',
      icon: Search,
      actionKey: 'buscarFarmaco',
      permisoRequerido: PERMISOS.VER_VADEMECUM,
    },
    secundarias: [
      { label: 'Interacciones', icon: Layers, actionKey: 'interacciones', permisoRequerido: PERMISOS.VER_VADEMECUM },
    ],
  },
  Reportes: {
    primaria: {
      label: 'Exportar PDF',
      icon: FileText,
      actionKey: 'exportarPdf',
      permisoRequerido: PERMISOS.VER_REPORTES,
    },
    secundarias: [
      { label: 'Filtrar', icon: Filter, actionKey: 'filtrarReportes', permisoRequerido: PERMISOS.VER_REPORTES },
      { label: 'Comparar', icon: BarChart3, actionKey: 'compararReportes', permisoRequerido: PERMISOS.VER_REPORTES },
    ],
  },
}
