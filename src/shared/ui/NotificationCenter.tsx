/**
 * NotificationCenter — Centro de Notificaciones lateral de 320px (Blueprint 03)
 * Slide-in Framer Motion 250ms, 3 severidades: Crítica (#E11D48), Operativa (#0D9488), Informativa (#D97706)
 * "Marcar todas" limpia operativas e informativas, preservando críticas activas.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, AlertTriangle, CheckCircle2, Info, CheckCheck } from 'lucide-react'
import { notificationService, type NotificationItem } from '../../infrastructure/notification/notificationService'
import { useNotifications } from '../hooks/useNotifications'

export interface NotificationCenterItem {
  id: string
  severity?: 'critical' | 'operational' | 'informational'
  tipo?: 'error' | 'warning' | 'info' | 'success'
  title?: string
  titulo?: string
  message?: string
  mensaje?: string
  timestamp: number
  action?: { label: string; onClick: () => void }
}

export interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notifications?: NotificationCenterItem[] | NotificationItem[]
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications: notificationsProp,
}) => {
  const hookNotificaciones = useNotifications()
  const notificaciones = notificationsProp ?? hookNotificaciones

  const criticas = notificaciones.filter((n) => (n as NotificationCenterItem).severity === 'critical' || n.tipo === 'error')
  const operativas = notificaciones.filter((n) => (n as NotificationCenterItem).severity === 'operational' || n.tipo === 'info' || n.tipo === 'warning')
  const informativas = notificaciones.filter((n) => (n as NotificationCenterItem).severity === 'informational' || n.tipo === 'success')

  const [leidas, setLeidas] = useState<Set<string>>(new Set())

  const handleDismiss = (id: string) => notificationService.ocultar(id)

  const handleToggleLeida = (id: string) => {
    setLeidas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleMarcarTodas = () => {
    const aDescartar = notificaciones.filter((n) => (n as NotificationCenterItem).severity !== 'critical' && n.tipo !== 'error')
    aDescartar.forEach((n) => notificationService.ocultar(n.id))
  }

  const renderItem = (
    item: NotificationCenterItem | NotificationItem,
    severidad: 'critica' | 'operativa' | 'informativa'
  ) => {
    const isCritica = severidad === 'critica'
    const isOperativa = severidad === 'operativa'
    const isLeida = leidas.has(item.id)
    const title = (item as NotificationCenterItem).title || item.titulo
    const message = (item as NotificationCenterItem).message || item.mensaje
    const action = (item as NotificationCenterItem).action

    return (
      <div
        key={item.id}
        onClick={() => handleToggleLeida(item.id)}
        className={`p-3 rounded-xl border transition-all relative flex items-start gap-2.5 cursor-pointer ${
          isLeida ? 'opacity-50' : 'opacity-100'
        } ${
          isCritica
            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-[#E11D48]/40'
            : isOperativa
            ? 'bg-teal-50/70 dark:bg-teal-950/30 border-[#0D9488]/40'
            : 'bg-amber-50/70 dark:bg-amber-950/30 border-[#D97706]/40'
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {isCritica ? (
            <AlertTriangle size={15} className="text-[#E11D48]" />
          ) : isOperativa ? (
            <CheckCircle2 size={15} className="text-[#0D9488]" />
          ) : (
            <Info size={15} className="text-[#D97706]" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-4">
          {title && (
            <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100 truncate">
              {title}
            </p>
          )}
          {message && (
            <p className="text-xs text-graphite-700 dark:text-graphite-300 leading-relaxed break-words">
              {message}
            </p>
          )}
          {action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
              }}
              className="text-xs font-medium hover:underline block mt-1.5 cursor-pointer"
              style={{
                color: isCritica ? '#E11D48' : isOperativa ? '#0D9488' : '#D97706',
              }}
            >
              {action.label}
            </button>
          )}
          <span className="text-[10px] text-graphite-400 mt-1 block">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleDismiss(item.id)
          }}
          className="absolute top-2.5 right-2.5 text-graphite-400 hover:text-graphite-700 dark:hover:text-graphite-200 p-1 cursor-pointer"
          aria-label="Descartar notificación"
          title="Descartar"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop blur 12px */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[12px]"
            aria-hidden="true"
          />

          {/* Panel lateral 320px con slide-in */}
          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 h-full w-[320px] bg-white dark:bg-graphite-950 border-l border-surface shadow-2xl z-50 flex flex-col"
            role="dialog"
            aria-label="Centro de notificaciones"
            data-testid="notification-center-drawer"
          >
            {/* Header */}
            <div className="p-4 border-b border-surface flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                <h2 className="font-bold text-sm text-graphite-900 dark:text-graphite-100">
                  Notificaciones
                </h2>
                {notificaciones.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-champagne-700 dark:text-gold-satin">
                    {notificaciones.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {operativas.length + informativas.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarTodas}
                    title="Marcar todas como leídas (excepto críticas)"
                    aria-label="Marcar todas como leídas"
                    className="p-1.5 text-graphite-400 hover:text-primary rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    <CheckCheck size={14} />
                    <span className="hidden sm:inline">Marcar todas</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar notificaciones"
                  className="p-1.5 text-graphite-400 hover:text-graphite-800 dark:hover:text-graphite-200 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Lista agrupada en 3 severidades */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {notificaciones.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-graphite-400 dark:text-graphite-500">
                  <Bell size={32} className="mb-2 opacity-30 stroke-1" />
                  <p className="text-xs font-semibold">Sin notificaciones pendientes</p>
                  <p className="text-[11px] mt-1">Tu clínica y agenda están al día.</p>
                </div>
              ) : (
                <>
                  {[
                    { key: 'critica' as const, label: 'Críticas', items: criticas, color: 'text-[#E11D48]', extra: 'Atención inmediata' },
                    { key: 'operativa' as const, label: 'Operativas', items: operativas, color: 'text-[#0D9488]' },
                    { key: 'informativa' as const, label: 'Informativas', items: informativas, color: 'text-[#D97706]' },
                  ].map(({ key, label, items, color, extra }) => items.length > 0 && (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>
                          {label} ({items.length})
                        </span>
                        {extra && <span className="text-[9px] text-graphite-400">{extra}</span>}
                      </div>
                      {items.map((item) => renderItem(item, key))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
