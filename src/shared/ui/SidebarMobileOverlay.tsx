import React, { useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useSidebarStore } from '../../app/stores/useSidebarStore'
import { Sidebar, type SidebarProps } from './Sidebar'

export const SidebarMobileOverlay: React.FC<SidebarProps> = (props) => {
  const mobileOpen = useSidebarStore((s) => s.mobileOpen)
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, setMobileOpen])

  return (
    <AnimatePresence>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" data-testid="sidebar-mobile-overlay">
          {/* Backdrop con click para cerrar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Drawer slide-in 250ms */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 w-64 max-w-[85vw] h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl bg-white dark:bg-graphite-950 flex flex-col"
          >
            <Sidebar
              {...props}
              mode="expanded"
              setActiveSection={(section) => {
                props.setActiveSection(section)
                setMobileOpen(false)
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
