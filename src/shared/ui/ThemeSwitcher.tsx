/**
 * ThemeSwitcher — Control Deslizante Físico (Blueprint 02 §04) — FIXED
 * 
 * - Thumb centrado con centros de iconos Lucide
 * - Click directo en track o arrastre del círculo
 * - Sin cambio accidental de tema al hacer hover
 * - Spring animation + dragConstraints dinámicas + dragMomentum={false}
 */
import React, { useState } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import { Sun, Microscope, Moon } from 'lucide-react'
import { useSidebarStore, type AppTheme } from '../../app/stores/useSidebarStore'
import { soundEffects } from '../utils/soundEffects'

const THEMES: AppTheme[] = ['light', 'surgical', 'dark']
const ICONS = [Sun, Microscope, Moon]
const TRACK_WIDTH = 160
const THUMB_SIZE = 26
const PADDING = 3

// Posiciones X del centro del círculo para cada tema (centros en justify-around)
const POSITIONS = [
  TRACK_WIDTH * 0.1666, // 26.66px
  TRACK_WIDTH * 0.5,    // 80px
  TRACK_WIDTH * 0.8333, // 133.33px
]

// Convertir a posición del borde izquierdo del círculo
const THUMB_POSITIONS = POSITIONS.map((x) => x - THUMB_SIZE / 2 + PADDING)

export interface ThemeSwitcherProps {
  compact?: boolean
  className?: string
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false, className = '' }) => {
  const theme = useSidebarStore((s) => s.theme)
  const setSidebarTheme = useSidebarStore((s) => s.setTheme)
  const [isDragging, setIsDragging] = useState(false)

  const currentIndex = Math.max(0, THEMES.indexOf(theme))

  const playThemeChangeSound = () => {
    soundEffects.save()
  }

  const switchTo = (newTheme: AppTheme) => {
    setSidebarTheme(newTheme)
    playThemeChangeSound()
  }

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false)
    const dragDistance = info.offset.x
    const threshold = 26.5
    let newIndex = currentIndex
    if (dragDistance > threshold && currentIndex < THEMES.length - 1) newIndex = currentIndex + 1
    else if (dragDistance < -threshold && currentIndex > 0) newIndex = currentIndex - 1
    switchTo(THEMES[newIndex])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && currentIndex < THEMES.length - 1) {
      e.preventDefault(); switchTo(THEMES[currentIndex + 1])
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      e.preventDefault(); switchTo(THEMES[currentIndex - 1])
    }
  }

  const constraints = {
    left: THUMB_POSITIONS[0],
    right: THUMB_POSITIONS[2],
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => {
          const nextIndex = (currentIndex + 1) % THEMES.length
          switchTo(THEMES[nextIndex])
        }}
        title={`Tema actual: ${theme}`}
        aria-label={`Cambiar tema (actual: ${theme})`}
        className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center bg-graphite-100 dark:bg-graphite-800 text-graphite-700 dark:text-graphite-200 transition-colors cursor-pointer shrink-0 ${className}`}
      >
        {theme === 'light' && <Sun size={16} className="text-amber-500" />}
        {theme === 'surgical' && <Microscope size={16} className="text-primary" />}
        {theme === 'dark' && <Moon size={16} className="text-blue-400" />}
      </button>
    )
  }

  return (
    <div
      data-testid="theme-switcher"
      className={`flex flex-col items-center gap-2 px-3 py-2 select-none ${className}`}
    >
      <div className="text-[11px] font-medium text-[#94A3B8] dark:text-[#64748B] uppercase tracking-wide">
        {theme === 'light' && 'Modo Claro'}
        {theme === 'surgical' && 'Modo Quirúrgico'}
        {theme === 'dark' && 'Modo Oscuro'}
      </div>

      <div
        data-testid="theme-switcher-slider"
        role="slider"
        tabIndex={0}
        aria-label="Tema de interfaz"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={currentIndex}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          const idx = ratio > 0.66 ? 2 : ratio > 0.33 ? 1 : 0
          if (idx !== currentIndex) switchTo(THEMES[idx])
        }}
        onPointerUp={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          if (!rect || rect.width === 0) return
          const raw = e.nativeEvent as any
          const cx = e.clientX ?? raw?.clientX ?? raw?.screenX
          if (typeof cx !== 'number') return
          const ratio = (cx - rect.left) / rect.width
          const idx = ratio > 0.66 ? 2 : ratio > 0.33 ? 1 : 0
          if (idx !== currentIndex) switchTo(THEMES[idx])
        }}
        className="relative bg-[#E2E8F0] dark:bg-[#1E293B] rounded-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        style={{
          width: `${TRACK_WIDTH}px`,
          height: '32px',
          touchAction: 'none',
        }}
      >
        {/* Iconos posicionados con flex justify-around */}
        <div className="absolute inset-0 flex items-center justify-around pointer-events-none px-1">
          {ICONS.map((Icon, i) => (
            <Icon
              key={i}
              size={16}
              className={theme === THEMES[i] ? 'text-[#B88E3A]' : 'text-[#94A3B8] dark:text-[#64748B]'}
            />
          ))}
        </div>

        {/* Zonas clickeables por posición */}
        {THEMES.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              switchTo(t)
            }}
            className="absolute top-0 h-full cursor-pointer opacity-0 z-10"
            style={{
              left: `${(i / THEMES.length) * TRACK_WIDTH}px`,
              width: `${TRACK_WIDTH / THEMES.length}px`,
            }}
            aria-label={`Cambiar a modo ${t}`}
          />
        ))}

        {/* Botones accesibles secundarios */}
        <div className="sr-only">
          {THEMES.map((t) => (
            <button
              key={`accessible-${t}`}
              type="button"
              onClick={() => switchTo(t)}
              aria-label={`Activar modo ${t === 'light' ? 'claro' : t === 'surgical' ? 'quirúrgico' : 'oscuro'}`}
            >
              Activar modo {t === 'light' ? 'claro' : t === 'surgical' ? 'quirúrgico' : 'oscuro'}
            </button>
          ))}
        </div>

        {/* Círculo deslizante — EL ÚNICO que maneja drag */}
        <motion.div
          className="absolute rounded-full bg-gradient-to-br from-[#E5C378] to-[#B88E3A] shadow-md cursor-grab active:cursor-grabbing z-20"
          style={{
            width: `${THUMB_SIZE}px`,
            height: `${THUMB_SIZE}px`,
            top: `${PADDING}px`,
          }}
          drag="x"
          dragConstraints={constraints}
          dragElastic={0.15}
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          animate={{ x: THUMB_POSITIONS[currentIndex] }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
          }}
          whileHover={{ scale: isDragging ? 1 : 1.08 }}
          whileTap={{ scale: 0.95, cursor: 'grabbing' }}
        />
      </div>
    </div>
  )
}

ThemeSwitcher.displayName = 'ThemeSwitcher'
