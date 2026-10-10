import React, { memo, useMemo, useState } from 'react'
import { Ban, Plus, Armchair, Calendar } from 'lucide-react'
import { Button } from '../../../shared/ui/ui/Button'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { EmptyState } from '../../../shared/ui/ui/EmptyState'
import { useAgenda } from './hooks/useAgenda'
import { AgendaSummaryCards } from './components/AgendaSummaryCards'
import { AgendaViewSelector } from './components/AgendaViewSelector'
import { CitaCard } from './components/CitaCard'
import { ModalNuevaCita } from './components/ModalNuevaCita'
import { ModalNuevoBloqueo } from './components/ModalNuevoBloqueo'
import { AgendaListView } from './components/AgendaListView'
import { AgendaProfesionalView } from './components/AgendaProfesionalView'
import { AgendaDayView } from './components/AgendaDayView'
import { AgendaWeekView } from './components/AgendaWeekView'
import { AgendaMonthView } from './components/AgendaMonthView'
import { AgendaNavigation } from './components/AgendaNavigation'
import { WaitingRoomPanel } from './components/WaitingRoomPanel'
import { AgendaQuirurgica } from './components/AgendaQuirurgica'
import { useAgendaStore } from '../../../app/stores/useAgendaStore'
import { useThemeStore } from '../../../app/stores/useThemeStore'
import { exportarCitasCSV } from '../../../shared/utils/csvExport'
import { SILLONES_DENTALES } from './constants/agendaConstants'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import type { Cita } from './schemas/citaSchema'
import type { Paciente } from '../../../domains/clinical/patient/schemas/pacienteSchema'

export interface AgendaModuloProps {
  alSeleccionarPaciente?: (target: Paciente) => void
  alVerFichaPaciente?: (target: Paciente) => void
}

