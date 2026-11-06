import React, { memo, useState } from 'react'
import { UserRoundPlus } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'

export interface PacienteUrgenciaMinimo {
  id: string | number
  nombre?: string
  rut?: string
  clinicaId?: string | null
}

export interface FormRegistroGesProps {
  pacientes?: PacienteUrgenciaMinimo[]
  alRegistrar: (pacienteId: string, requestId: string) => Promise<{ estado: 'sincronizado' | 'pendiente' }>
  error?: string | null
}

const nuevoId = (): string => globalThis.crypto?.randomUUID?.() || ''

export const FormRegistroGes: React.FC<FormRegistroGesProps> = memo(({ pacientes = [], alRegistrar, error }) => {
  const [pacienteId, setPacienteId] = useState('')
  const [requestId, setRequestId] = useState(nuevoId)
  const [guardando, setGuardando] = useState(false)
  const [estadoLocal, setEstadoLocal] = useState<'sincronizado' | 'pendiente' | null>(null)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!pacienteId || !requestId || guardando) return
    setGuardando(true)
    setEstadoLocal(null)
    setErrorLocal(null)
    try {
      const resultado = await alRegistrar(pacienteId, requestId)
      setEstadoLocal(resultado.estado)
      setPacienteId('')
      setRequestId(nuevoId())
    } catch (cause) {
      setErrorLocal(cause instanceof Error ? cause.message : 'No se pudo registrar la llegada')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-surface bg-surface p-5 shadow-xs">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-50">
          <UserRoundPlus size={17} aria-hidden="true" /> Registrar llegada
        </h2>
        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
          La hora oficial la asigna el servidor al confirmar. Una llegada capturada sin conexión queda marcada como pendiente.
        </p>
      </div>

      <label className="mb-1 block text-xs font-semibold text-graphite-700 dark:text-graphite-200" htmlFor="urgencia-paciente">
        Paciente
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          id="urgencia-paciente"
          required
          value={pacienteId}
          onChange={(event) => setPacienteId(event.target.value)}
          className="min-h-10 w-full rounded-lg border border-surface bg-white px-3 text-sm text-graphite-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-graphite-900 dark:text-graphite-50"
        >
          <option value="">Selecciona un paciente</option>
          {pacientes.map((paciente) => (
            <option key={paciente.id} value={paciente.id}>
              {paciente.nombre || 'Paciente'}{paciente.rut ? ` (${paciente.rut})` : ''}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary" loading={guardando} disabled={!requestId || guardando} icon={UserRoundPlus}>
          Registrar llegada
        </Button>
      </div>

      <p aria-live="polite" className="mt-3 min-h-4 text-xs">
        {estadoLocal === 'sincronizado' && <span className="text-emerald-700 dark:text-emerald-300">Llegada sincronizada.</span>}
        {estadoLocal === 'pendiente' && <span className="text-amber-800 dark:text-amber-200">Pendiente de sincronización; visible solo en este dispositivo.</span>}
        {(errorLocal || error) && <span className="text-red-700 dark:text-red-300">{errorLocal || error}</span>}
      </p>
    </form>
  )
})

FormRegistroGes.displayName = 'FormRegistroGes'
