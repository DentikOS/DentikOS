import React, { useState, useRef, useEffect } from 'react'
import { User, Phone, Mail, MapPin, ShieldAlert, HeartPulse, Users2, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Input } from '../../../../../shared/ui/ui/Input'
import type { Paciente } from '../../schemas/pacienteSchema'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { SelectorEstadoPaciente } from './SelectorEstadoPaciente'

interface DatosPacienteProps {
  paciente: Paciente
  onGuardar: (datosActualizados: Partial<Paciente>) => void
}

export const DatosPaciente: React.FC<DatosPacienteProps> = ({ paciente, onGuardar }) => {
  const { esAdmin } = useRBAC()
  const [formData, setFormData] = useState<Partial<Paciente>>({
    nombreCompleto: paciente.nombreCompleto || paciente.nombre,
    rut: paciente.rut,
    fechaNacimiento: paciente.fechaNacimiento,
    sexo: paciente.sexo,
    telefono: paciente.telefono ? String(paciente.telefono) : '',
    telefonoSecundario: paciente.telefonoSecundario,
    email: paciente.email,
    direccion: paciente.direccion,
    comuna: paciente.comuna,
    region: paciente.region,
    ocupacion: paciente.ocupacion,
    prevision: paciente.prevision,
    estado: paciente.estado || 'activo',
    notasAdmin: paciente.notasAdmin || '',
    alergias: paciente.alergias || '',
    antecedentesQuirurgicos: paciente.antecedentesQuirurgicos,
    embarazo: paciente.embarazo,
    lactancia: paciente.lactancia,
    anticoagulantes: paciente.anticoagulantes,
    tutorLegal: paciente.tutorLegal,
  })

  const [estadoSincronizacion, setEstadoSincronizacion] = useState<'inactivo' | 'guardando' | 'guardado' | 'error'>('inactivo')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const guardarOptimista = async (actualizaciones: Partial<Paciente>) => {
    setEstadoSincronizacion('guardando')
    try {
      if (paciente?.id) {
        usePacientesStore.getState().actualizarPaciente(paciente.id, actualizaciones)
      }
      await onGuardar(actualizaciones)
      setEstadoSincronizacion('guardado')
      setTimeout(() => setEstadoSincronizacion('inactivo'), 2000)
    } catch {
      setEstadoSincronizacion('error')
      setTimeout(() => setEstadoSincronizacion('inactivo'), 3000)
    }
  }

  const handleChange = (campo: keyof Paciente, valor: unknown, esInmediato = false) => {
    setFormData((prev) => {
      const nuevo = { ...prev, [campo]: valor }
      if (esInmediato) {
        guardarOptimista(nuevo)
      } else {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          guardarOptimista(nuevo)
        }, 500)
      }
      return nuevo
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await guardarOptimista(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="datos-paciente-tab">
      {/* Sección: Estado del paciente */}
      <div className="bg-surface/90 border border-surface rounded-2xl p-5 shadow-xs space-y-2">
        <h4 className="text-xs font-semibold text-graphite-600 dark:text-graphite-400">
          Estado del paciente
        </h4>
        <SelectorEstadoPaciente paciente={paciente} />
      </div>

      {/* Sección 1: Datos Demográficos */}
      <div className="bg-surface/90 border border-surface rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            Datos Demográficos & Identificación
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Nombre Completo
            </label>
            <Input
              type="text"
              value={formData.nombreCompleto || ''}
              onChange={(e) => handleChange('nombreCompleto', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              RUT
            </label>
            <Input
              type="text"
              value={formData.rut || ''}
              onChange={(e) => handleChange('rut', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Fecha de Nacimiento
            </label>
            <Input
              type="date"
              value={formData.fechaNacimiento || ''}
              onChange={(e) => handleChange('fechaNacimiento', e.target.value)}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Sexo
            </label>
            <select
              value={formData.sexo || 'otro'}
              onChange={(e) => handleChange('sexo', e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Teléfono Principal
            </label>
            <Input
              type="tel"
              value={formData.telefono ? String(formData.telefono) : ''}
              onChange={(e) => handleChange('telefono', e.target.value)}
              icon={Phone}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Correo Electrónico
            </label>
            <Input
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              icon={Mail}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Dirección
            </label>
            <Input
              type="text"
              value={formData.direccion || ''}
              onChange={(e) => handleChange('direccion', e.target.value)}
              icon={MapPin}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Comuna
            </label>
            <Input
              type="text"
              value={formData.comuna || ''}
              onChange={(e) => handleChange('comuna', e.target.value)}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Previsión
            </label>
            <select
              value={formData.prevision || 'particular'}
              onChange={(e) => handleChange('prevision', e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="particular">Particular</option>
              <option value="fonasa">FONASA</option>
              <option value="isapre">ISAPRE</option>
              <option value="otro">Otro Convenio</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Estado del Paciente
            </label>
            <select
              data-testid="select-estado-paciente"
              value={formData.estado || 'activo'}
              onChange={(e) => handleChange('estado', e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary capitalize"
            >
              <option value="activo">Activo</option>
              <option value="nuevo">Nuevo</option>
              <option value="inactivo">Inactivo</option>
              <option value="bloqueado">Bloqueado (Solo Admin)</option>
            </select>
          </div>

          {formData.estado === 'bloqueado' && (
            <div className="col-span-full">
              <label className="block font-semibold mb-1 text-rose-600">
                Motivo de Bloqueo * (Requerido)
              </label>
              <Input
                data-testid="input-motivo-bloqueo"
                type="text"
                required
                value={formData.notasAdmin || ''}
                onChange={(e) => handleChange('notasAdmin', e.target.value)}
                placeholder="Indique el motivo por el cual se bloquea al paciente..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Sección 2: Antecedentes Médicos */}
      <div className="bg-surface/90 border border-surface rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface">
          <HeartPulse className="w-5 h-5 text-rose-500" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            Antecedentes Médicos & Quirúrgicos
          </h3>
        </div>

        <div className="mb-4 text-xs">
          <label className="block font-semibold mb-1 text-rose-600 dark:text-rose-400">
            Alergias Conocidas (Alerta Médica Severa)
          </label>
          <Input
            data-testid="input-alergias-paciente"
            type="text"
            value={Array.isArray(formData.alergias) ? formData.alergias.join(', ') : (formData.alergias || '')}
            onChange={(e) => handleChange('alergias', e.target.value)}
            placeholder="Ej: Penicilina, Látex, AINEs, Ninguna..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mb-4">
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-surface bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(formData.anticoagulantes)}
              onChange={(e) => handleChange('anticoagulantes', e.target.checked, true)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <span className="font-semibold text-graphite-700 dark:text-graphite-200">
              Uso de Anticoagulantes
            </span>
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-surface bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(formData.embarazo)}
              onChange={(e) => handleChange('embarazo', e.target.checked, true)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <span className="font-semibold text-graphite-700 dark:text-graphite-200">
              Estado de Embarazo
            </span>
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-surface bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(formData.lactancia)}
              onChange={(e) => handleChange('lactancia', e.target.checked, true)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <span className="font-semibold text-graphite-700 dark:text-graphite-200">
              Lactancia Activa
            </span>
          </label>
        </div>

        <div className="text-xs">
          <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
            Antecedentes Quirúrgicos y Hospitalizaciones
          </label>
          <textarea
            rows={2}
            value={formData.antecedentesQuirurgicos || ''}
            onChange={(e) => handleChange('antecedentesQuirurgicos', e.target.value)}
            placeholder="Intervenciones previas, cirugías, anestesias previas..."
            className="w-full p-3 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      </div>

      {/* Sección 3: Tutor Legal (menores) */}
      <div className="bg-surface/90 border border-surface rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface">
          <Users2 className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            Tutor Legal (Requerido para menores de edad)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Nombre Tutor
            </label>
            <Input
              type="text"
              value={formData.tutorLegal?.nombre || ''}
              onChange={(e) =>
                handleChange('tutorLegal', { ...formData.tutorLegal, nombre: e.target.value })
              }
              placeholder="Madre / Padre / Tutor"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              RUT Tutor
            </label>
            <Input
              type="text"
              value={formData.tutorLegal?.rut || ''}
              onChange={(e) =>
                handleChange('tutorLegal', { ...formData.tutorLegal, rut: e.target.value })
              }
              placeholder="12.345.678-9"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Relación / Parentesco
            </label>
            <Input
              type="text"
              value={formData.tutorLegal?.relacion || ''}
              onChange={(e) =>
                handleChange('tutorLegal', { ...formData.tutorLegal, relacion: e.target.value })
              }
              placeholder="Madre, Padre, Apoderado"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Teléfono Tutor
            </label>
            <Input
              type="tel"
              value={formData.tutorLegal?.telefono || ''}
              onChange={(e) =>
                handleChange('tutorLegal', { ...formData.tutorLegal, telefono: e.target.value })
              }
              placeholder="+56 9..."
            />
          </div>
        </div>
      </div>

      {/* Botón de guardado y feedback */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {estadoSincronizacion === 'guardando' && (
          <span className="flex items-center gap-1.5 text-xs text-primary font-semibold animate-pulse" data-testid="indicador-guardando">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
          </span>
        )}
        {estadoSincronizacion === 'guardado' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold" data-testid="indicador-guardado">
            <CheckCircle className="w-3.5 h-3.5" /> Guardado
          </span>
        )}
        {estadoSincronizacion === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold" data-testid="indicador-error">
            <AlertCircle className="w-3.5 h-3.5" /> Error al guardar
          </span>
        )}
        <Button type="submit" variant="primary" icon={Save}>
          Guardar Cambios
        </Button>
      </div>
    </form>
  )
}
