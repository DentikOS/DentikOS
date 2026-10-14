import type { LucideIcon } from 'lucide-react'
import {
  User,
  Calendar,
  Layers,
  Zap,
  Settings,
  FileText,
  PlusCircle,
  CreditCard,
  FileSpreadsheet,
  Moon,
  Sun,
  Activity,
  Sliders,
} from 'lucide-react'
import type { Paciente } from '../domains/clinical/patient/schemas/pacienteSchema'
import { fuzzyMatch } from '../shared/utils/fuzzyMatch'
import { useSesionStore } from '../app/stores/sesionStore'

export type PaletteResultType =
  | 'paciente'
  | 'cita'
  | 'modulo'
  | 'accion'
  | 'configuracion'
  | 'documento'

export interface PaletteResult {
  tipo: PaletteResultType
  id: string
  label: string
  descripcion?: string
  icono: LucideIcon
  ejecutar: () => void
  categoria?: string
  sublabel?: string
  action?: () => void
}

export type PaletteItem = PaletteResult

export const PALETTE_CATEGORIA_ICONS: Record<string, LucideIcon> = {
  paciente: User,
  pacientes: User,
  cita: Calendar,
  citas: Calendar,
  modulo: Layers,
  modulos: Layers,
  accion: Zap,
  acciones: Zap,
  configuracion: Settings,
  documento: FileText,
  documentos: FileText,
}

export const PALETTE_CATEGORIA_LABELS: Record<string, string> = {
  paciente: 'Paciente',
  pacientes: 'Pacientes',
  cita: 'Cita',
  citas: 'Citas',
  modulo: 'Módulo',
  modulos: 'Módulos',
  accion: 'Acción Rápida',
  acciones: 'Acciones Rápidas',
  configuracion: 'Configuración',
  documento: 'Documento',
  documentos: 'Documentos',
}

export const ACCIONES_BASE = [
  { id: 'nueva-cita', label: 'Nueva cita', descripcion: 'Agendar cita médica en box', icono: PlusCircle },
  { id: 'nuevo-paciente', label: 'Nuevo paciente', descripcion: 'Ficha de ingreso rápido', icono: User },
  { id: 'nuevo-pago', label: 'Nuevo pago', descripcion: 'Registrar transacción o cobro', icono: CreditCard },
  { id: 'exportar-reportes', label: 'Exportar reportes', descripcion: 'Informes de gestión clínica', icono: FileSpreadsheet },
]

export const CONFIG_BASE = [
  { id: 'tema-oscuro', label: 'Tema Oscuro', descripcion: 'Modo noche optimizado', icono: Moon, tema: 'dark' as const },
  { id: 'tema-quirurgico', label: 'Tema Quirúrgico', descripcion: 'Alto contraste clínico', icono: Activity, tema: 'surgical' as const },
  { id: 'tema-claro', label: 'Tema Claro', descripcion: 'Modo día luminoso', icono: Sun, tema: 'light' as const },
  { id: 'preferencias', label: 'Preferencias', descripcion: 'Ajustes del sistema', icono: Sliders },
]

export const DOCUMENTOS_BASE = [
  { id: 'doc-presup', tipo: 'presupuesto', label: 'Presupuestos clínicos', descripcion: 'Planes comerciales y tratamientos', icono: FileText },
  { id: 'doc-recetas', tipo: 'receta', label: 'Recetas & Vademécum', descripcion: 'Prescripciones oficiales', icono: FileText },
]

export const buildPacienteResults = (
  pacientes: Paciente[],
  query: string,
  onNavigate: (s: string) => void,
  onSelectPaciente: (p: Paciente) => void
): PaletteResult[] => {
  const list = !query.trim()
    ? (pacientes || []).slice(0, 5)
    : (pacientes || []).filter(
        (p) =>
          fuzzyMatch(p.nombre, query) ||
          fuzzyMatch(p.rut, query) ||
          fuzzyMatch(p.telefono != null ? String(p.telefono) : '', query)
      ).slice(0, 5)

  return list.map((p) => ({
    tipo: 'paciente',
    categoria: 'pacientes',
    id: `pac-${p.id}`,
    label: p.nombre,
    descripcion: `RUT: ${p.rut || 'S/R'} · Tel: ${p.telefono != null ? String(p.telefono) : 'S/T'}`,
    icono: User,
    ejecutar: () => {
      onNavigate('Pacientes')
      onSelectPaciente(p)
      const sesion = useSesionStore.getState() as { agregarPacienteReciente?: (pac: Paciente) => void }
      sesion.agregarPacienteReciente?.(p)
    },
  }))
}

