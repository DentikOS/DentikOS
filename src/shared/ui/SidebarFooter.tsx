/**
 * SidebarFooter — Footer unificado del Sidebar (Blueprint 02 + 03)
 *
 * En modo expandido: 3 líneas (ThemeSwitcher, Conexión + Dispositivos, Versión)
 * En modo compacto (64px): centrado vertical estricto sin desborde (ThemeSwitcher 36px, Conexión, Dispositivos)
 */
import React from 'react'
import { ConnectivityIndicator } from './ConnectivityIndicator'
import { MultiDeviceIndicator } from './MultiDeviceIndicator'
import { ThemeSwitcher } from './ThemeSwitcher'

export interface SidebarFooterProps {
  compact?: boolean
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div
        data-testid="sidebar-footer-compact"
        className="w-full flex flex-col items-center gap-1.5 pb-2 overflow-visible"
      >
        <ThemeSwitcher compact={true} />
        <ConnectivityIndicator compact={true} />
        <MultiDeviceIndicator compact={true} />
      </div>
    )
  }

  return (
    <div
      data-testid="sidebar-footer-expanded"
      className="border-t border-[#E2E8F0] dark:border-[#24334A] p-2 space-y-2 select-none overflow-hidden"
    >
      {/* Theme Switcher de 3 posiciones */}
      <ThemeSwitcher compact={false} />

      {/* Separador */}
      <div className="border-t border-[#E2E8F0] dark:border-[#24334A] my-1.5" />

      {/* Indicadores de estado */}
      <div className="space-y-1 px-1">
        <ConnectivityIndicator compact={false} />
        <MultiDeviceIndicator compact={false} />
      </div>

      {/* Versión de la app */}
      <div className="text-[10px] text-graphite-400 dark:text-graphite-500 text-center truncate pt-0.5">
        v1.0.0 · DentikOS
      </div>
    </div>
  )
}

SidebarFooter.displayName = 'SidebarFooter'
