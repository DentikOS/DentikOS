import React, { useState } from 'react'
import { Send, X, Stethoscope } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import type { DerivacionInput } from './derivacionesService'

interface FichaDerivacionModalProps {
  nombrePaciente: string
  onCerrar: () => void
  onDerivar: (derivacion: DerivacionInput) => Promise<void>
}

const ESPECIALIDADES = [
  'Endodoncia',
  'Periodoncia',
  'Implantología Oral',
  'Cirugía Maxilofacial',
  'Ortodoncia',
  'Odontopediatría',
  'Rehabilitación Oral',
]

export const FichaDerivacionModal: React.FC<FichaDerivacionModalProps> = ({
  nombrePaciente,
  onCerrar,
  onDerivar,
}) => {
  const [especialidad, setEspecialidad] = useState(ESPECIALIDADES[0])
  const [especialista, setEspecialista] = useState('')
  const [motivo, setMotivo] = useState('')
  const [prioridad, setPrioridad] = useState<'normal' | 'urgente'>('normal')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      await onDerivar({ especialidad, especialista, motivo, prioridad })
      onCerrar()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo emitir la derivación.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      data-testid="modal-ficha-derivacion"
    >
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Ficha de Interconsulta / Derivación
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-graphite-400 hover:text-graphite-700"
            aria-label="Cerrar modal derivación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <p className="text-graphite-500">
            Derivando a: <span className="font-bold text-graphite-800 dark:text-graphite-200">{nombrePaciente}</span>
          </p>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Especialidad de Destino
            </label>
            <select
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs"
            >
              {ESPECIALIDADES.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Especialista (Opcional)
            </label>
            <input
              type="text"
              placeholder="Dr. o Clínica especialista de referencia"
              value={especialista}
              onChange={(e) => setEspecialista(e.target.value)}
              className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Motivo Clínico de Derivación & Hallazgos
            </label>
            <textarea
              rows={3}
              placeholder="Describa el motivo, piezas involucradas y antecedentes clave..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary resize-none"
              required
            />
          </div>

          <div className="flex items-center gap-4 pt-1">
            <span className="font-semibold text-graphite-700 dark:text-graphite-300">Prioridad:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="prioridad"
                checked={prioridad === 'normal'}
                onChange={() => setPrioridad('normal')}
              />
              <span>Normal</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-rose-600 font-bold">
              <input
                type="radio"
                name="prioridad"
                checked={prioridad === 'urgente'}
                onChange={() => setPrioridad('urgente')}
              />
              <span>Urgente</span>
            </label>
          </div>

          {error && <p role="alert" className="text-rose-700">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface">
            <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" icon={Send} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Emitir Derivación'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
