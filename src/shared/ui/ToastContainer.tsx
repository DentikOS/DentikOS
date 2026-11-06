import React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Info, CheckCircle2, AlertTriangle, XCircle, LucideIcon } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { notificationService, NotificationItem, NotificationType } from '../../infrastructure/notification/notificationService'

/**
 * Contenedor de toasts (F5-05).
 *
 * Se monta UNA VEZ en App.jsx. Renderiza todos los toasts activos
 * en la esquina superior derecha.
 *
 * Tipos soportados:
 * - info (azul)
 * - success (verde)
 * - warning (amarillo)
 * - error (rojo)
 */

interface ToastStyleConfig {
  bg: string
  border: string
  text: string
  iconColor: string
  icon: LucideIcon
}

const CONFIG_POR_TIPO: Record<NotificationType, ToastStyleConfig> = {
  info: {
    bg: 'bg-blue-50 dark:bg-surface ',
    border: 'border-blue-400 dark:border-blue-500/60 ',
    text: 'text-blue-900 dark:text-blue-200 ',
    iconColor: 'text-blue-600 dark:text-blue-400 ',
    icon: Info,
  },
  success: {
    bg: 'bg-green-50 dark:bg-surface ',
    border: 'border-green-400 dark:border-green-500/60 ',
    text: 'text-green-900 dark:text-green-200 ',
    iconColor: 'text-green-600 dark:text-green-400 ',
    icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-surface ',
    border: 'border-yellow-400 dark:border-yellow-500/60 ',
    text: 'text-yellow-900 dark:text-yellow-200 ',
    iconColor: 'text-yellow-600 dark:text-yellow-400 ',
    icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-50 dark:bg-surface ',
    border: 'border-red-400 dark:border-red-500/60 ',
    text: 'text-red-900 dark:text-red-200 ',
    iconColor: 'text-red-600 dark:text-red-400 ',
    icon: XCircle,
  },
}

interface ToastItemProps {
  notificacion: NotificationItem
}

const ToastItem: React.FC<ToastItemProps> = ({ notificacion }) => {
  const config = CONFIG_POR_TIPO[notificacion.tipo] || CONFIG_POR_TIPO.info
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 14, scale: 0.985 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.18, ease: [0.23, 1, 0.32, 1] }}
      className={`${config.bg} ${config.border} flex min-w-[300px] max-w-md items-start gap-3 rounded-xl border-l-4 p-4 shadow-lg`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">{React.createElement(config.icon, { size: 18, className: config.iconColor })}</div>
      <div className="flex-1 min-w-0">
        {notificacion.titulo && (
          <div className={`font-bold ${config.text} text-xs uppercase tracking-wider mb-1`}>
            {notificacion.titulo}
          </div>
        )}
        <div className={`${config.text} text-xs break-words font-medium`}>
          {notificacion.mensaje}
        </div>
      </div>
      {notificacion.dismissable && (
        <button
          onClick={() => notificationService.ocultar(notificacion.id)}
          className={`flex-shrink-0 ${config.text} hover:opacity-70 text-lg leading-none p-1 transition-opacity duration-150 cursor-pointer`}
          aria-label="Cerrar notificación"
          title="Cerrar"
        >
          ×
        </button>
      )}
    </motion.div>
  )
}

export const ToastContainer: React.FC = () => {
  const notificaciones = useNotifications()

  if (notificaciones.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col items-end pointer-events-auto"
      aria-label="Notificaciones del sistema"
    >
      <AnimatePresence initial={false}>
        {notificaciones.map((notif) => (
          <ToastItem key={notif.id} notificacion={notif} />
        ))}
      </AnimatePresence>
    </div>
  )
}

ToastContainer.displayName = 'ToastContainer'
