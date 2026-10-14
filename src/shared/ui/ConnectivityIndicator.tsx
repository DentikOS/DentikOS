/**
 * ConnectivityIndicator — Resiliencia offline absoluta (Blueprint 02 §05)
 * 
 * Estados:
 * - 🟢 Conectado: "Sincronizado hace 2 min"
 * - 🟡 Sin conexión: "Cambios locales pendientes"
 * - 🔴 Error: "Error de sincronización" + botón Reintentar
 */
import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

export interface ConnectivityIndicatorProps {
  compact?: boolean
  className?: string
  onRetry?: () => void
}

const formatDistanceToNow = (timestamp: number): string => {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'menos de 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h`
}

export const ConnectivityIndicator: React.FC<ConnectivityIndicatorProps> = ({
  compact = false,
  className = '',
  onRetry,
}) => {
  const status = useSidebarStore((s) => s.connectivityStatus)
  const lastSyncAt = useSidebarStore((s) => s.lastSyncAt)
  const setConnectivityStatus = useSidebarStore((s) => s.setConnectivityStatus)

  // Detección de estado inicial por si el navegador ya está offline
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false && status === 'connected') {
      setConnectivityStatus('pending')
    }
  }, [status, setConnectivityStatus])

  const config: Record<'connected' | 'pending' | 'error', {
    color: string
    icon: typeof Wifi
    text: string
    label: string
    showRetry?: boolean
  }> = {
    connected: {
      color: '#0D9488',
      icon: Wifi,
      text: lastSyncAt ? `Sincronizado hace ${formatDistanceToNow(lastSyncAt)}` : 'Sincronizado',
      label: 'Conectado',
    },
    pending: {
      color: '#D97706',
      icon: WifiOff,
      text: 'Cambios locales pendientes',
      label: 'Sin conexión (pendiente)',
    },
    error: {
      color: '#E11D48',
      icon: AlertCircle,
      text: 'Error de sincronización',
      label: 'Error de sincronización',
      showRetry: true,
    },
  }

  const current = config[status] || config.connected
  const Icon = current.icon

  const handleRetry = async () => {
    if (onRetry) {
      onRetry()
      return
    }
    setConnectivityStatus('connected')
  }

  if (compact) {
    return (
      <div
        data-testid="connectivity-indicator-compact"
        className={`flex items-center justify-center p-1.5 cursor-pointer select-none ${className}`}
        title={current.text}
        aria-label="Conectado"
      >
        <motion.span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: current.color }}
          animate={{
            scale: status === 'error' ? [1, 1.3, 1] : 1,
            opacity: status === 'pending' ? [1, 0.4, 1] : 1,
          }}
          transition={{
            duration: 1.5,
            repeat: status !== 'connected' ? Infinity : 0,
          }}
        />
      </div>
    )
  }

  return (
    <div
      data-testid="connectivity-indicator"
      className={`flex items-center gap-1.5 text-[11px] text-[#94A3B8] dark:text-[#64748B] select-none ${className}`}
      aria-label={current.label}
    >
      <motion.div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: current.color }}
        animate={{
          scale: status === 'error' ? [1, 1.25, 1] : 1,
          opacity: status === 'pending' ? [1, 0.5, 1] : 1,
        }}
        transition={{
          duration: 1.5,
          repeat: status !== 'connected' ? Infinity : 0,
        }}
      />
      <Icon size={12} style={{ color: current.color }} className="shrink-0" />
      <span className="truncate">{current.text}</span>
      {current.showRetry && (
        <button
          type="button"
          onClick={handleRetry}
          className="text-[10px] font-medium text-[#B88E3A] hover:underline cursor-pointer ml-auto shrink-0"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

ConnectivityIndicator.displayName = 'ConnectivityIndicator'
