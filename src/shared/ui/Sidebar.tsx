/**
 * Sidebar — Blueprint 02: 5 Categorías Core, Trazo de Cera Quirúrgico y Cascada Framer Motion
 * Respetando arquitectura DDD y límite estricto de 250 líneas.
 */
import React, { useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRBAC } from '../hooks/useRBAC'
import { SidebarHeader } from './SidebarHeader'
import { SidebarFooter } from './SidebarFooter'
import { SidebarItemAnimated } from './SidebarItemAnimated'
import { useSidebarStore, type SidebarMode } from '../../app/stores/useSidebarStore'
import { useDarkMode } from '../hooks/useDarkMode'
import { useNombreClinica } from '../hooks/useNombreClinica'
import { useSedes } from '../../domains/organization/clinic/hooks/useSedes'
import { SECCIONES_SIDEBAR, type SidebarSeccion } from '../../constants/sidebarConstants'
import type { PerfilUsuario } from '../../infrastructure/auth/authService'
import type { SidebarCountersReturn } from '../hooks/useSidebarCounters'

export interface SidebarProps {
  userProfile?: PerfilUsuario | null
  activeSection: string
  setActiveSection: (section: string) => void
  onLogout?: () => void
  counters?: SidebarCountersReturn | Record<string, number | undefined>
  mode?: SidebarMode
}

export const Sidebar: React.FC<SidebarProps> = ({
  userProfile,
  activeSection,
  setActiveSection,
  counters = {},
  mode: propMode,
}) => {
  const storeMode = useSidebarStore((s) => s.mode)
  const setMode = useSidebarStore((s) => s.setMode)
  const preSurgicalMode = useSidebarStore((s) => s.preSurgicalMode)
  const setPreSurgicalMode = useSidebarStore((s) => s.setPreSurgicalMode)
  const focusMode = useSidebarStore((s) => s.focusMode)
  const { theme } = useDarkMode()
  const { puede } = useRBAC()
  const { sedeActiva } = useSedes()

  const mode = propMode ?? storeMode
  const isCollapsed = mode === 'collapsed'
  const clinicaNombre = useNombreClinica(userProfile?.clinicaNombre)
  const sedeNombre = sedeActiva?.nombre || 'Sede Principal'

  useEffect(() => {
    if (propMode) return

    if (theme === 'surgical') {
      if (storeMode !== 'collapsed') {
        setPreSurgicalMode(storeMode)
        setMode('collapsed')
      }
    } else if (preSurgicalMode) {
      setMode(preSurgicalMode)
      setPreSurgicalMode(null)
    }
  }, [theme, storeMode, preSurgicalMode, setMode, setPreSurgicalMode, propMode])

  useEffect(() => {
    if (propMode) return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mqlMobile = window.matchMedia('(max-width: 767px)')
    const mqlTablet = window.matchMedia('(min-width: 768px) and (max-width: 1024px)')

    const handleMedia = () => {
      if (mqlMobile.matches) {
        setMode('hidden')
      } else if (mqlTablet.matches) {
        setMode('collapsed')
      }
    }

    handleMedia()
    mqlMobile.addEventListener('change', handleMedia)
    mqlTablet.addEventListener('change', handleMedia)
    return () => {
      mqlMobile.removeEventListener('change', handleMedia)
      mqlTablet.removeEventListener('change', handleMedia)
    }
  }, [setMode, propMode])

  const seccionesVisibles = useMemo((): SidebarSeccion[] => (
    SECCIONES_SIDEBAR.map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => !item.permisoRequerido || puede(item.permisoRequerido)),
    })).filter((sec) => sec.items.length > 0)
  ), [puede])

  if (focusMode || mode === 'hidden') return null

  return (
    <aside
      className={`${isCollapsed ? 'w-16 px-2 py-3' : 'w-60 p-3'} bg-white dark:bg-graphite-950 surgical:bg-graphite-300 border-r border-surface ${propMode ? 'h-full' : 'min-h-screen'} flex flex-col justify-between transition-[width] duration-300 select-none print:hidden z-30`}
      role="navigation"
      aria-label="Menú principal"
    >
      <div>
        {/* Header: Logo DentikOS + Identidad + Toggle colapso */}
        <SidebarHeader
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setMode(isCollapsed ? 'expanded' : 'collapsed')}
          clinicaNombre={clinicaNombre}
          sedeNombre={sedeNombre}
        />

        {/* 5 Categorías Core en cascada Framer Motion */}
        <motion.nav
          aria-label="Navegacion principal"
          className="space-y-4"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
        >
          {seccionesVisibles.map((seccion) => (
            <div key={seccion.label}>
              {!isCollapsed ? (
                <p className="px-2 mb-1 text-[10px] text-graphite-400 dark:text-graphite-500 font-bold uppercase tracking-wider">
                  {seccion.label}
                </p>
              ) : (
                <div className="h-px bg-graphite-200 dark:bg-graphite-800 mx-1 mb-1.5" aria-hidden="true" />
              )}

              <div className="space-y-0.5">
                {seccion.items.map((item) => {
                  const activo = activeSection === item.name || (item.slug === 'urgencias-ges' && activeSection === 'Urgencias y GES')
                  const contador = item.counterKey ? (counters as Record<string, unknown>)[item.counterKey] : undefined
                  const muestraContador = typeof contador === 'number' && contador > 0

                  return (
                    <motion.div
                      key={item.slug}
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    >
                      <SidebarItemAnimated
                        icon={item.icon}
                        label={item.name}
                        slug={item.slug}
                        isActive={activo}
                        onClick={() => setActiveSection(item.name)}
                        isCollapsed={isCollapsed}
                        badge={muestraContador ? (contador as number) : undefined}
                        badgeColor={item.counterVariant === 'error' ? 'red' : item.counterVariant === 'warning' ? 'amber' : 'gold'}
                        title={muestraContador ? `${item.name} (${contador})` : item.name}
                      />
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.nav>
      </div>

      {/* Footer: SidebarFooter unificado */}
      <div className="pt-3 border-t border-surface px-1 overflow-visible">
        <SidebarFooter compact={isCollapsed} />
      </div>
    </aside>
  )
}

Sidebar.displayName = 'Sidebar'
