/**
 * ThemeSwitcher — Slider físico táctil, continuo y accesible para los 3 modos de DentikOS
 * Blueprint 02 §04: Claro | Quirúrgico | Oscuro
 * Soporta click directo, arrastre (Pointer Events con snap a 250ms) y flechas ←/→
 */
import React, { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sun, Sparkles, Moon } from 'lucide-react'
import { useDarkMode, type Theme } from '../hooks/useDarkMode'
import { playThemeSound } from '../utils/themeSoundUtils'

export interface ThemeSwitcherProps {
  compact?: boolean
  className?: string
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false, className = '' }) => {
  const { theme: currentTheme, setTheme } = useDarkMode()
  const trackRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef<boolean>(false)
  const dragPercentRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragPercent, setDragPercent] = useState<number | null>(null)

  const handleSelectTheme = useCallback((targetTheme: Theme) => {
    playThemeSound()
    setTheme(targetTheme)
  }, [setTheme])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }
    isDraggingRef.current = true
    setIsDragging(true)
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const pct = rect.width > 0 ? x / rect.width : 0
      dragPercentRef.current = pct
      setDragPercent(pct)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const pct = rect.width > 0 ? x / rect.width : 0
    dragPercentRef.current = pct
    setDragPercent(pct)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      // Ignorar error si se perdió la captura
    }
    isDraggingRef.current = false
    setIsDragging(false)
    const currentPercent = dragPercentRef.current ?? (currentTheme === 'light' ? 0 : currentTheme === 'surgical' ? 0.5 : 1)
    const snapped: Theme = currentPercent < 0.25 ? 'light' : currentPercent < 0.75 ? 'surgical' : 'dark'
    dragPercentRef.current = null
    setDragPercent(null)
    handleSelectTheme(snapped)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next: Theme = currentTheme === 'light' ? 'surgical' : 'dark'
      handleSelectTheme(next)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const prev: Theme = currentTheme === 'dark' ? 'surgical' : 'light'
      handleSelectTheme(prev)
    }
  }

  // Posición del thumb deslizante
  const getThumbOffset = (): { left: string; x: string } => {
    if (isDragging && dragPercent !== null) {
      return {
        left: `${dragPercent * 100}%`,
        x: '-50%',
      }
    }
    switch (currentTheme) {
      case 'light':
        return { left: '0%', x: '0%' }
      case 'surgical':
        return { left: '50%', x: '-50%' }
      case 'dark':
        return { left: '100%', x: '-100%' }
      default:
        return { left: '0%', x: '0%' }
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => {
          const next: Theme = currentTheme === 'light' ? 'surgical' : currentTheme === 'surgical' ? 'dark' : 'light'
          handleSelectTheme(next)
        }}
        title={`Tema actual: ${currentTheme}`}
        aria-label={`Cambiar tema (actual: ${currentTheme})`}
        className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center bg-graphite-100 dark:bg-graphite-800 text-graphite-700 dark:text-graphite-200 transition-colors cursor-pointer shrink-0 ${className}`}
      >
        {currentTheme === 'light' && <Sun size={16} className="text-amber-500" />}
        {currentTheme === 'surgical' && <Sparkles size={16} className="text-primary" />}
        {currentTheme === 'dark' && <Moon size={16} className="text-blue-400" />}
      </button>
    )
  }

  const thumbPos = getThumbOffset()
  const valNow = currentTheme === 'light' ? 0 : currentTheme === 'surgical' ? 1 : 2

  return (
    <div
      className={`flex flex-col items-center select-none ${className}`}
      data-testid="theme-switcher-slider"
    >
      {/* Contenedor del slider físico de 160px */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Tema de interfaz"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={valNow}
        aria-valuetext={currentTheme === 'light' ? 'Claro' : currentTheme === 'surgical' ? 'Quirúrgico' : 'Oscuro'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="w-[160px] h-[34px] bg-graphite-100 dark:bg-graphite-900/90 surgical:bg-graphite-200 p-1 rounded-full border border-surface relative flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
      >
        {/* Thumb activo deslizante */}
        <div className="absolute inset-y-1 left-1 right-1 pointer-events-none">
          <div className="relative w-full h-full">
            <motion.div
              className="absolute top-0 w-[26px] h-[26px] rounded-full shadow-md"
              style={{
                background: 'linear-gradient(135deg, #E5C378 0%, #B88E3A 100%)',
              }}
              animate={{
                left: thumbPos.left,
                x: thumbPos.x,
              }}
              transition={
                isDragging
                  ? { duration: 0 }
                  : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
              }
            />
          </div>
        </div>

        {/* Botón 1: Modo Claro */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleSelectTheme('light')
          }}
          aria-label="Activar modo claro"
          className="relative z-10 w-[26px] h-[26px] flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer"
          title="Modo Claro"
        >
          <Sun
            size={14}
            className={currentTheme === 'light' ? 'text-black font-bold' : 'text-graphite-500 hover:text-graphite-900 dark:text-graphite-400'}
          />
        </button>

        {/* Botón 2: Modo Quirúrgico */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleSelectTheme('surgical')
          }}
          aria-label="Activar modo quirúrgico"
          className="relative z-10 w-[26px] h-[26px] flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer"
          title="Modo Quirúrgico"
        >
          <Sparkles
            size={14}
            className={currentTheme === 'surgical' ? 'text-black font-bold' : 'text-graphite-500 hover:text-graphite-900 dark:text-graphite-400'}
          />
        </button>

        {/* Botón 3: Modo Oscuro */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleSelectTheme('dark')
          }}
          aria-label="Activar modo oscuro"
          className="relative z-10 w-[26px] h-[26px] flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer"
          title="Modo Oscuro"
        >
          <Moon
            size={14}
            className={currentTheme === 'dark' ? 'text-black font-bold' : 'text-graphite-500 hover:text-graphite-900 dark:text-graphite-400'}
          />
        </button>
      </div>
    </div>
  )
}
