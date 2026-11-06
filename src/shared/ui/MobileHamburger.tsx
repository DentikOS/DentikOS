import React from 'react'
import { Menu } from 'lucide-react'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

export const MobileHamburger: React.FC = () => {
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen)

  return (
    <button
      type="button"
      data-testid="mobile-hamburger-btn"
      onClick={() => setMobileOpen(true)}
      aria-label="Abrir menú de navegación"
      className="h-11 w-11 md:hidden inline-flex items-center justify-center rounded-xl text-graphite-600 dark:text-graphite-300 hover:bg-graphite-100 dark:hover:bg-graphite-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
    >
      <Menu className="w-5 h-5" aria-hidden="true" />
    </button>
  )
}