export const buildCitaResults = (
  citas: Array<{ id?: string | number; pacienteNombre?: string; motivo?: string; fecha?: string; hora?: string; horaInicio?: string }>,
  query: string,
  onNavigate: (s: string) => void,
  onOpenCita?: (id: string | number) => void
): PaletteResult[] => {
  const list = !query.trim()
    ? citas.slice(0, 5)
    : citas.filter((c) => fuzzyMatch(c.pacienteNombre, query) || fuzzyMatch(c.motivo, query)).slice(0, 5)

  return list.map((c) => ({
    tipo: 'cita',
    categoria: 'citas',
    id: `cita-${c.id || Math.random()}`,
    label: c.pacienteNombre ? `Cita: ${c.pacienteNombre}` : `Cita: ${c.motivo || 'General'}`,
    descripcion: `${c.fecha || ''} a las ${c.hora || c.horaInicio || ''} · ${c.motivo || ''}`,
    icono: Calendar,
    ejecutar: () => {
      onNavigate('Agenda')
      if (c.id != null) onOpenCita?.(c.id)
    },
  }))
}

export const buildModuloResults = (
  items: Array<{ name: string; slug?: string; icon?: LucideIcon }>,
  query: string,
  onNavigate: (s: string) => void
): PaletteResult[] => {
  const list = !query.trim()
    ? items.slice(0, 5)
    : items.filter((m) => fuzzyMatch(m.name, query) || (m.slug && fuzzyMatch(m.slug, query))).slice(0, 5)

  return list.map((m) => ({
    tipo: 'modulo',
    categoria: 'modulos',
    id: `mod-${m.slug}`,
    label: m.name,
    descripcion: 'Navegación directa',
    icono: m.icon || Layers,
    ejecutar: () => onNavigate(m.name),
  }))
}

export const buildAccionResults = (
  items: typeof ACCIONES_BASE,
  onEjecutarAccion?: (id: string) => void,
  fallbackNavigate?: (sec: string) => void
): PaletteResult[] =>
  items.map((a) => ({
    tipo: 'accion',
    categoria: 'acciones',
    id: a.id,
    label: a.label,
    descripcion: a.descripcion,
    icono: a.icono,
    ejecutar: () => {
      if (onEjecutarAccion) onEjecutarAccion(a.id)
      else if (a.id === 'nueva-cita') fallbackNavigate?.('Agenda')
      else if (a.id === 'nuevo-paciente') fallbackNavigate?.('Pacientes')
      else if (a.id === 'nuevo-pago') fallbackNavigate?.('Pagos')
      else if (a.id === 'exportar-reportes') fallbackNavigate?.('Reportes')
    },
  }))

export const buildConfigResults = (
  items: typeof CONFIG_BASE,
  setTheme: (t: 'dark' | 'surgical' | 'light') => void,
  onOpenPreferencias?: () => void
): PaletteResult[] =>
  items.map((c) => ({
    tipo: 'configuracion',
    categoria: 'configuracion',
    id: c.id,
    label: c.label,
    descripcion: c.descripcion,
    icono: c.icono,
    ejecutar: () => {
      if (c.tema) setTheme(c.tema)
      onOpenPreferencias?.()
    },
  }))

export const buildDocumentoResults = (
  items: typeof DOCUMENTOS_BASE,
  onOpenDocumento?: (doc: { tipo: string; id: string | number }) => void,
  fallbackNavigate?: (sec: string) => void
): PaletteResult[] =>
  items.map((d) => ({
    tipo: 'documento',
    categoria: 'documentos',
    id: d.id,
    label: d.label,
    descripcion: d.descripcion,
    icono: d.icono,
    ejecutar: () => {
      if (onOpenDocumento) onOpenDocumento({ tipo: d.tipo, id: d.id })
      else fallbackNavigate?.(d.tipo === 'receta' ? 'Vademécum' : 'Presupuestos')
    },
  }))
