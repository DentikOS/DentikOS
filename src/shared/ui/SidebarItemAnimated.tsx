/**
 * SidebarItemAnimated — Trazo de Cera Quirúrgica (Blueprint 02 §02)
 * 
 * Signature Gesture de la marca: cuando un item se activa, dibuja un borde
 * dorado de arriba a abajo en 220ms, culmina con micro-destello, y el icono pulsa.
 * Acompañado de feedback sonoro (1200Hz, 15ms).
 */
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export interface SidebarItemAnimatedProps {
  icon: LucideIcon
  label: string
  isActive: boolean
  onClick: () => void
  badge?: number | string | null
  badgeColor?: 'gold' | 'amber' | 'red'
  isCollapsed?: boolean
  slug?: string
  dataTestId?: string
  dataLegacyTestId?: string
  title?: string
}

export const SidebarItemAnimated: React.FC<SidebarItemAnimatedProps> = ({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  badgeColor = 'gold',
  isCollapsed = false,
  slug,
  dataTestId,
  dataLegacyTestId,
  title,
}) => {
  const [justActivated, setJustActivated] = useState(false)
  const isFirstRender = useRef(true)
  const prevActiveRef = useRef(isActive)

  // Feedback sonoro y animación solo cuando pasa de inactivo a activo (no en mount inicial)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevActiveRef.current = isActive
      return
    }

    if (isActive && !prevActiveRef.current) {
      setJustActivated(true)

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
        if (AudioCtx) {
          const audioContext = new AudioCtx()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()

          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)

          oscillator.frequency.value = 1200
          oscillator.type = 'sine'
          gainNode.gain.setValueAtTime(0.08, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.015)

          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.015)
        }
      } catch {
        // Silencioso si audio no está disponible
      }

      const timer = setTimeout(() => {
        setJustActivated(false)
      }, 350)

      prevActiveRef.current = isActive
      return () => clearTimeout(timer)
    }

    prevActiveRef.current = isActive
  }, [isActive])

  const badgeColors: Record<'gold' | 'amber' | 'red', string> = {
    gold: 'bg-[#B88E3A] text-white',
    amber: 'bg-[#D97706] text-white',
    red: 'bg-[#E11D48] text-white',
  }

  const testId = dataTestId || (slug ? `sidebar-menu-${slug}` : undefined)
  const legacyTestId = dataLegacyTestId || `sidebar-menu-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <motion.button
      type="button"
      data-testid={testId}
      data-legacy-testid={legacyTestId}
      onClick={onClick}
      title={isCollapsed ? title || label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`
        relative w-full flex items-center gap-2.5 rounded-xl transition-colors duration-100 ease-out cursor-pointer overflow-hidden
        ${isCollapsed ? 'justify-center px-1 py-2' : 'px-2.5 py-2 text-xs font-semibold'}
        ${
          isActive
            ? 'bg-gold-light/60 text-champagne-700 shadow-xs dark:bg-surface dark:text-gold-satin surgical:bg-white surgical:text-black font-bold'
            : 'text-graphite-700 dark:text-graphite-300 hover:bg-graphite-100 dark:hover:bg-graphite-800/70 hover:text-graphite-900'
        }
      `}
      whileTap={{ scale: 0.98 }}
    >
      {/* Trazo de Cera Quirúrgica — Borde izquierdo dorado */}
      <AnimatePresence>
        {isActive && (
          <>
            {/* Borde dorado que se dibuja de arriba a abajo en 220ms */}
            <motion.div
              layoutId="sidebar-active-border"
              className="absolute left-0 top-0 w-[3px] bg-[#B88E3A] rounded-r"
              initial={{ height: 0 }}
              animate={{ height: '100%' }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1], // Token "Estándar"
              }}
            />

            {/* Micro-destello dorado en extremo inferior */}
            {justActivated && (
              <motion.div
                className="absolute left-0 bottom-0 w-[3px] h-[8px] bg-[#E5C378] rounded-full shadow-xs pointer-events-none"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.4, 0.8],
                }}
                transition={{
                  delay: 0.20,
                  duration: 0.12,
                  ease: 'easeOut',
                }}
              />
            )}
          </>
        )}
      </AnimatePresence>

      {/* Icono con pulso al activar */}
      <motion.div
        animate={justActivated ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{
          duration: 0.18, // Token "Rápido"
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative shrink-0 flex items-center justify-center"
      >
        <Icon
          size={20}
          strokeWidth={1.75}
          className={
            isActive
              ? 'text-[#B88E3A] surgical:text-black'
              : 'text-graphite-500 group-hover:text-graphite-900 dark:group-hover:text-gold-satin'
          }
        />

        {/* Badge de notificación en icono si está colapsado */}
        {isCollapsed && badge !== undefined && badge !== null && (
          <span
            className={`
              absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5
              rounded-full text-[8px] font-bold
              flex items-center justify-center shadow-xs
              ${badgeColors[badgeColor]}
            `}
          >
            {typeof badge === 'number' && badge > 9 ? '9+' : badge}
          </span>
        )}
      </motion.div>

      {/* Label del módulo y badge en modo expandido */}
      {!isCollapsed && (
        <>
          <span className="flex-1 text-left truncate text-xs">{label}</span>
          {badge !== undefined && badge !== null && (
            <span
              className={`
                min-w-[16px] h-4 px-1.5
                rounded-full text-[10px] font-bold
                flex items-center justify-center shadow-xs
                ${badgeColors[badgeColor]}
              `}
            >
              {typeof badge === 'number' && badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </motion.button>
  )
}

SidebarItemAnimated.displayName = 'SidebarItemAnimated'
