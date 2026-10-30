import React, { memo, useState, useEffect } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { ESPECIALIDADES_ODONTOLOGICAS } from '../constants/prestacionesConstants'
import type { Prestacion } from '../services/prestacionesStorageService'
import type { PrestacionInput } from '../hooks/usePrestaciones'

export interface ModalNuevaPrestacionProps {
  prestacionEditar?: Prestacion | PrestacionInput | null
  alGuardar: (prestacion: PrestacionInput) => Promise<void>
  alCerrar: () => void
}

export const ModalNuevaPrestacion: React.FC<ModalNuevaPrestacionProps> = memo(({
  prestacionEditar,
  alGuardar,
  alCerrar
}) => {
  const [nombre, setNombre] = useState<string>('')
  const [especialidad, setEspecialidad] = useState<string>(ESPECIALIDADES_ODONTOLOGICAS[0])
  const [precioParticular, setPrecioParticular] = useState<string>('')
  const [precioFonasa, setPrecioFonasa] = useState<string>('')
  const [codigoFonasa, setCodigoFonasa] = useState<string>('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (prestacionEditar) {
      setNombre(prestacionEditar.nombre || '')
      setEspecialidad(prestacionEditar.especialidad || ESPECIALIDADES_ODONTOLOGICAS[0])
      setPrecioParticular(
        prestacionEditar.precioParticular != null
          ? String(prestacionEditar.precioParticular)
          : prestacionEditar.precio != null
          ? String(prestacionEditar.precio)
          : ''
      )
      setPrecioFonasa(
        prestacionEditar.precioFonasa != null ? String(prestacionEditar.precioFonasa) : ''
      )
      setCodigoFonasa(prestacionEditar.codigoFonasa || '')
    }
  }, [prestacionEditar])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!nombre.trim() || !precioParticular) return

    const valParticular = parseFloat(precioParticular) || 0
    const valFonasa = parseFloat(precioFonasa) || 0

    const prestacionObj: PrestacionInput = {
      id: prestacionEditar ? prestacionEditar.id : Date.now(),
      nombre: nombre.trim(),
      especialidad,
      precio: valParticular, // Propiedad requerida por FichaPaciente y Presupuestos
      precioParticular: valParticular,
      precioFonasa: valFonasa,
      codigoFonasa: codigoFonasa.trim()
    }

    setGuardando(true)
    setError('')
    try {
      await alGuardar(prestacionObj)
      alCerrar()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la prestación.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={alCerrar}
      title={prestacionEditar ? 'Editar Procedimiento de Arancel' : 'Registrar Nueva Prestación'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Nombre del Procedimiento / Tratamiento"
          type="text"
          required
          placeholder="Ej: Obturación Resina 1 Cara..."
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Especialidad Clínica
          </label>
          <select
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-medium"
          >
            {ESPECIALIDADES_ODONTOLOGICAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio Particular ($)"
            type="number"
            required
            placeholder="Ej: 35000"
            value={precioParticular}
            onChange={(e) => setPrecioParticular(e.target.value)}
          />

          <Input
            label="Precio Fonasa / Convenio ($)"
            type="number"
            placeholder="Ej: 28000"
            value={precioFonasa}
            onChange={(e) => setPrecioFonasa(e.target.value)}
          />
        </div>

        <Input
          label="Código Fonasa (Opcional)"
          type="text"
          placeholder="Ej: 01-02-010"
          value={codigoFonasa}
          onChange={(e) => setCodigoFonasa(e.target.value)}
        />

        {error && <p role="alert" className="text-red-700 text-xs">{error}</p>}
        <div className="flex gap-2 pt-3">
          <Button type="button" onClick={alCerrar} variant="ghost" fullWidth>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" fullWidth disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar Prestación'}
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevaPrestacion.displayName = 'ModalNuevaPrestacion'
