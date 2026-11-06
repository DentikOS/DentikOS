import React, { memo, useState, useEffect } from 'react'
import { useDashboard } from './hooks/useDashboard'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { useDashboardStore } from '../../../app/stores/useDashboardStore'
import { useMorningBrief } from '../../../shared/hooks/useMorningBrief'
import { useContextualIntelligence } from '../../../shared/hooks/useContextualIntelligence'
import { useSmartPriority } from '../../../shared/hooks/useSmartPriority'
import { DashboardSaludo } from '../../../shared/ui/dashboard/DashboardSaludo'
import { MorningBrief } from '../../../shared/ui/dashboard/MorningBrief'
import { ContextualIntelligenceCard } from '../../../shared/ui/dashboard/ContextualIntelligenceCard'
import { ChecklistOnboarding } from '../../../shared/ui/dashboard/ChecklistOnboarding'
import { MiniTour } from '../../../shared/ui/dashboard/MiniTour'
import { DashboardWidgetsGrid } from '../../../shared/ui/dashboard/DashboardWidgetsGrid'
import { ConfigurarWidgetsModal } from '../../../shared/ui/dashboard/ConfigurarWidgetsModal'
import { useDashboardRealtime } from '../../../shared/hooks/useDashboardRealtime'
import type { Paciente } from '../../../domains/clinical/patient/schemas/pacienteSchema'

export interface DashboardModuloProps {
  setPacienteSeleccionado?: (paciente: Paciente) => void
  setActiveSection?: (seccion: string) => void
}

export const DashboardModulo: React.FC<DashboardModuloProps> = memo(({ setPacienteSeleccionado, setActiveSection }) => {
  // BP04 §03: Suscribir a Supabase Realtime para actualización en tiempo real
  useDashboardRealtime()

  const pacientes = usePacientesStore((state) => state.pacientes || []) as Paciente[]
  const userProfile = useSesionStore((state) => state.userProfile)

  const userRole = (userProfile?.rol as string) || 'admin'
  const { widgets, widgetOrder, reorderWidgets, initParaRol, quickResumeData } = useDashboardStore()
  const morningBriefData = useMorningBrief(userRole)
  const mensajeContextual = useContextualIntelligence(null)
  const { sugerencia, aceptarSugerencia, descartarSugerencia, registrarClickWidget } = useSmartPriority()
  const { resumen } = useDashboard(pacientes)

  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)

  useEffect(() => {
    initParaRol(userRole)
  }, [userRole, initParaRol])

  const handleVerFichaPaciente = (paciente: Paciente) => {
    registrarClickWidget('pacientes_recientes')
    if (setPacienteSeleccionado && setActiveSection) {
      setPacienteSeleccionado(paciente)
      setActiveSection('Pacientes')
    }
  }

  const handleNavegarSeccion = (seccion: string) => {
    if (setActiveSection) {
      setActiveSection(seccion)
    }
  }

  const primeraCita = resumen.citasHoy?.[0]
  const proximaCita = primeraCita
    ? {
        pacienteNombre: String(primeraCita.pacienteNombre || 'Paciente'),
        hora: String(primeraCita.horaInicio || (primeraCita as { hora?: string }).hora || '10:00'),
        box: String((primeraCita as { box?: string }).box || primeraCita.boxAsignado || 'Box 1'),
        pacienteId: primeraCita.pacienteId
      }
    : null

  return (
    <div className="space-y-6">
      {/* Toast sugerencia Smart Priority */}
      {sugerencia && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-[#B88E3A]/40 text-xs shadow-xs animate-in slide-in-from-top-2">
          <span className="font-semibold text-[#0F172A] dark:text-white">
            Priorización Inteligente: Usas con frecuencia &quot;{sugerencia.nombre}&quot;. ¿Deseas moverlo al inicio?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={aceptarSugerencia}
              className="px-3 py-1 rounded-lg bg-[#B88E3A] text-white font-bold hover:bg-[#a07a30] transition-colors cursor-pointer"
            >
              Mover al primer lugar
            </button>
            <button
              type="button"
              onClick={descartarSugerencia}
              className="px-2 py-1 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Primero: contexto del día y trabajo inmediato. */}
      <DashboardSaludo
        userProfile={userProfile}
        citasHoyCount={resumen.citasHoyCount}
        enEsperaCount={resumen.enEspera?.length || 0}
        proximaCita={proximaCita}
        onVerFicha={(id) => {
          const p = pacientes.find((item) => String(item.id) === String(id))
          if (p) handleVerFichaPaciente(p)
        }}
        onAbrirConfig={() => setConfigModalOpen(true)}
      />

      <MorningBrief data={morningBriefData} onNavegar={handleNavegarSeccion} />

      {/* La configuración inicial queda disponible después del resumen operativo. */}
      <ContextualIntelligenceCard
        mensajeContextual={mensajeContextual}
        onAccion={() => handleNavegarSeccion('Agenda')}
      />

      <ChecklistOnboarding
        onNavegarSeccion={handleNavegarSeccion}
        onCompletarTour={() => setTourOpen(true)}
      />

      {/* Zona Central: 9 Widgets CORE Reordenables con Drag & Drop */}
      <DashboardWidgetsGrid
        widgets={widgets}
        widgetOrder={widgetOrder}
        citas={resumen.citasHoy}
        pacientes={pacientes}
        quickResumeData={quickResumeData}
        onVerFichaPaciente={handleVerFichaPaciente}
        onNavegarSeccion={handleNavegarSeccion}
        onReorderWidgets={reorderWidgets}
      />

      {/* Modales de soporte */}
      <ConfigurarWidgetsModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        userRole={userRole}
      />

      <MiniTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  )
})

DashboardModulo.displayName = 'DashboardModulo'
