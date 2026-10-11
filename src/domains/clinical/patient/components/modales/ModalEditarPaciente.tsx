import React, { useState } from 'react'
import { FileEdit, X, ShieldAlert } from 'lucide-react'
import { Modal } from '../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../shared/ui/ui/Button'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

interface ModalEditarPacienteProps {
  paciente: Paciente
  isOpen: boolean
  onClose: () => void
}

export const ModalEditarPaciente: React.FC<ModalEditarPacienteProps> = ({
  paciente,
  isOpen,
  onClose,
}) => {
  const { esAdmin, rol } = useRBAC()
  const actualizarPaciente = usePacientesStore((s) => s.actualizarPaciente)

  // Admin y recepción editan; dentista solo lectura
  const puedeEditar = esAdmin || rol === 'recepcion'

  const [formData, setFormData] = useState({
    nombre: paciente.nombre || paciente.nombreCompleto || '',
    rut: paciente.rut || '',
    telefono: paciente.telefono ? String(paciente.telefono) : '',
    email: paciente.email || '',
    edad: paciente.edad ? String(paciente.edad) : '',
    prevision: paciente.prevision || 'Fonasa',
    direccion: paciente.direccion || '',
    alergias: paciente.alergias || '',
  })

  if (!isOpen) return null

  const handleChange = (campo: string, valor: string) => {
    if (!puedeEditar) return
    setFormData((prev) => ({ ...prev, [campo]: valor }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!puedeEditar) {
      onClose()
      return
    }
    actualizarPaciente(paciente.id, {
      nombre: formData.nombre,
      telefono: formData.telefono,
      email: formData.email,
      edad: formData.edad ? Number(formData.edad) : undefined,
      prevision: formData.prevision,
      direccion: formData.direccion,
      alergias: formData.alergias,
    })
    notificationService.mostrar('Datos del paciente actualizados con éxito', { tipo: 'success' })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showCloseButton={false}>
      <form onSubmit={handleSubmit} className="space-y-4 p-1" data-testid={`modal-editar-paciente-${paciente.id}`}>
        <div className="flex items-center justify-between pb-2 border-b border-surface">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              {puedeEditar ? 'Editar Datos del Paciente' : 'Ficha del Paciente (Solo Lectura)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-graphite-400 hover:text-graphite-600"
            aria-label="Cerrar modal editar paciente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!puedeEditar && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Rol dentista en modo lectura. Para editar datos administrativos solicite a recepción o administrador.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Nombre Completo
            </label>
            <input
              type="text"
              disabled={!puedeEditar}
              value={formData.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl disabled:opacity-60"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              RUT (Identificador Clínico)
            </label>
            <input
              type="text"
              disabled={true}
              value={formData.rut}
              className="w-full p-2 bg-surface border border-surface rounded-xl opacity-60 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Teléfono
            </label>
            <input
              type="text"
              disabled={!puedeEditar}
              value={formData.telefono}
              onChange={(e) => handleChange('telefono', e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Email
            </label>
            <input
              type="email"
              disabled={!puedeEditar}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Edad
            </label>
            <input
              type="number"
              disabled={!puedeEditar}
              value={formData.edad}
              onChange={(e) => handleChange('edad', e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Previsión
            </label>
            <select
              disabled={!puedeEditar}
              value={formData.prevision}
              onChange={(e) => handleChange('prevision', e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl disabled:opacity-60"
            >
              <option value="Fonasa">Fonasa</option>
              <option value="Isapre">Isapre</option>
              <option value="Particular">Particular</option>
              <option value="Convenio">Convenio</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Dirección
            </label>
            <input
              type="text"
              disabled={!puedeEditar}
              value={formData.direccion}
              onChange={(e) => handleChange('direccion', e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Alergias Conocidas
            </label>
            <input
              type="text"
              disabled={!puedeEditar}
              value={formData.alergias}
              onChange={(e) => handleChange('alergias', e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-surface">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {puedeEditar ? 'Cancelar' : 'Cerrar'}
          </Button>
          {puedeEditar && (
            <Button type="submit" variant="primary" size="sm">
              Guardar Cambios
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
