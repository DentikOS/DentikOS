/**
 * Sidebar — Blueprint 02: 5 Categorías Core, Trazo de Cera Quirúrgico y Cascada Framer Motion
 * Respetando arquitectura DDD y límite estricto de 250 líneas.
 */
import React, { useMemo, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useIsInitialMount } from '../hooks/useCascadeAnimation'
import { usePermissions } from '../hooks/usePermissions'
import { SidebarHeader } from './SidebarHeader'
import { SidebarFooter } from './SidebarFooter'
import { SidebarItemAnimated } from './SidebarItemAnimated'
import { useSidebarStore, type SidebarMode } from '../../app/stores/useSidebarStore'
import { useDarkMode } from '../hooks/useDarkMode'
import { useNombreClinica } from '../hooks/useNombreClinica'
import { useSedes } from '../../domains/organization/clinic/hooks/useSedes'
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
  const { seccionesFiltradas: seccionesVisibles } = usePermissions()
  const { sedeActiva } = useSedes()
  const prefersReducedMotion = useReducedMotion()
  const isInitialMount = useIsInitialMount()
  const shouldAnimate = Boolean(isInitialMount && !prefersReducedMotion)

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

  if (focusMode || mode === 'hidden') return null

  return (
    <aside
      className={`${isCollapsed ? 'w-16 px-2 py-3' : 'w-60 p-3'} bg-white dark:bg-graphite-950 surgical:bg-graphite-300 border-r border-surface ${propMode ? 'h-full' : 'min-h-screen'} flex flex-col justify-between transition-[width] duration-300 select-none print:hidden z-30`}
      role="navigation"
      aria-label="Menú principal"
    >
      <div>
        {/* Header: Logo DentikOS con fade-in 50ms */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.05,
            ease: [0, 0, 0.2, 1],
          }}
        >
          <SidebarHeader
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setMode(isCollapsed ? 'expanded' : 'collapsed')}
            clinicaNombre={clinicaNombre}
            sedeNombre={sedeNombre}
          />
        </motion.div>

        {/* 5 Categorías Core en cascada Framer Motion */}
        <nav aria-label="Navegacion principal" className="space-y-2 mt-2">
          {seccionesVisibles.map((seccion, categoriaIndex) => {
            const categoriaDelay = 0.1 + categoriaIndex * 0.03

            return (
              <div key={seccion.categoria || seccion.label}>
                {/* Separador con delay */}
                <motion.div
                  initial={shouldAnimate ? { opacity: 0, scaleX: 0 } : false}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{
                    duration: 0.25,
                    delay: categoriaDelay,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="border-t border-[#E2E8F0] dark:border-[#24334A] my-2 mx-2 origin-left"
                />

                {/* Label de categoría con slide-up */}
                {!isCollapsed && (
                  <motion.div
                    initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: categoriaDelay + 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <p className="px-2 mb-1 text-[10px] text-graphite-400 dark:text-graphite-500 font-bold uppercase tracking-wider">
                      {seccion.label}
                    </p>
                  </motion.div>
                )}

                {/* Items con delay incremental de 30ms */}
                <div className="space-y-0.5">
                  {seccion.items.map((item, itemIndex) => {
                    const itemDelay = categoriaDelay + 0.1 + itemIndex * 0.03
                    const activo = activeSection === item.name || (item.slug === 'urgencias-ges' && activeSection === 'Urgencias y GES')
                    const contador = item.counterKey ? (counters as Record<string, unknown>)[item.counterKey] : undefined
                    const muestraContador = typeof contador === 'number' && contador > 0

                    return (
                      <motion.div
                        key={item.slug}
                        initial={shouldAnimate ? { opacity: 0, x: -10 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.35,
                          delay: itemDelay,
                          ease: [0.16, 1, 0.3, 1],
                        }}
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
            )
          })}
        </nav>
      </div>

      {/* Footer: SidebarFooter unificado */}
      <div className="pt-3 border-t border-surface px-1 overflow-visible">
        <SidebarFooter compact={isCollapsed} />
      </div>
    </aside>
  )
}

Sidebar.displayName = 'Sidebar'
