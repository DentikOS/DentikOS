/**
 * SelectorSede — Selector y visualizador de sede activa (Blueprint 03 §04)
 * 
 * Dropdown custom con animación Rápido 180ms, punto de sincronización
 * siempre visible (🟢 sincronizado / 🟡 pendiente), y feedback sonoro.
 * 
 * Variación aceptada: Se oculta si solo hay 1 sede (decisión del usuario).
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, ChevronDown, Check } from 'lucide-react'
import { useSedes } from '../../domains/organization/clinic/hooks/useSedes'
import { useSesionStore } from '../../app/stores/sesionStore'
import { notificationService } from '../../infrastructure/notification/notificationService'
import { playSound } from '../utils/soundEffects'

export interface SelectorSedeProps {
  onCambioSede?: (sedeId: string) => void
  className?: string
  compacto?: boolean
  sincronizado?: boolean
}

export const SelectorSede: React.FC<SelectorSedeProps> = ({
  onCambioSede,
  className = '',
  compacto = false,
  sincronizado = true,
}) => {
  const { sedes = [], sedeActiva, sedeActivaId, cambiarSede } = useSedes()
  const storeCambiarSede = useSesionStore((s) => s.cambiarSede)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Ocultar si hay 0 o 1 sede (variación aceptada)
  if (!sedes || sedes.length <= 1) {
    return null
  }

  const listaSedes = sedes
  const valorActivo = sedeActivaId || sedeActiva?.id || listaSedes[0]?.id || ''
  const sedeActivaObj = listaSedes.find((s) => (s.id || s.nombre) === valorActivo)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEsc)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  const handleSeleccion = (sedeId: string) => {
    if (sedeId === valorActivo) {
      setIsOpen(false)
      return
    }

    cambiarSede(sedeId)
    storeCambiarSede(sedeId)

    const sedeObj = listaSedes.find((s) => (s.id || s.nombre) === sedeId)
    const nombreSede = sedeObj?.nombre || sedeId
    notificationService.mostrar(`Sede cambiada a ${nombreSede}`, { tipo: 'info' })
    
    try {
      playSound('save') // Doble pulso 680Hz→850Hz, 80ms
    } catch {}

    if (onCambioSede) onCambioSede(sedeId)
    setIsOpen(false)
  }

  const statusTitle = sincronizado
    ? 'Sede activa y sincronizada'
    : 'Cambios pendientes de sincronizar'

  // Punto de sincronización SIEMPRE visible (BP03 §04)
  const puntoColor = sincronizado ? 'bg-[#0D9488]' : 'bg-[#D97706]'
  
  // Fondo del pill según estado
  const pillBg = sincronizado
    ? 'bg-[#ECFDF5] dark:bg-teal-950/40 surgical:bg-[#D1FAE5]'
    : 'bg-amber-50 dark:bg-amber-950/40 surgical:bg-[#FEF3C7]'

  return (
    <div
      ref={containerRef}
      data-testid="selector-sede"
      className={`relative inline-flex items-center ${compacto ? 'max-w-[160px]' : 'max-w-[240px]'} shrink-0 ${className}`}
    >
      {/* Pill principal clickeable */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={statusTitle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={statusTitle}
        className={`
          inline-flex items-center gap-1.5 h-8 pl-2 pr-2 rounded-md
          border border-transparent hover:border-border-subtle
          transition-colors duration-100 cursor-pointer
          ${pillBg}
        `}
      >
        {/* Punto de sincronización (8px) */}
        <motion.span
          data-testid="selector-sede-status"
          className={`w-2 h-2 rounded-full shrink-0 ${puntoColor}`}
          animate={
            !sincronizado
              ? { opacity: [1, 0.4, 1] }
              : { opacity: 1 }
          }
          transition={{
            duration: 2,
            repeat: !sincronizado ? Infinity : 0,
            ease: 'easeInOut',
          }}
          aria-label={statusTitle}
        />

        {/* Icono MapPin dorado */}
        <MapPin
          size={compacto ? 12 : 14}
          className="text-[#D4AF37] shrink-0"
        />

        {/* Nombre de la sede */}
        <span className="text-[13px] font-semibold text-graphite-900 dark:text-graphite-100 surgical:text-black truncate max-w-[120px]">
          {sedeActivaObj?.nombre || 'Sede Principal'}
        </span>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown
            size={14}
            className="text-graphite-500 dark:text-graphite-400 shrink-0"
          />
        </motion.div>
      </button>

      {/* Dropdown custom con animación 180ms */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            aria-label="Lista de sedes"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{
              duration: 0.18, // Token "Rápido"
              ease: [0.16, 1, 0.3, 1],
            }}
            className="
              absolute top-full right-0 mt-1.5 z-50
              w-[240px] py-1
              bg-[#F1F5F9] dark:bg-[#1E293B] surgical:bg-[#E2E8F0]
              border border-[#E2E8F0] dark:border-[#24334A] surgical:border-[#475569]
              rounded-lg
              shadow-lg
              overflow-hidden
            "
          >
            {listaSedes.map((s) => {
              const isActive = (s.id || s.nombre) === valorActivo
              return (
                <button
                  key={s.id || s.nombre}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSeleccion(s.id || s.nombre)}
                  className={`
                    w-full flex items-center justify-between gap-2
                    px-3 py-2 text-left
                    transition-colors duration-100 cursor-pointer
                    ${isActive
                      ? 'bg-[rgba(229,195,120,0.08)] text-[#B88E3A] dark:text-[#E5C378] surgical:text-[#B88E3A] font-semibold'
                      : 'text-graphite-700 dark:text-graphite-300 surgical:text-black hover:bg-[rgba(229,195,120,0.04)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={14} className="text-[#D4AF37] shrink-0" />
                    <span className="text-[13px] truncate">{s.nombre}</span>
                  </div>
                  {isActive && (
                    <Check size={14} className="text-[#B88E3A] shrink-0" />
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

SelectorSede.displayName = 'SelectorSede'
