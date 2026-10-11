/**
 * Modal — Componente base del Design System (F7-25 Fase 3, Iteración 2)
 *
 * Modal reutilizable con accesibilidad F6-04 incorporada:
 * - Cierre con ESC
 * - Trampa de foco con Tab/Shift+Tab
 * - Click en overlay para cerrar (opcional)
 * - aria-modal, role="dialog", aria-labelledby
 */
import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Icon } from '../Icon'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const SIZE_STYLES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  size?: ModalSize
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  zIndex?: string
  'aria-label'?: string
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  zIndex = 'z-50',
  'aria-label': ariaLabel,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Trampa de foco + ESC (F6-04)
  useEffect(() => {
    if (!isOpen) return

    // Guardar elemento que tenía foco antes de abrir el modal
    previousActiveElement.current = document.activeElement as HTMLElement | null

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cerrar con ESC
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Trampa de foco con Tab
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (!firstElement) return

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Enfocar primer elemento focusable al abrir
    requestAnimationFrame(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (firstFocusable) {
          firstFocusable.focus()
        } else {
          modalRef.current.focus()
        }
      }
    })

    // Prevenir scroll del body cuando el modal está abierto
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      // Restaurar foco al elemento previo
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose, closeOnEscape])

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md
  const titleId =
    typeof title === 'string'
      ? `modal-title-${title.toLowerCase().replace(/\s+/g, '-')}`
      : undefined

  return createPortal(
    <div
      className={`fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm ${zIndex} flex items-center justify-center p-4 animate-in fade-in duration-200`}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`bg-surface border border-surface rounded-2xl shadow-2xl w-full ${sizeStyle} max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 bg-surface-muted surgical:bg-graphite-200 border-b border-surface px-6 py-4 flex items-center justify-between z-10">
            <h2 id={titleId} className="text-xl font-bold text-graphite-900 dark:text-graphite-50">
              {title}
            </h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-graphite-400 hover:text-graphite-600 dark:text-graphite-400 dark:hover:text-graphite-200 transition-colors p-1 rounded-lg hover:bg-graphite-200 dark:hover:bg-graphite-700"
                aria-label="Cerrar modal"
                type="button"
              >
                <Icon icon={X} size="md" />
              </button>
            )}
          </div>
        )}

        {/* Contenido */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

Modal.displayName = 'Modal'
