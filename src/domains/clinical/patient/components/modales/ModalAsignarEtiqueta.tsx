import React, { useState } from 'react'
import { Tag, X, Plus } from 'lucide-react'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

interface ModalAsignarEtiquetaProps {
  paciente: Paciente
  isOpen: boolean
  onClose: () => void
}

const COLORES_PREDEFINIDOS = [
  { id: 'emerald', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { id: 'blue', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  { id: 'indigo', bg: 'bg-indigo-100 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  { id: 'violet', bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  { id: 'amber', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  { id: 'rose', bg: 'bg-rose-100 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  { id: 'cyan', bg: 'bg-cyan-100 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  { id: 'slate', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-500' },
]

export const ModalAsignarEtiqueta: React.FC<ModalAsignarEtiquetaProps> = ({
  paciente,
  isOpen,
  onClose,
}) => {
  const actualizarPaciente = usePacientesStore((s) => s.actualizarPaciente)
  const [etiquetas, setEtiquetas] = useState<string[]>(() =>
    Array.isArray(paciente.etiquetas) ? [...paciente.etiquetas] : []
  )
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [colorSeleccionado, setColorSeleccionado] = useState(0)

  if (!isOpen) return null

  const handleAgregar = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nuevaEtiqueta.trim()
    if (!trimmed) return
    if (etiquetas.includes(trimmed)) {
      notificationService.mostrar('La etiqueta ya existe', { tipo: 'info' })
      return
    }
    setEtiquetas([...etiquetas, trimmed])
    setNuevaEtiqueta('')
  }

  const handleEliminar = (index: number) => {
    setEtiquetas(etiquetas.filter((_, i) => i !== index))
  }

  const handleGuardar = () => {
    actualizarPaciente(paciente.id, { etiquetas })
    notificationService.mostrar('Etiquetas actualizadas correctamente', { tipo: 'exito' })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="space-y-4 p-1" data-testid={`modal-etiquetas-${paciente.id}`}>
        <div className="flex items-center justify-between pb-2 border-b border-surface">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Asignar Etiquetas
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-graphite-400 hover:text-graphite-600"
            aria-label="Cerrar modal etiquetas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-graphite-600 dark:text-graphite-300">
          Paciente: <strong>{paciente.nombre || paciente.nombreCompleto}</strong>
        </p>

        {/* 8 Colores Predefinidos */}
        <div>
          <label className="block text-[11px] font-semibold text-graphite-600 dark:text-graphite-400 mb-1.5">
            Color de etiqueta
          </label>
          <div className="flex items-center gap-2">
            {COLORES_PREDEFINIDOS.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorSeleccionado(idx)}
                aria-label={`Color ${c.id}`}
                className={`w-5 h-5 rounded-full ${c.dot} transition-transform ${
                  colorSeleccionado === idx
                    ? 'ring-2 ring-primary ring-offset-2 scale-110'
                    : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Input agregar */}
        <form onSubmit={handleAgregar} className="flex gap-2">
          <input
            type="text"
            placeholder="Nueva etiqueta (ej. VIP, Ortodoncia)"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            className="flex-1 p-2 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" variant="secondary" size="sm" icon={Plus}>
            Añadir
          </Button>
        </form>

        {/* Lista de etiquetas actuales */}
        <div className="min-h-[50px] p-2 bg-surface-hover/40 border border-surface rounded-xl flex flex-wrap gap-1.5 items-center">
          {etiquetas.length === 0 ? (
            <span className="text-[11px] text-graphite-400">Sin etiquetas asignadas</span>
          ) : (
            etiquetas.map((etiq, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
              >
                <span>{etiq}</span>
                <button
                  type="button"
                  onClick={() => handleEliminar(idx)}
                  className="hover:text-rose-500"
                  aria-label={`Eliminar etiqueta ${etiq}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-2 pt-2 border-t border-surface">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleGuardar}>
            Guardar Etiquetas
          </Button>
        </div>
      </div>
    </Modal>
  )
}
