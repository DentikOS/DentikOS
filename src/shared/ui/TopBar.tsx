/**
 * TopBar — Blueprint 03: 3 Zonas (Contexto 40%, Búsqueda 30%, Identidad/Acciones 30%)
 * Altura 56px desktop / 52px tablet / 48px mobile. Acento contextual por módulo.
 */
import React, { useState, useMemo } from 'react'
import { Search, Bell } from 'lucide-react'
import { ClinicaSelector } from './ClinicaSelector'
import { SelectorSede } from './SelectorSede'
import { NotificationCenter } from './NotificationCenter'
import { TopBarBreadcrumbs } from './TopBarBreadcrumbs'
import { TopBarActions, type AccionContextualItem } from './TopBarActions'
import { TopBarAvatarMenu } from './TopBarAvatarMenu'
import { useNotifications } from '../hooks/useNotifications'
import { useSedeSincronizada } from '../hooks/useSedeSincronizada'
import { useContextualIntelligence } from '../hooks/useContextualIntelligence'
import { useSidebarStore } from '../../app/stores/useSidebarStore'
import { useTopBarStore, type BreadcrumbItem } from '../../app/stores/useTopBarStore'
import type { Paciente } from '../../domains/clinical/patient/schemas/pacienteSchema'

export type AppTheme = 'light' | 'dark' | 'surgical'

const ACENTOS_MODULO: Record<string, string> = {
  Dashboard: '#B88E3A',
  Pacientes: '#B88E3A',
  Pagos: '#B88E3A',
  Agenda: '#0284C7',
  Esterilización: '#0D9488',
  'Urgencias GES': '#DC2626',
  'Urgencias y GES': '#DC2626',
  Inventario: '#D97706',
  Vademécum: '#0D9488',
}

export interface TopBarUserProfile {
  nombreCompleto?: string
  email?: string
  rol?: string
  [key: string]: unknown
}

export interface TopBarProps {
  userProfile?: TopBarUserProfile | null
  activeSection?: string
  pacienteSeleccionado?: Paciente | null
  breadcrumbs?: BreadcrumbItem[]
  accionPrimaria?: AccionContextualItem | null
  accionesSecundarias?: AccionContextualItem[]
  onLogout?: () => void
  darkMode?: boolean
  theme?: AppTheme | string
  onCambioClinica?: (nuevaClinicaId: string) => void
  onOpenSearch?: () => void
  onOpenAtajos?: () => void
  onOpenPerfil?: () => void
  onOpenPreferencias?: () => void
  onOpenDispositivos?: () => void
  hamburger?: React.ReactNode
}

export const TopBar: React.FC<TopBarProps> = ({
  userProfile,
  activeSection = 'Dashboard',
  pacienteSeleccionado,
  breadcrumbs = [{ label: 'Dashboard' }],
  accionPrimaria,
  accionesSecundarias = [],
  onLogout,
  theme,
  onCambioClinica,
  onOpenSearch,
  onOpenAtajos,
  onOpenPerfil,
  onOpenPreferencias,
  onOpenDispositivos,
  hamburger,
}) => {
  const [notifOpen, setNotifOpen] = useState(false)
  const notificaciones = useNotifications()
  const focusMode = useSidebarStore((s) => s.focusMode)
  const presentationMode = useTopBarStore((s) => s.presentationMode)
  const sedeSincronizada = useSedeSincronizada()
  const contextualMessage = useContextualIntelligence(pacienteSeleccionado)

  const isSurgical = theme === 'surgical'
  const acentoColor = ACENTOS_MODULO[activeSection] || '#B88E3A'

  if (isSurgical || focusMode || presentationMode) return null

  return (
    <>
      <header className="sticky top-0 z-40 bg-white dark:bg-surface surgical:bg-surface border-b border-surface shadow-2xs transition-all flex flex-col">
        {/* Acento por módulo activo (borde superior de 2px) */}
        <div className="h-[2px] w-full shrink-0 transition-colors" style={{ backgroundColor: acentoColor }} />

        <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-12 sm:h-[52px] lg:h-[56px] gap-2 sm:gap-3">
          {/* Zona Izquierda 40%: Breadcrumbs, Timer, isDirty y Contextual Intelligence */}
          <div className="flex items-center gap-2 sm:gap-3 w-[40%] min-w-0">
            {hamburger}
            <TopBarBreadcrumbs
              items={breadcrumbs}
              pacienteId={pacienteSeleccionado?.id ? String(pacienteSeleccionado.id) : null}
            />
            {contextualMessage && (
              <span
                data-testid="topbar-contextual-message"
                className="hidden md:inline text-[11px] text-[#94A3B8] truncate shrink-0 max-w-[200px]"
              >
                {contextualMessage}
              </span>
            )}
          </div>

          {/* Zona Centro 30%: Búsqueda ⌘K */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 w-[30%]">
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex items-center justify-between w-full max-w-[200px] sm:max-w-[240px] px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs text-graphite-500 dark:text-graphite-400 bg-graphite-100/80 dark:bg-graphite-800/80 hover:bg-graphite-200 dark:hover:bg-graphite-700/80 rounded-lg border border-surface transition-colors cursor-pointer"
              title="Buscar (⌘K)"
              aria-label="Buscar pacientes y módulos"
            >
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <Search size={13} className="text-primary shrink-0" />
                <span className="truncate hidden sm:inline">Buscar...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-white dark:bg-graphite-900 rounded border border-surface shadow-2xs shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Zona Derecha 30%: Acciones contextuales, Pill Sede, Bell 36px y Avatar 32px */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 w-[30%] shrink-0">
            {/* Acciones contextuales (primaria dorada + menú ⋯) */}
            <TopBarActions
              primaria={accionPrimaria}
              secundarias={accionesSecundarias}
              className="hidden lg:flex"
            />

            {/* Pill Sede compacta (alto 32px, max-w-[160px]) */}
            <div className="hidden md:flex items-center shrink-0">
              <div className="sr-only" aria-hidden="true">
                <ClinicaSelector onCambioClinica={onCambioClinica} />
              </div>
              <SelectorSede compacto sincronizado={sedeSincronizada} />
            </div>

            {/* Centro de Notificaciones (botón 36px con badge dorado) */}
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Centro de notificaciones"
              className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-graphite-600 dark:text-graphite-300 hover:bg-graphite-100 dark:hover:bg-graphite-800 transition-colors cursor-pointer shrink-0"
            >
              <Bell size={16} className="sm:hidden" />
              <Bell size={18} className="hidden sm:block" />
              {notificaciones.length > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-black font-extrabold text-[8px] flex items-center justify-center shadow-xs">
                  {notificaciones.length > 9 ? '9+' : notificaciones.length}
                </span>
              )}
            </button>

            {/* Avatar con Dropdown de 6 Secciones */}
            <TopBarAvatarMenu
              userProfile={userProfile}
              onLogout={onLogout}
              onOpenAtajos={onOpenAtajos ?? (() => window.dispatchEvent(new CustomEvent('open-shortcuts-modal')))}
              onOpenPerfil={onOpenPerfil}
              onOpenPreferencias={onOpenPreferencias}
              onOpenDispositivos={onOpenDispositivos}
            />
          </div>
        </div>
      </header>

      {/* Drawer de Notificaciones */}
      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}

TopBar.displayName = 'TopBar'
