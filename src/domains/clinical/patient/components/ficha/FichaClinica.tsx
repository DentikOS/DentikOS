import React, { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, User, Activity, Clock, Layers, FileText, Pill } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

import { AlertasCriticasHeader } from './AlertasCriticasHeader'
import { ResumenEjecutivo } from './ResumenEjecutivo'
import { DatosPaciente } from './DatosPaciente'
import { Odontograma } from './odontograma/Odontograma'
import { Periodontograma } from './periodontograma/Periodontograma'
import { Evoluciones } from './evoluciones/Evoluciones'
import { PlanTratamiento } from './plan-tratamiento/PlanTratamiento'
import { RecetasConsentimientos } from './RecetasConsentimientos'
import { Timeline } from './Timeline'
import { ModoQuirurgico } from './ModoQuirurgico'
import { ModoPresentacion } from './ModoPresentacion'
import { determinarPestanaDefault, type PestanaFicha } from '../../services/contextualRouter'
import { sonarAlerta220Hz } from '../../utils/alertaSonido'

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
  { id: 'resumen-ejecutivo', label: 'Resumen Ejecutivo', icon: Activity },
  { id: 'datos', label: 'Datos del paciente', icon: User },
  { id: 'odontograma', label: 'Odontograma', icon: Activity },
  { id: 'periodontograma', label: 'Periodontograma', icon: Activity },
  { id: 'evoluciones', label: 'Evoluciones', icon: FileText },
  { id: 'presupuestos', label: 'Presupuestos + Plan Tratamiento', icon: Layers },
  { id: 'recetas-consentimientos', label: 'Recetas + Consentimientos + Docs', icon: Pill },
  { id: 'timeline', label: 'Timeline / Historial', icon: Clock },
] as const

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

  const pacienteStore = (pacienteId ? pacientes.find((p) => String(p.id) === String(pacienteId)) : null) || pacienteActivoStore
  const pacienteFinal: Paciente = pacienteStore || paciente || pacientes[0]

  useEffect(() => {
    const tieneAlergias = Boolean(
      (Array.isArray(pacienteFinal?.alergiasSeveras) && pacienteFinal.alergiasSeveras.length > 0) ||
      (typeof pacienteFinal?.alergias === 'string' && pacienteFinal.alergias.trim())
    )
    if (tieneAlergias) {
      sonarAlerta220Hz()
    }
  }, [pacienteFinal?.id, pacienteFinal?.alergias, pacienteFinal?.anticoagulantes])

  // Contextual Router (WS2)
  useEffect(() => {
    if (!pestanaActivaStore && pacienteFinal) {
      const tabDefault = determinarPestanaDefault(
        {
          esNuevo: !pacienteFinal.ultimaVisita,
          diasSinVisita: pacienteFinal.ultimaVisita ? 30 : 200,
          presupuestoPendienteDias: 0,
        },
        { citaActiva: false }
      )
      setPestanaActivaStore(tabDefault)
    }
  }, [pacienteFinal?.id, pestanaActivaStore, setPestanaActivaStore])

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

  const pestanaActual: PestanaFicha =
    (pestanaActivaStore as PestanaFicha) in {
      'resumen-ejecutivo': 1, datos: 1, odontograma: 1, periodontograma: 1,
      evoluciones: 1, presupuestos: 1, 'recetas-consentimientos': 1, timeline: 1
    }
      ? (pestanaActivaStore as PestanaFicha)
      : 'resumen-ejecutivo'

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

  if (modoPresentacionActivo) {
    return (
      <ModoPresentacion
        paciente={pacienteFinal}
        onSalir={() => setModoPresentacionActivo(false)}
      />
    )
  }

  return (
    <div className="space-y-4 pb-12" data-testid="ficha-clinica-bp06">
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

      {/* Encabezado Fijo con Alertas Críticas */}
      <AlertasCriticasHeader
        paciente={pacienteFinal}
        onModoQuirurgico={() => setModoQuirurgicoActivo(true)}
        onModoPresentacion={() => setModoPresentacionActivo((p) => !p)}
      />

      {/* 8 Pestañas exactas según BP06 §09 */}
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
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Renderizado de la Pestaña Activa */}
      <div className="pt-2">
        {pestanaActual === 'resumen-ejecutivo' && (
          <ResumenEjecutivo
            paciente={pacienteFinal}
            onNavegar={(p) => setPestanaActivaStore(p)}
          />
        )}
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
            pacienteId={String(pacienteFinal.id)}
          />
        )}
        {pestanaActual === 'presupuestos' && (
          <PlanTratamiento
            nombrePaciente={pacienteFinal.nombreCompleto || pacienteFinal.nombre}
            onGenerarPresupuesto={onGenerarPresupuesto}
          />
        )}
        {pestanaActual === 'recetas-consentimientos' && (
          <RecetasConsentimientos paciente={pacienteFinal} />
        )}
        {pestanaActual === 'timeline' && <Timeline pacienteId={pacienteFinal.id} />}
      </div>
    </div>
  )
}
