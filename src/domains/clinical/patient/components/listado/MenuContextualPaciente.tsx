import React, { useLayoutEffect, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  FileText,
  Printer,
  FileDown,
  Share2,
  Tag,
  UserCheck,
  Paperclip,
  UserX,
  ShieldAlert,
} from 'lucide-react'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import type { Paciente } from '../../schemas/pacienteSchema'

export interface MenuContextualPacienteProps {
  paciente: Paciente
  isOpen: boolean
  triggerRef?: React.RefObject<HTMLElement | null>
  onClose: () => void
  onEditar?: (p: Paciente) => void
  onImprimir?: (p: Paciente) => void
  onExportar?: (p: Paciente) => void
  onDerivar?: (p: Paciente) => void
  onAsignarEtiqueta?: (p: Paciente) => void
  onCambiarDoctor?: (p: Paciente) => void
  onVerDocumentos?: (p: Paciente) => void
  onDesactivar?: (p: Paciente) => void
  onBloquear?: (p: Paciente) => void
}

export const MenuContextualPaciente: React.FC<MenuContextualPacienteProps> = ({
  paciente,
  isOpen,
  triggerRef,
  onClose,
  onEditar,
  onImprimir,
  onExportar,
  onDerivar,
  onAsignarEtiqueta,
  onCambiarDoctor,
  onVerDocumentos,
  onDesactivar,
  onBloquear,
}) => {
  const { esAdmin, rol } = useRBAC()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!isOpen) return
    if (!triggerRef?.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = menuRef.current?.offsetWidth || 224 // w-56
    const menuHeight = menuRef.current?.offsetHeight || 320
    const padding = 8

    // 1. Posicionamiento: justo debajo del botón
    let top = rect.bottom + 4

    // 2. Colisión vertical: SOLO si no cabe hacia abajo
    if (rect.bottom + menuHeight > window.innerHeight) {
      if (rect.top - menuHeight - 4 >= 0) {
        top = rect.top - menuHeight - 4
      } else {
        top = Math.max(padding, window.innerHeight - menuHeight - padding)
      }
    }

    // 3. Alinear el borde derecho del menú al borde derecho del botón
    let left = rect.right - menuWidth

    // Detección colisión horizontal
    if (left < padding) {
      left = padding
    }
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding
    }

    setPos({ top, left })
  }, [isOpen, triggerRef])

  // Cerrar el menú al hacer scroll de la página (para evitar desanclaje)
  useEffect(() => {
    if (!isOpen) return
    const handleScroll = () => {
      onClose()
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        triggerRef?.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  const ejecutarAccion = (fn?: (p: Paciente) => void) => {
    onClose()
    if (fn) fn(paciente)
  }

  const puedeEditar = esAdmin || rol === 'recepcion'

  const menuContent = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          zIndex: 9999,
        }}
        className="w-56 bg-surface border border-surface rounded-2xl shadow-2xl py-1.5 text-xs text-graphite-700 dark:text-graphite-200 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
        data-testid={`menu-dropdown-${paciente.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Editar datos completos */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onEditar)}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center justify-between text-left cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span>Editar datos completos</span>
          </span>
          <span className="text-[10px] text-graphite-400">{puedeEditar ? 'Edición' : 'Lectura'}</span>
        </button>

        {/* 2. Imprimir ficha resumen */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onImprimir)}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center gap-2 text-left cursor-pointer"
        >
          <Printer className="w-4 h-4 text-graphite-500" />
          <span>Imprimir ficha resumen</span>
        </button>

        {/* 3. Exportar ficha (PDF) */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onExportar)}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center gap-2 text-left cursor-pointer"
        >
          <FileDown className="w-4 h-4 text-graphite-500" />
          <span>Exportar ficha (PDF)</span>
        </button>

        {/* 4. Crear ficha de derivación */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onDerivar)}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center gap-2 text-left cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-graphite-400" />
          <span>Crear ficha de derivación</span>
        </button>

        {/* 5. Asignar etiqueta */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onAsignarEtiqueta)}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center gap-2 text-left cursor-pointer"
        >
          <Tag className="w-4 h-4 text-graphite-400" />
          <span>Asignar etiqueta</span>
        </button>

        {/* 6. Cambiar doctor tratante */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onCambiarDoctor)}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center gap-2 text-left cursor-pointer"
        >
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>Cambiar doctor tratante</span>
        </button>

        {/* 7. Ver documentos adjuntos */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onVerDocumentos)}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center gap-2 text-left cursor-pointer"
        >
          <Paperclip className="w-4 h-4 text-graphite-500" />
          <span>Ver documentos adjuntos</span>
        </button>

        <div className="my-1 border-t border-surface" />

        {/* 8. Desactivar paciente */}
        <button
          type="button"
          onClick={() => ejecutarAccion(onDesactivar)}
          className="w-full px-3.5 py-2 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-2 text-left cursor-pointer font-medium"
        >
          <UserX className="w-4 h-4" />
          <span>Desactivar paciente</span>
        </button>

        {/* 9. Bloquear (solo admin) */}
        {esAdmin && (
          <button
            type="button"
            onClick={() => ejecutarAccion(onBloquear)}
            className="w-full px-3.5 py-2 hover:bg-rose-500/10 text-rose-600 flex items-center gap-2 text-left cursor-pointer font-medium"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Bloquear paciente (Admin)</span>
          </button>
        )}
      </div>
    </>
  )

  return typeof document !== 'undefined'
    ? createPortal(menuContent, document.body)
    : menuContent
}
