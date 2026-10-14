/**
 * KeyboardShortcutsModal — Panel de Atajos (Blueprint 02 §07 Feature 02)
 * 
 * Modal elegante con backdrop blur 12px según Brand Manual §8.4.
 * Atajos organizados por 6 categorías para power users.
 */
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export interface Shortcut {
  keys: string
  description: string
}

export interface ShortcutCategory {
  title: string
  shortcuts: Shortcut[]
}

export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navegación',
    shortcuts: [
      { keys: '⌘K', description: 'Buscar pacientes, citas, módulos' },
      { keys: '⌘1', description: 'Ir a Dashboard' },
      { keys: '⌘2', description: 'Ir a Agenda' },
      { keys: '⌘3', description: 'Ir a Pacientes' },
    ],
  },
  {
    title: 'Creación',
    shortcuts: [
      { keys: '⌘N', description: 'Nueva cita (en Agenda)' },
      { keys: '⌘P', description: 'Nuevo paciente (en Pacientes)' },
    ],
  },
  {
    title: 'Guardado',
    shortcuts: [
      { keys: '⌘S', description: 'Guardar cambios' },
    ],
  },
  {
    title: 'Tema',
    shortcuts: [
      { keys: '⌘⇧D', description: 'Cambiar tema (Claro/Quirúrgico/Oscuro)' },
    ],
  },
  {
    title: 'Vista',
    shortcuts: [
      { keys: '⌘⇧F', description: 'Modo Foco' },
      { keys: '?', description: 'Abrir panel de atajos' },
    ],
  },
  {
    title: 'Sesión',
    shortcuts: [
      { keys: 'Esc', description: 'Cerrar modales / Salir de Modo Foco' },
    ],
  },
]

export interface KeyboardShortcutsModalProps {
  isOpen?: boolean
  onClose?: () => void
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = propIsOpen !== undefined
  const isOpen = isControlled ? propIsOpen : internalOpen

  const handleClose = () => {
    if (propOnClose) {
      propOnClose()
    } else {
      setInternalOpen(false)
    }
  }

  useEffect(() => {
    const handleOpenModal = () => setInternalOpen(true)
    const handleCloseModal = () => setInternalOpen(false)

    window.addEventListener('open-shortcuts-modal', handleOpenModal)
    window.addEventListener('close-shortcuts-modal', handleCloseModal)
    return () => {
      window.removeEventListener('open-shortcuts-modal', handleOpenModal)
      window.removeEventListener('close-shortcuts-modal', handleCloseModal)
    }
  }, [])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        data-shortcuts-modal="true"
        data-testid="keyboard-shortcuts-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop con blur 12px */}
        <div
          data-testid="shortcuts-modal-backdrop"
          className="absolute inset-0 bg-black/50 backdrop-blur-[12px]"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[640px] max-h-[80vh] bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl overflow-hidden border border-[#E2E8F0] dark:border-[#24334A] z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#24334A]">
            <h2 className="text-xl font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Atajos de Teclado
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] rounded-lg transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X size={20} className="text-graphite-500" />
            </button>
          </div>

          {/* Contenido con 6 categorías */}
          <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6">
            <div className="space-y-6">
              {SHORTCUT_CATEGORIES.map((category) => (
                <div key={category.title}>
                  <h3 className="text-xs font-semibold text-[#94A3B8] dark:text-[#64748B] uppercase tracking-wider mb-2">
                    {category.title}
                  </h3>
                  <div className="space-y-1.5">
                    {category.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.keys}
                        className="flex items-center justify-between py-1.5 border-b border-graphite-100 dark:border-graphite-800/40 last:border-0"
                      >
                        <span className="text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2.5 py-1 text-xs font-mono bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] rounded-md border border-[#E2E8F0] dark:border-[#24334A] shadow-2xs">
                          {shortcut.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

KeyboardShortcutsModal.displayName = 'KeyboardShortcutsModal'
