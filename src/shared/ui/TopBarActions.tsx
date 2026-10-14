/**
 * TopBarActions — Sistema híbrido de acciones contextuales: Primaria dorada + Menú ⋯
 * Blueprint 03 §07
 * 
 * - Botón primario con gradiente dorado (acción más frecuente)
 * - Menú ⋯ con acciones secundarias
 * - Filtrado automático por permisos de rol (Blueprint 02 §08 "Regla de oro")
 * - Animación Rápido 180ms en dropdown (scale + fade-in)
 * - Ancho dropdown: 220px
 * - Tipografía: 13px SemiBold (primaria), 13px Regular (items)
 */
import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'

export interface AccionContextualItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  permisoRequerido?: string
}

export interface TopBarActionsProps {
  primaria?: AccionContextualItem | null
  secundarias?: AccionContextualItem[]
  className?: string
}

export const TopBarActions: React.FC<TopBarActionsProps> = ({
  primaria,
  secundarias = [],
  className = '',
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { puede } = usePermissions()

  // Filtrar por permisos ("Regla de oro" del Blueprint 02 §08)
  const primariaVisible =
    primaria && (!primaria.permisoRequerido || puede(primaria.permisoRequerido))
      ? primaria
      : null
  const secundariasVisibles = secundarias.filter(
    (sec) => !sec.permisoRequerido || puede(sec.permisoRequerido)
  )

  // Cerrar dropdown al hacer click fuera o Esc
  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  if (!primariaVisible && secundariasVisibles.length === 0) return null

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Botón primario con gradiente dorado */}
      {primariaVisible && (
        <button
          type="button"
          onClick={primariaVisible.onClick}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold shadow-xs hover:opacity-95 active:scale-98 transition-all cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #E5C378 0%, #B88E3A 100%)',
            color: '#070B14',
          }}
          title={primariaVisible.label}
        >
          {primariaVisible.icon && <primariaVisible.icon size={16} className="shrink-0" />}
          <span className="hidden sm:inline">{primariaVisible.label}</span>
        </button>
      )}

      {/* Menú secundario ⋯ */}
      {secundariasVisibles.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] rounded-lg transition-colors cursor-pointer"
            aria-label="Más acciones contextuales"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Más acciones"
          >
            <MoreHorizontal size={18} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.18, // Token "Rápido" 180ms
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute right-0 mt-1.5 w-[220px] bg-[#F1F5F9] dark:bg-[#1E293B] surgical:bg-[#E2E8F0] border border-[#E2E8F0] dark:border-[#24334A] surgical:border-[#475569] rounded-xl shadow-xl py-1 z-50 overflow-hidden"
              >
                {secundariasVisibles.map((sec) => (
                  <button
                    key={sec.label}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      sec.onClick()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-graphite-700 dark:text-graphite-200 hover:bg-[#E2E8F0] dark:hover:bg-graphite-700 transition-colors text-left cursor-pointer"
                  >
                    {sec.icon && <sec.icon size={14} className="text-[#64748B] dark:text-[#94A3B8] shrink-0" />}
                    <span className="truncate">{sec.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
