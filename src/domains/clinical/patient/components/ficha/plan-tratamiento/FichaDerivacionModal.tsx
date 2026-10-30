import React, { useEffect, useState } from 'react'
import { Send, X, Stethoscope } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { getClinicaActivaSync } from '../../../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../../../infrastructure/supabase/migrations/uuidUtils'
import { listaArchivosDePaciente, type ArchivoClinicoRow } from '../../../../../../infrastructure/storage/r2ArchivosService'
import { agendaConfigService } from '../../../../../operations/agenda/services/agendaConfigService'
import type { DerivacionInput } from './derivacionesService'

interface FichaDerivacionModalProps {
  pacienteId?: string
  nombrePaciente: string
  nombreEmisor?: string
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
  pacienteId,
  nombrePaciente,
  nombreEmisor,
  onCerrar,
  onDerivar,
}) => {
  const [especialidad, setEspecialidad] = useState(ESPECIALIDADES[0])
  const [especialista, setEspecialista] = useState('')
  const [motivo, setMotivo] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [archivoIds, setArchivoIds] = useState<string[]>([])
  const [archivos, setArchivos] = useState<ArchivoClinicoRow[]>([])
  const [destinos, setDestinos] = useState<string[]>([])
  const [incluirOdontograma, setIncluirOdontograma] = useState(false)
  const [incluirEvoluciones, setIncluirEvoluciones] = useState(false)
  const [prioridad, setPrioridad] = useState<'normal' | 'urgente'>('normal')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!pacienteId || !esUuidValido(pacienteId)) return
    let vigente = true
    const clinicaId = getClinicaActivaSync()
    void Promise.all([listaArchivosDePaciente(pacienteId), agendaConfigService.obtenerDoctoresAgenda()])
      .then(([registros, doctores]) => {
        if (!vigente) return
        setArchivos(registros.filter((a) => a.paciente_id === pacienteId && a.clinica_id === clinicaId &&
          ['radiografia', 'foto_intraoral', 'foto_clinica'].includes(a.categoria)).slice(0, 20))
        setDestinos(doctores.map((doctor) => doctor.nombreCompleto))
      })
      .catch(() => { if (vigente) setError('No se pudieron cargar los antecedentes para adjuntar.') })
    return () => { vigente = false }
  }, [pacienteId])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      await onDerivar({ especialidad, especialista, motivo, diagnostico, prioridad,
        archivoIds, incluirOdontograma, incluirEvoluciones, emisor: nombreEmisor })
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
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
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
          <p className="text-graphite-500">Profesional derivante: <strong>{nombreEmisor || 'Usuario actual'}</strong></p>

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
              list="destinos-derivacion"
              value={especialista}
              onChange={(e) => setEspecialista(e.target.value)}
              className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs"
            />
            <datalist id="destinos-derivacion">{destinos.map((destino) => <option key={destino} value={destino} />)}</datalist>
          </div>

          <div>
            <label htmlFor="diagnostico-derivacion" className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">Diagnóstico de derivación</label>
            <input id="diagnostico-derivacion" type="text" value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)} required
              className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs" />
          </div>

          <fieldset className="space-y-1">
            <legend className="font-semibold mb-1">Antecedentes de la ficha actual</legend>
            <label className="flex gap-2"><input type="checkbox" checked={incluirOdontograma} onChange={(e) => setIncluirOdontograma(e.target.checked)} /> Odontograma</label>
            <label className="flex gap-2"><input type="checkbox" checked={incluirEvoluciones} onChange={(e) => setIncluirEvoluciones(e.target.checked)} /> Evoluciones relevantes</label>
            {archivos.map((archivo) => <label key={archivo.id} className="flex gap-2">
              <input type="checkbox" checked={archivoIds.includes(archivo.id)} onChange={(e) =>
                setArchivoIds((actuales) => e.target.checked ? [...actuales, archivo.id] : actuales.filter((id) => id !== archivo.id))} />
              {archivo.categoria === 'radiografia' ? 'Radiografía' : 'Foto'}: {archivo.nombre_archivo}
            </label>)}
          </fieldset>

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
