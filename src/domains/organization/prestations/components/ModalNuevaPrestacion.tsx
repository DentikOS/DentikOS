import React, { memo, useState, useEffect } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { ESPECIALIDADES_ODONTOLOGICAS } from '../constants/prestacionesConstants'
import type { Prestacion } from '../services/prestacionesStorageService'
import type { PrestacionInput } from '../hooks/usePrestaciones'
import { EQUIPAMIENTO_CLINICO } from '../../../../shared/constants/equipamientoClinico'
import type { MonedaDocumento } from '../../../../shared/utils/formatoDocumento'

export interface ModalNuevaPrestacionProps {
  prestacionEditar?: Prestacion | PrestacionInput | null
  moneda?: MonedaDocumento
  alGuardar: (prestacion: PrestacionInput) => Promise<void>
  alCerrar: () => void
}

export const ModalNuevaPrestacion: React.FC<ModalNuevaPrestacionProps> = memo(({
  prestacionEditar,
  moneda = 'CLP',
  alGuardar,
  alCerrar
}) => {
  const [nombre, setNombre] = useState<string>('')
  const [especialidad, setEspecialidad] = useState<string>(ESPECIALIDADES_ODONTOLOGICAS[0])
  const [precioParticular, setPrecioParticular] = useState<string>('')
  const [precioFonasa, setPrecioFonasa] = useState<string>('')
  const [codigoFonasa, setCodigoFonasa] = useState<string>('')
  const [codigoInterno, setCodigoInterno] = useState<string>('')
  const [categoria, setCategoria] = useState<string>('')
  const [equipamientoRequerido, setEquipamientoRequerido] = useState<string[]>([])
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
      setPrecioFonasa(prestacionEditar.precioFonasa != null ? String(prestacionEditar.precioFonasa) : '')
      setCodigoFonasa(prestacionEditar.codigoFonasa || '')
      setCodigoInterno(typeof prestacionEditar.codigoInterno === 'string' ? prestacionEditar.codigoInterno : '')
      setCategoria(typeof prestacionEditar.categoria === 'string' ? prestacionEditar.categoria : '')
      setEquipamientoRequerido(Array.isArray(prestacionEditar.equipamientoRequerido) ? prestacionEditar.equipamientoRequerido : [])
    } else {
      setPrecioFonasa('')
      setCodigoFonasa('')
      setCodigoInterno('')
      setCategoria('')
      setEquipamientoRequerido([])
    }
  }, [prestacionEditar])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!nombre.trim() || !precioParticular) return

    const valParticular = parseFloat(precioParticular) || 0
    const valFonasa = precioFonasa.trim() ? parseFloat(precioFonasa) : null

    const prestacionObj: PrestacionInput = {
      id: prestacionEditar ? prestacionEditar.id : Date.now(),
      nombre: nombre.trim(),
      especialidad,
      precio: valParticular, // Propiedad requerida por FichaPaciente y Presupuestos
      precioParticular: valParticular,
      precioFonasa: valFonasa,
      codigoFonasa: codigoFonasa.trim(),
      codigoInterno: codigoInterno.trim() || null,
      categoria: categoria.trim() || null,
      equipamientoRequerido,
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
            {prestacionEditar?.especialidad && !ESPECIALIDADES_ODONTOLOGICAS.includes(prestacionEditar.especialidad) && (
              <option value={prestacionEditar.especialidad}>{prestacionEditar.especialidad}</option>
            )}
            {ESPECIALIDADES_ODONTOLOGICAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-graphite-700">
          <legend className="px-1 text-xs font-semibold text-gray-700 dark:text-graphite-300">Equipamiento requerido en Agenda</legend>
          <p className="text-[11px] text-gray-500 dark:text-graphite-400">
            Selecciónalo según el protocolo de esta prestación. Agenda solo ofrecerá boxes que tengan todos los equipos elegidos.
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {EQUIPAMIENTO_CLINICO.map((equipo) => (
              <label key={equipo.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-graphite-200 dark:hover:bg-graphite-800">
                <input
                  type="checkbox"
                  checked={equipamientoRequerido.includes(equipo.id)}
                  onChange={(event) => setEquipamientoRequerido((actual) => event.target.checked
                    ? [...actual, equipo.id]
                    : actual.filter((id) => id !== equipo.id))}
                />
                {equipo.nombre}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Precio Particular (${moneda})`}
            type="number"
            required
            placeholder="Ej: 35000"
            value={precioParticular}
            onChange={(e) => setPrecioParticular(e.target.value)}
          />

          <Input
            label={`Precio Fonasa / Convenio (${moneda})`}
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Código interno (Opcional)"
            type="text"
            placeholder="Ej: PRE-01"
            value={codigoInterno}
            onChange={(e) => setCodigoInterno(e.target.value)}
          />
          <Input
            label="Categoría (Opcional)"
            type="text"
            placeholder="Ej: Preventivo"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>

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
