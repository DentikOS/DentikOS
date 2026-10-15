/**
 * TopBarAvatarMenu — Dropdown de Avatar con 6 secciones (Blueprint 03 §06)
 * 
 * - Foto con borde dorado gradiente (#E5C378→#B88E3A)
 * - Iniciales en gradiente dorado si no hay foto
 * - Hover: scale 1.05 (100ms Instantáneo)
 * - Dropdown 280px, animación 180ms (scale + fade-in)
 * - Fondo bg-elevated (#F1F5F9 claro / #1E293B oscuro)
 * - Cierre: click fuera / Esc
 */
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Settings, Terminal, Maximize2, Smartphone, LogOut, Sun, Moon, Microscope } from 'lucide-react'
import { Badge } from './ui/Badge'
import { useSidebarStore } from '../../app/stores/useSidebarStore'
import { NOMBRES_ROLES } from '../../constants/rbacConstants'
import type { TopBarUserProfile } from './TopBar'

export interface TopBarAvatarMenuProps {
  userProfile?: TopBarUserProfile | null
  onLogout?: () => void
  onOpenAtajos?: () => void
  onOpenPerfil?: () => void
  onOpenPreferencias?: () => void
  onOpenDispositivos?: () => void
}

export const TopBarAvatarMenu: React.FC<TopBarAvatarMenuProps> = ({
  userProfile,
  onLogout,
  onOpenAtajos,
  onOpenPerfil,
  onOpenPreferencias,
  onOpenDispositivos,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const toggleFocusMode = useSidebarStore((s) => s.toggleFocusMode)
  const theme = useSidebarStore((s) => s.theme)
  const setTheme = useSidebarStore((s) => s.setTheme)

  // Iniciales (máximo 2 caracteres)
  const iniciales = useMemo(() => {
    if (!userProfile?.nombreCompleto) return 'U'
    const sinTitulo = userProfile.nombreCompleto
      .replace('Dr. ', '')
      .replace('Dra. ', '')
      .trim()

    const partes = sinTitulo.split(/\s+/)
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase()
    }
    return sinTitulo.slice(0, 2).toUpperCase()
  }, [userProfile?.nombreCompleto])

  const nombreRol =
    userProfile?.rol && userProfile.rol in NOMBRES_ROLES
      ? (NOMBRES_ROLES as Record<string, string>)[userProfile.rol]
      : 'Usuario'

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const SECCIONES = [
    { id: 'perfil', label: 'Perfil', icon: User, onClick: () => { setIsOpen(false); onOpenPerfil?.() } },
    { id: 'preferencias', label: 'Preferencias', icon: Settings, onClick: () => { setIsOpen(false); onOpenPreferencias?.() } },
    { id: 'atajos', label: 'Panel de Atajos', icon: Terminal, shortcut: '?', onClick: () => { setIsOpen(false); onOpenAtajos?.() } },
    { id: 'foco', label: 'Modo Foco', icon: Maximize2, shortcut: '⌘⇧F', onClick: () => { setIsOpen(false); toggleFocusMode() } },
    { id: 'dispositivos', label: 'Dispositivos', icon: Smartphone, onClick: () => { setIsOpen(false); onOpenDispositivos?.() } },
    { id: 'logout', label: 'Cerrar sesión', icon: LogOut, danger: true, onClick: () => { setIsOpen(false); onLogout?.() } },
  ]

  const fotoUrl = (userProfile as any)?.fotoUrl as string | undefined

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar con hover scale 1.05 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-0.5 rounded-full hover:ring-2 hover:ring-primary/40 hover:scale-105 transition-all duration-100 ease-out cursor-pointer shrink-0"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Menú de usuario"
        title={userProfile?.nombreCompleto || 'Mi sesión'}
      >
        {/* Círculo 32px con borde gradiente dorado */}
        <div
          className="w-8 h-8 rounded-full p-[1.5px] flex items-center justify-center shadow-xs overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #E5C378 0%, #B88E3A 100%)' }}
        >
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={userProfile?.nombreCompleto || 'Avatar'}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white dark:bg-graphite-900 text-primary font-bold rounded-full flex items-center justify-center text-[11px]">
              {iniciales}
            </div>
          )}
        </div>
        <span className="sr-only">{userProfile?.nombreCompleto || 'Mi sesión'}</span>
        <span className="sr-only">{nombreRol}</span>
      </button>

      {/* Dropdown 280px con animación 180ms */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.18,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute right-0 mt-2 w-[280px] bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#24334A] rounded-xl shadow-lg overflow-hidden z-50 py-1"
          >
            {/* Header Identidad */}
            <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-[#24334A]">
              {Boolean(userProfile?.clinicaNombre) && (
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 truncate">
                  {String(userProfile?.clinicaNombre)}
                </p>
              )}
              <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100 truncate">
                {userProfile?.nombreCompleto || 'Mi sesión'}
              </p>
              <p className="text-[11px] text-graphite-500 truncate">{userProfile?.email}</p>
              <div className="mt-1">
                <Badge size="sm" variant="neutral">{nombreRol}</Badge>
              </div>
            </div>

            {/* 6 Secciones del Blueprint 03 + Tema */}
            <div className="py-1">
              {SECCIONES.map((sec) => (
                <React.Fragment key={sec.id}>
                  {sec.id === 'logout' && (
                    <div className="border-t border-[#E2E8F0] dark:border-[#24334A] pt-2 px-2 my-1">
                      <p className="text-[10px] font-bold text-graphite-500 uppercase px-2 mb-1">Tema</p>
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${theme === 'light' ? 'bg-surface-muted font-bold text-graphite-900 dark:text-white' : 'hover:bg-surface-muted text-graphite-700 dark:text-graphite-300'}`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" /> Claro
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${theme === 'dark' ? 'bg-surface-muted font-bold text-graphite-900 dark:text-white' : 'hover:bg-surface-muted text-graphite-700 dark:text-graphite-300'}`}
                      >
                        <Moon className="w-3.5 h-3.5 text-indigo-400" /> Oscuro
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('surgical')}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${theme === 'surgical' ? 'bg-surface-muted font-bold text-graphite-900 dark:text-white' : 'hover:bg-surface-muted text-graphite-700 dark:text-graphite-300'}`}
                      >
                        <Microscope className="w-3.5 h-3.5 text-teal-500" /> Quirúrgico
                      </button>
                    </div>
                  )}
                  <div className="group">
                    <button
                      role="menuitem"
                      type="button"
                      onClick={sec.onClick}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-xs transition-all duration-150 ease-out cursor-pointer ${
                        sec.danger
                          ? 'text-[#E11D48] hover:bg-[#FEE2E2] dark:hover:bg-red-950/30 active:bg-[#FECACA] dark:active:bg-red-950/50'
                          : 'text-graphite-700 dark:text-graphite-200 hover:bg-[#F1F5F9] dark:hover:bg-graphite-700 active:bg-[#E2E8F0] dark:active:bg-graphite-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 ${
                            sec.danger
                              ? 'bg-red-50 dark:bg-red-950/30 group-hover:bg-red-100'
                              : 'bg-graphite-100 dark:bg-graphite-800 group-hover:bg-[#E2E8F0] dark:group-hover:bg-graphite-700'
                          }`}
                        >
                          <sec.icon
                            size={14}
                            className={sec.danger ? 'text-[#E11D48]' : 'text-graphite-600 dark:text-graphite-400'}
                          />
                        </div>
                        <span className="truncate font-medium">{sec.label}</span>
                      </div>
                      {sec.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-graphite-100 dark:bg-graphite-800 rounded border border-graphite-200 dark:border-graphite-700 text-graphite-500 dark:text-graphite-400">
                          {sec.shortcut}
                        </kbd>
                      )}
                    </button>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
