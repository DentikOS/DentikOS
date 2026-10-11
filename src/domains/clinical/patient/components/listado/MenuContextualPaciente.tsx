import React from 'react'
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
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import type { Paciente } from '../../schemas/pacienteSchema'

export interface MenuContextualPacienteProps {
  paciente: Paciente
  isOpen: boolean
  onClose: () => void
  onEditar?: (p: Paciente) => void
  onImprimir?: (p: Paciente) => void
  onExportar?: (p: Paciente) => void
  onCambiarDoctor?: (p: Paciente) => void
  onVerDocumentos?: (p: Paciente) => void
  onDesactivar?: (p: Paciente) => void
  onBloquear?: (p: Paciente) => void
}

export const MenuContextualPaciente: React.FC<MenuContextualPacienteProps> = ({
  paciente,
  isOpen,
  onClose,
  onEditar,
  onImprimir,
  onExportar,
  onCambiarDoctor,
  onVerDocumentos,
  onDesactivar,
  onBloquear,
}) => {
  const { esAdmin, rol } = useRBAC()
  if (!isOpen) return null

  const ejecutarAccion = (fn?: (p: Paciente) => void) => {
    onClose()
    if (fn) fn(paciente)
  }

  const handleProximaSesion = (nombre: string) => {
    onClose()
    notificationService.mostrar(`${nombre}: Disponible en próxima sesión`, { tipo: 'info' })
  }

  const puedeEditar = esAdmin || rol === 'recepcion'

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-surface border border-surface rounded-2xl shadow-xl py-1.5 text-xs text-graphite-700 dark:text-graphite-200 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
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
          onClick={() => {
            onClose()
            if (onImprimir) onImprimir(paciente)
            else window.print()
          }}
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
          onClick={() => handleProximaSesion('Ficha de derivación')}
          className="w-full px-3.5 py-2 hover:bg-surface-hover flex items-center gap-2 text-left cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-graphite-400" />
          <span>Crear ficha de derivación</span>
        </button>

        {/* 5. Asignar etiqueta */}
        <button
          type="button"
          onClick={() => handleProximaSesion('Asignar etiquetas')}
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
}
