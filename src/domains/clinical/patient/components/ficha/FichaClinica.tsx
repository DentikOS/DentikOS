import React, { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, User, Activity, Clock, Shield, Pill, Layers, FileText, Camera } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

import { AlertasCriticasHeader } from './AlertasCriticasHeader'
import { DatosPaciente } from './DatosPaciente'
import { Odontograma } from './odontograma/Odontograma'
import { Periodontograma } from './periodontograma/Periodontograma'
import { Evoluciones } from './evoluciones/Evoluciones'
import { Recetas } from './recetas/Recetas'
import { Consentimientos } from './consentimientos/Consentimientos'
import { PlanTratamiento } from './plan-tratamiento/PlanTratamiento'
import { Timeline } from './Timeline'
import { ModoQuirurgico } from './ModoQuirurgico'
import { AdjuntosSection } from './adjuntos/AdjuntosSection'

export interface FichaClinicaProps {
  paciente?: Paciente
  pacienteId?: string | number
  alActualizarPaciente?: (datos: Partial<Paciente> | Paciente) => void
  alEliminarPaciente?: (id: string | number) => void
  alVolver?: () => void
  onGenerarPresupuesto?: (fases: unknown) => void
  navegacionClinica?: unknown
}

const TABS_FICHA = [
  { id: 'datos', label: 'Datos Paciente', icon: User },
  { id: 'odontograma', label: 'Odontograma', icon: Activity },
  { id: 'periodontograma', label: 'Periodontograma', icon: Activity },
  { id: 'evoluciones', label: 'Evoluciones', icon: FileText },
  { id: 'recetas', label: 'Recetas', icon: Pill },
  { id: 'consentimientos', label: 'Consentimientos', icon: Shield },
  { id: 'plan-tratamiento', label: 'Plan Tratamiento', icon: Layers },
  { id: 'adjuntos', label: 'Fotos & RX', icon: Camera },
  { id: 'timeline', label: 'Timeline', icon: Clock },
] as const

type PestanaId = (typeof TABS_FICHA)[number]['id']

const sonarAlerta220Hz = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {
    // Audio context bloqueado en autoplay o testing
  }
}

export const FichaClinica: React.FC<FichaClinicaProps> = ({
  paciente,
  pacienteId,
  alActualizarPaciente,
  alEliminarPaciente,
  alVolver,
  onGenerarPresupuesto,
}) => {
  const pacientes = usePacientesStore((s) => s.pacientes)
  const pacienteActivoStore = usePacientesStore((s) => s.pacienteActivo)
  const cerrarFicha = usePacientesStore((s) => s.cerrarFicha)
  const pestanaActivaStore = usePacientesStore((s) => s.pestanaActiva)
  const setPestanaActivaStore = usePacientesStore((s) => s.setPestanaActiva)

  const [modoQuirurgicoActivo, setModoQuirurgicoActivo] = useState(false)
  const [modoPresentacionActivo, setModoPresentacionActivo] = useState(false)

  const pacienteFinal: Paciente =
    paciente ||
    (pacienteId ? pacientes.find((p) => String(p.id) === String(pacienteId)) : null) ||
    pacienteActivoStore ||
    pacientes[0]

  useEffect(() => {
    const tieneAlergias = Boolean(
      (Array.isArray(pacienteFinal?.alergiasSeveras) && pacienteFinal.alergiasSeveras.length > 0) ||
      (typeof pacienteFinal?.alergias === 'string' && pacienteFinal.alergias.trim())
    )
    if (tieneAlergias) {
      sonarAlerta220Hz()
    }
  }, [pacienteFinal?.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modoQuirurgicoActivo) setModoQuirurgicoActivo(false)
        if (modoPresentacionActivo) setModoPresentacionActivo(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modoQuirurgicoActivo, modoPresentacionActivo])

  const pestanaActual: PestanaId =
    (pestanaActivaStore as PestanaId) in { datos: 1, odontograma: 1, periodontograma: 1, evoluciones: 1, recetas: 1, consentimientos: 1, 'plan-tratamiento': 1, adjuntos: 1, timeline: 1 }
      ? (pestanaActivaStore as PestanaId)
      : 'datos'

  const handleVolver = () => {
    if (alVolver) {
      alVolver()
    } else {
      cerrarFicha()
    }
  }

  if (modoQuirurgicoActivo && pacienteFinal) {
    return <ModoQuirurgico paciente={pacienteFinal} onSalir={() => setModoQuirurgicoActivo(false)} />
  }

  if (!pacienteFinal) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        No se encontró información del paciente.{' '}
        <Button onClick={handleVolver} variant="secondary">Volver</Button>
      </div>
    )
  }

  return (
    <div
      className={`space-y-4 pb-12 ${modoPresentacionActivo ? 'p-6 bg-surface max-w-5xl mx-auto' : ''}`}
      data-testid="ficha-clinica-bp06"
    >
      {/* Barra de Navegación Superior */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-surface">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          icon={ArrowLeft}
          onClick={handleVolver}
          data-testid="btn-volver-pacientes"
        >
          Volver a Pacientes
        </Button>

        <div className="flex items-center gap-2">
          {alEliminarPaciente && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={Trash2}
              className="text-clinical-error hover:bg-clinical-error/10"
              onClick={() => {
                alEliminarPaciente(pacienteFinal.id)
                cerrarFicha()
              }}
            >
              Eliminar Paciente
            </Button>
          )}
        </div>
      </div>

      {/* Encabezado Fijo con Alertas Críticas */}
      <AlertasCriticasHeader
        paciente={pacienteFinal}
        onModoQuirurgico={() => setModoQuirurgicoActivo(true)}
        onModoPresentacion={() => setModoPresentacionActivo((p) => !p)}
      />

      {/* Pestañas de la Ficha Clínica */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-surface">
        {TABS_FICHA.map((tab) => {
          const Icon = tab.icon
          const isActiva = pestanaActual === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPestanaActivaStore(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActiva
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface border border-surface hover:bg-surface-hover text-graphite-600 dark:text-graphite-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Renderizado de la Pestaña Activa */}
      <div className="pt-2">
        {pestanaActual === 'datos' && (
          <DatosPaciente
            paciente={pacienteFinal}
            onGuardar={(datos) => alActualizarPaciente?.(datos)}
          />
        )}
        {pestanaActual === 'odontograma' && <Odontograma pacienteId={String(pacienteFinal.id)} />}
        {pestanaActual === 'periodontograma' && <Periodontograma pacienteId={String(pacienteFinal.id)} />}
        {pestanaActual === 'evoluciones' && (
          <Evoluciones
            nombrePaciente={pacienteFinal.nombreCompleto || pacienteFinal.nombre}
          />
        )}
        {pestanaActual === 'recetas' && <Recetas paciente={pacienteFinal} />}
        {pestanaActual === 'consentimientos' && <Consentimientos paciente={pacienteFinal} />}
        {pestanaActual === 'plan-tratamiento' && (
          <PlanTratamiento
            nombrePaciente={pacienteFinal.nombreCompleto || pacienteFinal.nombre}
            onGenerarPresupuesto={onGenerarPresupuesto}
          />
        )}
        {pestanaActual === 'adjuntos' && (
          <AdjuntosSection paciente={pacienteFinal} pacienteId={String(pacienteFinal.id)} />
        )}
        {pestanaActual === 'timeline' && <Timeline pacienteId={pacienteFinal.id} />}
      </div>
    </div>
  )
}