export const AgendaModulo: React.FC<AgendaModuloProps> = memo(({ alSeleccionarPaciente, alVerFichaPaciente }) => {
  const pacientesProp = usePacientesStore((state: { pacientes: Paciente[] }) => state.pacientes)

  const {
    citas,
    pacientes,
    fechaSeleccionada,
    setFechaSeleccionada,
    boxFiltro,
    setBoxFiltro,
    doctorFiltro,
    setDoctorFiltro,
    modalNuevaCitaAbierto,
    setModalNuevaCitaAbierto,
    modalNuevoBloqueoAbierto,
    setModalNuevoBloqueoAbierto,
    guardarCita,
    eliminarCita,
    cambiarEstadoCita,
    enviarWhatsAppConfirmacion
  } = useAgenda(pacientesProp)

  const currentView = useAgendaStore((state) => state.currentView)
  const setStoreView = useAgendaStore((state) => state.setView)
  const theme = useThemeStore((state) => state.theme)

  // F7-27: Estado de vista de agenda
  const [vista, setVista] = useState<string>('box')
  const [busqueda, setBusqueda] = useState<string>('')

  const citasDelDia = useMemo(() => {
    let filtradas = citas.filter(c => c.fecha === fechaSeleccionada)
    if (busqueda && busqueda.trim()) {
      const termino = busqueda.toLowerCase().trim()
      filtradas = filtradas.filter(c =>
        (c.pacienteNombre || '').toLowerCase().includes(termino) ||
        (c.pacienteRut || '').toLowerCase().includes(termino) ||
        (c.trataMiento || '').toLowerCase().includes(termino) ||
        String(c.pacienteTelefono || '').toLowerCase().includes(termino)
      )
    }
    return filtradas
  }, [citas, fechaSeleccionada, busqueda])

  // F7-27: Handler de exportación CSV
  const handleExportarCSV = (): void => {
    exportarCitasCSV(citasDelDia, `agenda_${fechaSeleccionada}`)
  }

  const funcionVerFicha = (target: string | number | Cita | undefined): void => {
    if (!target) return
    let pacienteParaNavegar: Paciente | undefined

    if (typeof target === 'object' && 'rut' in target && 'nombre' in target) {
      pacienteParaNavegar = target as unknown as Paciente
    } else {
      const pId = typeof target === 'object' ? target.pacienteId : target
      pacienteParaNavegar = pacientes.find(p => String(p.id) === String(pId))
      if (!pacienteParaNavegar && typeof target === 'object') {
        pacienteParaNavegar = {
          id: target.pacienteId || target.id,
          nombre: target.pacienteNombre || 'Paciente',
          rut: target.pacienteRut || '',
          telefono: target.pacienteTelefono
        }
      }
    }

    if (pacienteParaNavegar) {
      if (alSeleccionarPaciente) {
        alSeleccionarPaciente(pacienteParaNavegar)
      } else if (alVerFichaPaciente) {
        alVerFichaPaciente(pacienteParaNavegar)
      }
    }
  }

  if (theme === 'surgical') {
    return (
      <AgendaQuirurgica
        citas={citasDelDia}
        onAbrirFicha={funcionVerFicha}
      />
    )
  }

  const boxesAMostrar = boxFiltro === 'Todos'
    ? SILLONES_DENTALES
    : SILLONES_DENTALES.filter(b => b.nombre === boxFiltro)

  return (
    <div className="space-y-6" role="main" aria-label="Agenda de citas">
      {/* PageHeader con acciones */}
      <PageHeader
        icon={Calendar}
        title="Agenda multi-box y control de sillones"
        description="Gestión inteligente de citas, ocupación de Boxes y confirmación omnicanal."
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              onClick={() => setModalNuevoBloqueoAbierto(true)}
              variant="danger"
              size="sm"
              icon={Ban}
            >
              Añadir bloqueo
            </Button>
            <Button
              type="button"
              onClick={() => setModalNuevaCitaAbierto(true)}
              variant="primary"
              icon={Plus}
            >
              Agendar nueva cita
            </Button>
          </div>
        }
      />

      {/* Navegación temporal y de vistas */}
      <AgendaNavigation
        currentDateIso={fechaSeleccionada}
        onDateChange={(nuevaFecha) => setFechaSeleccionada(nuevaFecha)}
      />

      {/* Selector de Fecha + Filtro por Box/Doctor */}
      <AgendaViewSelector
        fechaSeleccionadaIso={fechaSeleccionada}
        setFechaSeleccionadaIso={setFechaSeleccionada}
        boxFiltro={boxFiltro}
        setBoxFiltro={setBoxFiltro}
        doctorFiltro={doctorFiltro}
        setDoctorFiltro={setDoctorFiltro}
        doctoresDisponibles={[]}
        vista={vista}
        setVista={(v) => {
          setVista(v)
          if (v === 'day' || v === 'week' || v === 'month' || v === 'list') {
            setStoreView(v)
          }
        }}
        onExportarCSV={handleExportarCSV}
        onBusquedaChange={setBusqueda}
      />

      {/* F7-27: Indicador de resultados de búsqueda */}
      {busqueda && busqueda.trim() && (
        <div className="bg-clinical-info/10 dark:bg-sky-400/15 border border-clinical-info/30 dark:border-sky-400/30 rounded-xl px-4 py-2 text-xs text-clinical-info dark:text-sky-300 font-semibold flex items-center justify-between">
          <span>
            Búsqueda: <strong>"{busqueda}"</strong> — {citasDelDia.length} resultado{citasDelDia.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setBusqueda('')}
            className="px-2 py-0.5 rounded-lg hover:bg-clinical-info/20 transition-colors cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <AgendaSummaryCards citas={citasDelDia} />

      {/* F7-27: Renderizado condicional de vistas de agenda */}
      {(vista === 'box' && currentView !== 'week' && currentView !== 'month' && currentView !== 'waiting_room' && currentView !== 'day') && (
        <div className="bg-canvas dark:bg-graphite-950 surgical:bg-graphite-300 border border-surface rounded-xl p-4 md:p-6" role="region" aria-label="Parrilla de sillones dentales">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {boxesAMostrar.map(box => {
              const citasBox = citasDelDia.filter(
                c => c.boxAsignado === box.nombre || c.boxAsignado === 'Todos los Boxes' || (!c.boxAsignado && box.id === 'sillon_1')
              )

              return (
                <div key={box.id} className="bg-surface border border-surface rounded-lg p-4 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-surface pb-2">
                      <div>
                        <h3 className="font-semibold text-xs text-graphite-900 dark:text-graphite-50 surgical:text-black uppercase tracking-wider">
                          {box.nombre}
                        </h3>
                        <span className="text-[10px] font-medium text-graphite-500 dark:text-graphite-400 surgical:text-graphite-700">
                          {box.especialidad}
                        </span>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-clinical-success animate-pulse"
                        title="Sillón Operativo"
                      />
                    </div>

                    <div className="space-y-3 min-h-[300px]">
                      {citasBox.length === 0 ? (
                        <EmptyState
                          compact
                          icon={Armchair}
                          title="Sin citas agendadas en este Box"
                          description="Disponible para reservas"
                          aria-live="polite"
                        />
                      ) : (
                        citasBox.map(cita => (
                          <CitaCard
                            key={cita.id}
                            cita={cita}
                            alCambiarEstado={cambiarEstadoCita}
                            alEnviarWhatsApp={enviarWhatsAppConfirmacion}
                            alVerFicha={funcionVerFicha}
                            alEliminar={eliminarCita}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {((currentView === 'day' && vista !== 'box' && vista !== 'lista' && vista !== 'profesional') || vista === 'day') && (
        <AgendaDayView
          appointments={citasDelDia}
          currentDateIso={fechaSeleccionada}
          selectedDoctor={doctorFiltro}
          selectedBox={boxFiltro}
          onAppointmentClick={(cita) => funcionVerFicha(cita)}
          onSlotClick={() => setModalNuevaCitaAbierto(true)}
          onAppointmentMove={(id, nuevaHora, col) => {
            const citaExistente = citas.find((c) => String(c.id) === String(id))
            if (citaExistente) {
              guardarCita({ ...citaExistente, horaInicio: nuevaHora, ...(col ? { doctor: col } : {}) })
            }
          }}
          onWhatsAppClick={enviarWhatsAppConfirmacion}
        />
      )}

      {(currentView === 'week' || vista === 'week') && (
        <AgendaWeekView
          appointments={citas}
          currentDateIso={fechaSeleccionada}
          onAppointmentClick={(cita) => funcionVerFicha(cita)}
          onDayClick={(iso) => {
            setFechaSeleccionada(iso)
            setStoreView('day')
            setVista('day')
          }}
          onNewAppointment={(iso) => {
            setFechaSeleccionada(iso)
            setModalNuevaCitaAbierto(true)
          }}
        />
      )}

      {(currentView === 'month' || vista === 'month') && (
        <AgendaMonthView
          appointments={citas}
          currentDateIso={fechaSeleccionada}
          onDayClick={(iso) => {
            setFechaSeleccionada(iso)
            setStoreView('day')
            setVista('day')
          }}
        />
      )}

      {vista === 'lista' && (
        <AgendaListView
          citas={citasDelDia}
          alVerFichaPaciente={funcionVerFicha}
          alCambiarEstadoCita={cambiarEstadoCita}
        />
      )}

      {vista === 'profesional' && (
        <AgendaProfesionalView
          citas={citasDelDia}
          doctoresDisponibles={[]}
          alVerFichaPaciente={funcionVerFicha}
        />
      )}

      {currentView === 'waiting_room' && (
        <WaitingRoomPanel
          pacientes={citasDelDia
            .filter((c) => c.estado === 'En sala de espera' || c.estado === 'En Espera')
            .map((c) => ({
              id: c.id,
              citaId: c.id,
              nombre: c.pacienteNombre || 'Paciente',
              horaLlegada: c.horaInicio,
              boxAsignado: c.boxAsignado,
              doctor: c.doctor,
              confirmadoWhatsApp: c.confirmacionWhatsApp === 'confirmado' || c.estado === 'Confirmado' || c.estado === 'Confirmada',
              enAtencion: false
            }))}
          totalEnAtencion={citasDelDia.filter((c) => c.estado === 'En atención' || c.estado === 'En Sillón').length}
          totalCompletadasHoy={citasDelDia.filter((c) => c.estado === 'Completada' || c.estado === 'Atendido').length}
          onIniciarAtencion={(id) => cambiarEstadoCita(id, 'En atención')}
          onMarcarNoShow={(id) => cambiarEstadoCita(id, 'No-show')}
          onAvisarPaciente={(id) => cambiarEstadoCita(id, 'En sala de espera')}
          onLlamarSiguiente={(id) => cambiarEstadoCita(id, 'En sala de espera')}
        />
      )}

      {/* Modales */}
      {modalNuevaCitaAbierto && (
        <ModalNuevaCita
          pacientes={pacientes}
          fechaPredeterminada={fechaSeleccionada}
          alGuardar={guardarCita}
          alCerrar={() => setModalNuevaCitaAbierto(false)}
          citasExistentes={citas}
        />
      )}

      {modalNuevoBloqueoAbierto && (
        <ModalNuevoBloqueo
          fechaPredeterminada={fechaSeleccionada}
          alGuardar={guardarCita}
          alCerrar={() => setModalNuevoBloqueoAbierto(false)}
          citasExistentes={citas}
        />
      )}
    </div>
  )
})

AgendaModulo.displayName = 'AgendaModulo'
