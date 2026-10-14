/**
 * MultiDeviceIndicator — Soberanía digital (Blueprint 02 §05)
 * 
 * Muestra "🟢 2 dispositivos activos" con tooltip de lista cuando hay múltiples sesiones.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, Tablet } from 'lucide-react'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

export interface MultiDeviceIndicatorProps {
  compact?: boolean
  className?: string
  alwaysShow?: boolean
}

export const MultiDeviceIndicator: React.FC<MultiDeviceIndicatorProps> = ({
  compact = false,
  className = '',
  alwaysShow = false,
}) => {
  const devices = useSidebarStore((s) => s.activeDevices)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  if (compact) {
    return (
      <div
        data-testid="multi-device-indicator-compact"
        className={`flex items-center justify-center p-1.5 cursor-pointer ${className}`}
        aria-label={`${devices} dispositivo${devices === 1 ? '' : 's'} activo${devices === 1 ? '' : 's'}`}
        title={`${devices} dispositivo${devices === 1 ? '' : 's'} activo${devices === 1 ? '' : 's'}`}
      >
        <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
      </div>
    )
  }

  const isDev = Boolean(import.meta.env.DEV && import.meta.env.MODE !== 'test')

  if (devices < 2 && !alwaysShow && !isDev) return null

  if (devices < 2 && isDev) {
    return (
      <div
        data-testid="multi-device-indicator-dev"
        className={`flex items-center gap-1.5 text-[11px] text-[#94A3B8] dark:text-[#64748B] select-none ${className}`}
      >
        <div className="w-2 h-2 rounded-full bg-[#0D9488] shrink-0" />
        <span className="truncate">1 dispositivo activo</span>
      </div>
    )
  }

  return (
    <div
      data-testid="multi-device-indicator"
      className={`relative flex items-center gap-1.5 text-[11px] text-[#94A3B8] dark:text-[#64748B] cursor-help select-none ${className}`}
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      aria-label={`${devices} dispositivos activos`}
    >
      <div className="w-2 h-2 rounded-full bg-[#0D9488] shrink-0" />
      <span className="truncate">{devices} dispositivos activos</span>

      {/* Tooltip con lista de dispositivos */}
      <AnimatePresence>
        {tooltipOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 p-3 bg-[#0F172A] dark:bg-[#1E293B] rounded-lg shadow-xl z-50 min-w-[200px]"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#F8FAFC] text-xs">
                <Monitor size={14} />
                <span>Desktop (esta sesión)</span>
              </div>
              <div className="flex items-center gap-2 text-[#F8FAFC] text-xs">
                <Tablet size={14} />
                <span>iPad Box 3</span>
              </div>
            </div>
            <button
              type="button"
              className="mt-2 text-[10px] text-[#B88E3A] hover:underline cursor-pointer"
            >
              Cerrar sesiones remotas
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

MultiDeviceIndicator.displayName = 'MultiDeviceIndicator'
