/**
 * PreferenciasModal — Panel de preferencias personales (Blueprint 03)
 *
 * Modal con 4 tabs:
 * - Tema: modo claro/quirúrgico/oscuro (delegado a useSidebarStore)
 * - Idioma: selector ES/EN
 * - Notificaciones: toggles de severidades
 * - Accesibilidad: feedback sonoro, reducción de movimiento
 *
 * Ancho: 560px · Backdrop blur 12px · Cierre con Esc + click outside
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Palette, Languages, Bell, Accessibility } from 'lucide-react'
import { useDarkMode, type Theme } from '../hooks/useDarkMode'
import { Icon } from './Icon'
import { Button } from './ui/Button'

export interface PreferenciasModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabId = 'tema' | 'idioma' | 'notificaciones' | 'accesibilidad'

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ size?: number }>
}

const TABS: Tab[] = [
  { id: 'tema', label: 'Tema', icon: Palette },
  { id: 'idioma', label: 'Idioma', icon: Languages },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { id: 'accesibilidad', label: 'Accesibilidad', icon: Accessibility },
]

export const PreferenciasModal: React.FC<PreferenciasModalProps> = ({ isOpen, onClose }) => {
  const [tabActiva, setTabActiva] = useState<TabId>('tema')
  const modalRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useDarkMode()

  // Cerrar con Esc
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // Click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  const THEMES: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Claro', icon: '' },
    { value: 'surgical', label: 'Quirúrgico', icon: '' },
    { value: 'dark', label: 'Oscuro', icon: '' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(7,11,20,0.5)' }}
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-[560px] max-w-full max-h-[90vh] bg-white dark:bg-graphite-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Preferencias"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface">
              <h2 className="text-lg font-semibold text-graphite-900 dark:text-graphite-50">
                Preferencias
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-graphite-100 dark:hover:bg-graphite-800 cursor-pointer"
                aria-label="Cerrar"
              >
                <Icon icon={X} size="sm" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-surface px-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTabActiva(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                    tabActiva === tab.id
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-graphite-500 hover:text-graphite-900 dark:hover:text-graphite-200'
                  }`}
                >
                  <Icon icon={tab.icon} size="sm" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Contenido de tab activa */}
            <div className="flex-1 overflow-y-auto p-6">
              {tabActiva === 'tema' && (
                <div className="space-y-3">
                  <p className="text-sm text-graphite-600 dark:text-graphite-400 mb-4">
                    Selecciona el modo de visualización:
                  </p>
                  {THEMES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                        theme === t.value
                          ? 'border-primary bg-primary/5'
                          : 'border-surface hover:border-graphite-300'
                      }`}
                    >
                      <span className="text-2xl">{t.icon}</span>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-graphite-900 dark:text-graphite-100">{t.label}</p>
                        <p className="text-xs text-graphite-500">
                          {t.value === 'light' && 'Modo diurno para oficinas'}
                          {t.value === 'surgical' && 'Antirreflejo para box dental'}
                          {t.value === 'dark' && 'Para jornadas extendidas'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {tabActiva === 'idioma' && (
                <div className="space-y-3">
                  <p className="text-sm text-graphite-600 dark:text-graphite-400 mb-4">
                    Idioma de la interfaz:
                  </p>
                  <Button variant="primary" fullWidth>Español (Chile)</Button>
                  <Button variant="ghost" fullWidth disabled>English (Próximamente)</Button>
                </div>
              )}

              {tabActiva === 'notificaciones' && (
                <div className="space-y-4">
                  {[
                    { label: 'Notificaciones críticas', desc: 'Alergias, stock agotado, pagos vencidos', enabled: true },
                    { label: 'Notificaciones operativas', desc: 'Citas, esterilización', enabled: true },
                    { label: 'Notificaciones informativas', desc: 'Cumpleaños, recordatorios', enabled: true },
                  ].map((n, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface">
                      <div>
                        <p className="font-medium text-sm text-graphite-900 dark:text-graphite-100">{n.label}</p>
                        <p className="text-xs text-graphite-500">{n.desc}</p>
                      </div>
                      <input type="checkbox" defaultChecked={n.enabled} className="w-5 h-5 accent-primary cursor-pointer" />
                    </div>
                  ))}
                </div>
              )}

              {tabActiva === 'accesibilidad' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
                    <div>
                      <p className="font-medium text-sm text-graphite-900 dark:text-graphite-100">Feedback sonoro</p>
                      <p className="text-xs text-graphite-500">Micro-clics al navegar y guardar</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 accent-primary cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
                    <div>
                      <p className="font-medium text-sm text-graphite-900 dark:text-graphite-100">Reducir movimiento</p>
                      <p className="text-xs text-graphite-500">Desactiva animaciones y transiciones</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5 accent-primary cursor-pointer" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

PreferenciasModal.displayName = 'PreferenciasModal'
