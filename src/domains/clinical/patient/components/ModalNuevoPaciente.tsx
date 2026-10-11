import React, { memo, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { formatearRut, obtenerErrorRut } from '../../../../shared/utils/validarRut'
import { rutDuplicado, type Paciente } from '../schemas/pacienteSchema'
import { markFormDirty, markFormSaved } from '../../../../shared/utils/formDirtyUtils'

export interface NuevoPacienteFormData {
  nombre: string
  rut: string
  telefono?: string
  edad?: string | number
  prevision?: string
  alergias?: string
  email?: string
  direccion?: string
  ocupacion?: string
  contactoEmergencia?: string
  id?: string | number
  [key: string]: unknown
}

export interface ModalNuevoPacienteProps {
  alGuardar: (nuevoPaciente: NuevoPacienteFormData) => void
  alCerrar: () => void
  pacientes?: Array<Partial<Paciente> & { rut?: string; [key: string]: unknown }>
}

export const ModalNuevoPaciente: React.FC<ModalNuevoPacienteProps> = memo(({ alGuardar, alCerrar, pacientes = [] }) => {
  const [nuevoPaciente, setNuevoPaciente] = useState<NuevoPacienteFormData>({
    nombre: '', rut: '', telefono: '', edad: '', prevision: 'Fonasa', alergias: '', email: '', direccion: '', ocupacion: '', contactoEmergencia: ''
  })
  const [errorRut, setErrorRut] = useState<string>('')
  const [rutValido, setRutValido] = useState<boolean>(false)
  const [enviando, setEnviando] = useState<boolean>(false)

  const actualizarCampo = (campo: keyof NuevoPacienteFormData, valor: unknown): void => {
    markFormDirty()
    setNuevoPaciente((prev) => ({ ...prev, [campo]: valor }))
  }

  // Validación en tiempo real del RUT
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    markFormDirty()
    const valor = e.target.value
    setNuevoPaciente(prev => ({ ...prev, rut: valor }))
    
    if (!valor.trim()) {
      setErrorRut('')
      setRutValido(false)
      return
    }
    
    const error = obtenerErrorRut(valor)
    if (error) {
      setErrorRut(error)
      setRutValido(false)
      return
    }
    
    // Verificar duplicados
    if (rutDuplicado(valor, pacientes as Paciente[])) {
      setErrorRut('Este RUT ya está registrado')
      setRutValido(false)
      return
    }
    
    setErrorRut('')
    setRutValido(true)
  }

  // Normalización automática al perder foco
  const handleRutBlur = (): void => {
    if (nuevoPaciente.rut.trim() && !errorRut) {
      const formateado = formatearRut(nuevoPaciente.rut)
      setNuevoPaciente(prev => ({ ...prev, rut: formateado }))
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    
    // Validación final antes de guardar
    if (!nuevoPaciente.nombre || !nuevoPaciente.rut || !nuevoPaciente.telefono) return
    if (!rutValido || errorRut) return

    setEnviando(true)

    const nuevo: NuevoPacienteFormData = {
      ...nuevoPaciente,
      id: Date.now(),
      edad: nuevoPaciente.edad || '30'
    }

    markFormSaved()
    alGuardar(nuevo)
    setEnviando(false)
  }

  const puedeGuardar = Boolean(
    nuevoPaciente.nombre.trim() &&
    nuevoPaciente.rut.trim() &&
    nuevoPaciente.telefono?.trim() &&
    rutValido &&
    !errorRut
  )

  return (
    <Modal
      isOpen={true}
      onClose={alCerrar}
      title="Registrar Nuevo Paciente"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <Input
          data-testid="paciente-nombre"
          label="Nombre Completo"
          type="text"
          required
          value={nuevoPaciente.nombre}
          onChange={(e) => actualizarCampo('nombre', e.target.value)}
          placeholder="Ej: Juan Pérez González"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-gray-600 dark:text-graphite-400 uppercase mb-1">
              RUT <span className="text-[#E11D48] required-asterisk">*</span>
            </label>
            <input
              data-testid="paciente-rut"
              type="text"
              required
              value={nuevoPaciente.rut}
              onChange={handleRutChange}
              onBlur={handleRutBlur}
              placeholder="12.345.678-9"
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                errorRut ? 'border-red-500 bg-red-50' :
                rutValido ? 'border-green-500 bg-green-50' :
                'border-gray-300 dark:border-graphite-600'
              }`}
            />
            {errorRut && (
              <p data-testid="paciente-rut-error" className="text-red-600 text-xs mt-1 font-medium">
                {errorRut}
              </p>
            )}
            {rutValido && !errorRut && (
              <p data-testid="paciente-rut-valido" className="text-green-600 text-xs mt-1 font-medium">
                RUT válido
              </p>
            )}
          </div>
          <div>
            <Input
              data-testid="paciente-telefono"
              label="Teléfono"
              type="text"
              required
              value={nuevoPaciente.telefono || ''}
              onChange={(e) => actualizarCampo('telefono', e.target.value)}
              placeholder="+56 9 1234 5678"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Input
              label="Edad"
              type="number"
              value={nuevoPaciente.edad ? String(nuevoPaciente.edad) : ''}
              onChange={(e) => actualizarCampo('edad', e.target.value)}
              placeholder="30"
            />
          </div>
          <div>
            <Input
              label="Correo"
              type="email"
              value={nuevoPaciente.email || ''}
              onChange={(e) => actualizarCampo('email', e.target.value)}
              placeholder="juan@ejemplo.com"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 dark:text-graphite-400 uppercase mb-1">Previsión</label>
            <select
              value={nuevoPaciente.prevision || 'Fonasa'}
              onChange={(e) => actualizarCampo('prevision', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-graphite-600 text-sm bg-white dark:bg-graphite-800"
            >
              <option value="Fonasa">Fonasa</option>
              <option value="Isapre">Isapre</option>
              <option value="Particular">Particular</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-red-600 uppercase mb-1">Alergias Conocidas</label>
          <input
            data-testid="paciente-alergias"
            type="text"
            value={nuevoPaciente.alergias || ''}
            onChange={(e) => actualizarCampo('alergias', e.target.value)}
            placeholder="Ej: Penicilina, AINEs, Ninguna"
            className="w-full px-3 py-2 rounded-lg border border-red-200 bg-red-50/30 text-sm"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            data-testid="paciente-cancelar"
            type="button"
            onClick={alCerrar}
            variant="ghost"
            fullWidth
          >
            Cancelar
          </Button>
          <Button
            data-testid="paciente-crear"
            type="submit"
            disabled={!puedeGuardar || enviando}
            loading={enviando}
            variant="primary"
            fullWidth
          >
            {enviando ? 'Creando...' : 'Crear Paciente'}
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevoPaciente.displayName = 'ModalNuevoPaciente'
