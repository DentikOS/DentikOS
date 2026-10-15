import React, { memo, useMemo, useEffect, useState, useCallback } from 'react'
import { Ban, Plus, Calendar, Settings, AlertTriangle, UserX, Users } from 'lucide-react'
import { Button } from '../../../shared/ui/ui/Button'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { useAgenda } from './hooks/useAgenda'
import { ModalNuevaCita } from './components/ModalNuevaCita'
import { ModalNuevoBloqueo } from './components/ModalNuevoBloqueo'
import { ModalConfiguracionHorarios } from './components/ModalConfiguracionHorarios'
import { ModalConfirmacionCita } from './components/ModalConfirmacionCita'
import { ModalEdicionSerie } from './components/ModalEdicionSerie'
import { ModalDiasFestivos } from './components/ModalDiasFestivos'
import { ModalDoctorAusente } from './components/ModalDoctorAusente'
import { ModalReasignarCita } from './components/ModalReasignarCita'
import { SalaEsperaDrawer } from './components/SalaEsperaDrawer'
import { AgendaListView } from './components/AgendaListView'
import { AgendaDayView, type MovePayload } from './components/AgendaDayView'
import { AgendaWeekView } from './components/AgendaWeekView'
import { AgendaMonthView } from './components/AgendaMonthView'
import { AgendaNavigation } from './components/AgendaNavigation'
import { AgendaQuirurgica } from './components/AgendaQuirurgica'
import { DoctorWaitingRoomBar } from './components/DoctorWaitingRoomBar'
import { waitingRoomService } from './services/waitingRoomService'
import { sonidoAgendaService } from './services/sonidoAgendaService'
import { editarCitaRecurrencia, cancelarCitaRecurrencia } from './services/recurrenciaService'
import { useAgendaStore } from '../../../app/stores/useAgendaStore'
import { useThemeStore } from '../../../app/stores/useThemeStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { usePermisosAgenda, puedeArrastrarCita } from './utils/permisosAgenda'
import { FILTROS_DOCTOR } from './constants/doctorConstants'
import { agendaConfigService, type DoctorAgenda } from './services/agendaConfigService'
import { registrarCambioEstado } from './utils/auditoriaCita'
import { validarTransicion } from './utils/validarTransicionEstado'
import { exportarCitasCSV } from '../../../shared/utils/csvExport'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { agendaStorageService } from './services/agendaStorageService'
import { normalizarCita, normalizarEstado } from './utils/normalizarCita'
import { deduplicarCitas } from './utils/deduplicarCitas'
import { ModalCambiarEstado } from './components/ModalCambiarEstado'
import { useAppDialog } from '../../../shared/hooks/useAppDialog'
import { timelineService } from '../../clinical/patient/services/timelineService'
import type { Cita } from './schemas/citaSchema'
import type { Paciente } from '../../../domains/clinical/patient/schemas/pacienteSchema'

export interface AgendaModuloProps {
  alSeleccionarPaciente?: (target: Paciente) => void
  alVerFichaPaciente?: (target: Paciente) => void
}

export const AgendaModulo: React.FC<AgendaModuloProps> = memo(({ alSeleccionarPaciente, alVerFichaPaciente }) => {
  const pacientesProp = usePacientesStore((state: { pacientes: Paciente[] }) => state.pacientes)
  const permisos = usePermisosAgenda()
  const userProfile = useSesionStore((s) => s.userProfile)
  const { confirm: dialogConfirm } = useAppDialog()
  const [modalHorariosAbierto, setModalHorariosAbierto] = useState(false)
  const [citaParaConfirmar, setCitaParaConfirmar] = useState<Cita | null>(null)
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState(false)
  const [citaParaEditar, setCitaParaEditar] = useState<Cita | null>(null)
  const [modalEdicionSerieAbierto, setModalEdicionSerieAbierto] = useState(false)
  const [modalDiasFestivosAbierto, setModalDiasFestivosAbierto] = useState(false)
  const [modalDoctorAusenteAbierto, setModalDoctorAusenteAbierto] = useState(false)
  const [salaEsperaAbierta, setSalaEsperaAbierta] = useState(false)
  const [citaParaReasignar, setCitaParaReasignar] = useState<Cita | null>(null)
  const [modalReasignarAbierto, setModalReasignarAbierto] = useState(false)
  const [citaParaEstado, setCitaParaEstado] = useState<Cita | null>(null)
  const [citaAEditar, setCitaAEditar] = useState<Cita | null>(null)
  const [doctores, setDoctores] = useState<DoctorAgenda[]>([])
  const [loadingDoctores, setLoadingDoctores] = useState(true)

  const {
    citas, pacientes, fechaSeleccionada, setFechaSeleccionada,
    boxFiltro, doctorFiltro, setDoctorFiltro,
    modalNuevaCitaAbierto, setModalNuevaCitaAbierto,
    modalNuevoBloqueoAbierto, setModalNuevoBloqueoAbierto,
    guardarCita, cambiarEstadoCita, eliminarCita
  } = useAgenda(pacientesProp)

  const currentView = useAgendaStore((state) => state.currentView)
  const setStoreView = useAgendaStore((state) => state.setView)
  const storeCitas = useAgendaStore((state) => state.citas)
  const storeDateIso = useAgendaStore((state) => state.currentDateIso)
  const theme = useThemeStore((state) => state.theme)

  const cargarDoctores = useCallback(async () => {
    setLoadingDoctores(true)
    try {
      const res = await agendaConfigService.obtenerDoctoresAgenda()
      setDoctores(res)
    } catch {
      setDoctores([])
    } finally {
      setLoadingDoctores(false)
    }
  }, [])

  useEffect(() => { cargarDoctores() }, [cargarDoctores])
  useEffect(() => { if (storeDateIso) setFechaSeleccionada(storeDateIso.split('T')[0]) }, [storeDateIso, setFechaSeleccionada])
  useEffect(() => {
    agendaStorageService.obtenerCitasDesdeSupabase().then((res) => {
      if (res?.length) useAgendaStore.getState().setCitas(res)
    }).catch(console.error)
  }, [])
  useEffect(() => {
    const onAbrir = () => setModalNuevaCitaAbierto(true)
    window.addEventListener('abrir_modal_cita', onAbrir); window.addEventListener('abrir_nueva_cita', onAbrir)
    return () => { window.removeEventListener('abrir_modal_cita', onAbrir); window.removeEventListener('abrir_nueva_cita', onAbrir) }
  }, [setModalNuevaCitaAbierto])

  const mapaDoctores = useMemo(() => {
    const m: Record<string, string> = {}
    doctores.forEach((d) => { m[d.userId] = d.nombreCompleto })
    return m
  }, [doctores])

  const todasLasCitas = useMemo(() =>
    deduplicarCitas(
      (storeCitas?.length ? storeCitas : citas).map((c) => normalizarCita(c, mapaDoctores))
    ),
    [storeCitas, citas, mapaDoctores])
  const citasDelDia = useMemo(() => {
    return todasLasCitas.filter(c => (c.fecha || '').split('T')[0] === (fechaSeleccionada || '').split('T')[0])
  }, [todasLasCitas, fechaSeleccionada])

  const doctorActualNombre = userProfile?.nombreCompleto || (typeof userProfile?.nombre === 'string' ? userProfile.nombre : '')
  const doctorFiltroEfectivo: string = useMemo(() => {
    if (doctorFiltro === FILTROS_DOCTOR.SOLO_YO) return doctorActualNombre
    return doctorFiltro
  }, [doctorFiltro, doctorActualNombre])

  const handleExportarCSV = (): void => exportarCitasCSV(citasDelDia, `agenda_${fechaSeleccionada}`)

  const handleAbrirConfirmacion = useCallback((targetCita: Cita) => {
    setCitaParaConfirmar(targetCita)
    setModalConfirmacionAbierto(true)
  }, [])

  const handleAbrirEdicionSerie = useCallback((cita: Cita) => {
    if (cita.recurrence_group_id) {
      setCitaParaEditar(cita)
      setModalEdicionSerieAbierto(true)
    }
  }, [])

  const handleEditarSerie = useCallback(async (alcance: 'solo_esta' | 'esta_y_futuras' | 'toda_la_serie') => {
    if (!citaParaEditar) return
    await editarCitaRecurrencia(citaParaEditar.id, {}, alcance)
    const res = await agendaStorageService.obtenerCitasDesdeSupabase()
    if (res?.length) useAgendaStore.getState().setCitas(res)
    setModalEdicionSerieAbierto(false)
    setCitaParaEditar(null)
  }, [citaParaEditar])

  const handleCancelarSerie = useCallback(async (alcance: 'solo_esta' | 'esta_y_futuras' | 'toda_la_serie') => {
    if (!citaParaEditar) return
    const motivo = window.prompt('Motivo de cancelación (opcional):')
    await cancelarCitaRecurrencia(citaParaEditar.id, alcance, motivo || undefined)
    const res = await agendaStorageService.obtenerCitasDesdeSupabase()
    if (res?.length) useAgendaStore.getState().setCitas(res)
    setModalEdicionSerieAbierto(false)
    setCitaParaEditar(null)
  }, [citaParaEditar])

  const registrarEnTimelinePaciente = useCallback(async (cita: Cita, descripcion: string, tipo: string = 'cita') => {
    const pacienteId = cita.pacienteId
    if (!pacienteId || String(pacienteId).startsWith('express_')) return
    await timelineService.agregarEvento(String(pacienteId), {
      tipo,
      titulo: descripcion,
      fecha: new Date().toISOString(),
      usuario: (userProfile as { nombreCompleto?: string })?.nombreCompleto || 'Usuario',
      profesional: cita.doctor || undefined,
      metadata: { citaId: String(cita.id) },
    })
  }, [userProfile])

  const handleConfirmarCita = useCallback(async (citaId: string | number, tipo: 'telefono' | 'presencial' | 'whatsapp_enviado') => {
    const c = todasLasCitas.find((item) => String(item.id) === String(citaId))
    if (!c) return
    await guardarCita({ ...c, estado: 'Confirmada', confirmation_status: 'confirmado' })
    const uId = (userProfile as { id?: string })?.id || 'local'
    await registrarCambioEstado(citaId, c.estado, 'Confirmada', uId, `Confirmación manual vía ${tipo}`)
    const desc = `Confirmación de cita vía ${tipo === 'telefono' ? 'llamada telefónica' : tipo === 'presencial' ? 'presencial' : 'WhatsApp'}`
    await registrarEnTimelinePaciente(c, desc, 'cita')
  }, [todasLasCitas, guardarCita, userProfile, registrarEnTimelinePaciente])

  const handleCancelarCita = useCallback(async (citaId: string | number, motivo: string) => {
    const c = todasLasCitas.find((item) => String(item.id) === String(citaId))
    if (!c) return
    await guardarCita({
      ...c, estado: 'Cancelada', confirmation_status: 'no_confirmado',
      observaciones: `${c.observaciones || ''}\n[Cancelación] ${motivo}`.trim(),
    })
    const uId = (userProfile as { id?: string })?.id || 'local'
    await registrarCambioEstado(citaId, c.estado, 'Cancelada', uId, motivo)
    await registrarEnTimelinePaciente(c, `Cita cancelada: ${motivo}`, 'cita')
  }, [todasLasCitas, guardarCita, userProfile, registrarEnTimelinePaciente])

  const handleCambiarEstado = useCallback(async (citaId: string | number, nuevoEstado: string) => {
    const cita = todasLasCitas.find((c) => String(c.id) === String(citaId))
    if (!cita) return
    const estadoActual = normalizarEstado(cita.estado)   // ← normalizar ANTES de validar
    if (estadoActual === nuevoEstado) return
    if (!validarTransicion(estadoActual, nuevoEstado)) return
    await guardarCita({ ...cita, estado: nuevoEstado })
    const uId = (userProfile as { id?: string })?.id || 'local-user'
    await registrarCambioEstado(citaId, estadoActual, nuevoEstado, uId, `Cambio de estado a ${nuevoEstado}`)
    await registrarEnTimelinePaciente(cita, `Estado de cita cambiado a ${nuevoEstado}`, 'cambio_estado')
  }, [todasLasCitas, guardarCita, userProfile, registrarEnTimelinePaciente])

  const handleEliminarCita = useCallback(async (cita: Cita) => {
    const ok = await dialogConfirm({
      title: 'Eliminar cita',
      description: `¿Eliminar la cita de ${cita.pacienteNombre || 'paciente'} del ${cita.fecha} ${String(cita.horaInicio).slice(0, 5)}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!ok) return
    await eliminarCita(cita.id)
    await registrarCambioEstado(cita.id, cita.estado, 'Eliminada', (userProfile as { id?: string })?.id || 'local', 'Cita eliminada')
    await registrarEnTimelinePaciente(cita, 'Cita eliminada de la agenda', 'cita')
    if (citaAEditar && String(citaAEditar.id) === String(cita.id)) {
      setCitaAEditar(null)
      setModalNuevaCitaAbierto(false)
    }
  }, [dialogConfirm, eliminarCita, userProfile, registrarEnTimelinePaciente, citaAEditar, setModalNuevaCitaAbierto])

  const handleEditarCita = useCallback((cita: Cita) => {
    setCitaAEditar(cita)
    setModalNuevaCitaAbierto(true)
  }, [setModalNuevaCitaAbierto])

  const handleAppointmentMove = useCallback(async (citaId: string | number, payload: MovePayload) => {
    const cita = todasLasCitas.find((c) => String(c.id) === String(citaId))
    if (!cita) return
    if (!puedeArrastrarCita(permisos, cita, userProfile)) return

    const cambios: Partial<Cita> = { horaInicio: payload.horaInicio }
    if (payload.fecha) cambios.fecha = payload.fecha
    if (payload.box) cambios.boxAsignado = payload.box
    cambios.doctor = !payload.doctor || payload.doctor === 'Sin asignar' ? undefined : payload.doctor

    if (cita.duracionMinutos) {
      const [h, m] = payload.horaInicio.split(':').map(Number)
      const total = (h || 0) * 60 + (m || 0) + (Number(cita.duracionMinutos) || 30)
      cambios.horaFin = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    }

    await guardarCita({ ...cita, ...cambios })
    const uId = (userProfile as { id?: string })?.id || 'local-user'
    await registrarCambioEstado(
      citaId,
      cita.estado,
      cita.estado,
      uId,
      `Movió cita a ${payload.fecha ? payload.fecha + ' ' : ''}${payload.horaInicio}${payload.doctor ? ` (${payload.doctor})` : ''}`
    )
    sonidoAgendaService.play('cita_movida')
  }, [todasLasCitas, permisos, userProfile, guardarCita])

  const handleLlamarSiguiente = useCallback(async (cita: Cita) => {
    await waitingRoomService.registrarEvento({
      appointmentId: cita.id, tipo: 'llamar_siguiente',
      doctorNombre: cita.doctor, boxAsignado: cita.boxAsignado,
    })
    window.dispatchEvent(new CustomEvent('sala_espera:llamada', {
      detail: { citaId: cita.id, doctor: cita.doctor, box: cita.boxAsignado }
    }))
  }, [])

  const handleReasignarCita = useCallback(async (citaId: string | number, nuevoDoctor?: string, nuevoBox?: string) => {
    const cita = todasLasCitas.find(c => String(c.id) === String(citaId))
    if (!cita) return
    const cambios: Partial<Cita> = {}
    if (nuevoDoctor && nuevoDoctor !== cita.doctor) cambios.doctor = nuevoDoctor
    if (nuevoBox && nuevoBox !== cita.boxAsignado) cambios.boxAsignado = nuevoBox
    await guardarCita({ ...cita, ...cambios })
    const uId = (userProfile as { id?: string })?.id || 'local-user'
    await registrarCambioEstado(
      citaId,
      cita.estado,
      cita.estado,
      uId,
      `Reasignó cita: doctor ${cita.doctor || 'sin'} → ${nuevoDoctor || 'sin'}, box ${cita.boxAsignado || 'sin'} → ${nuevoBox || 'sin'}`
    )
    await registrarEnTimelinePaciente(cita, `Cita reasignada a ${nuevoDoctor || 'sin doctor'}`, 'cita')
  }, [todasLasCitas, guardarCita, userProfile, registrarEnTimelinePaciente])

  const funcionVerFicha = (target: string | number | Cita | undefined): void => {
    if (!target) return
    const pId = typeof target === 'object' ? ('pacienteId' in target ? target.pacienteId : target.id) : target
    const pac = pacientes.find(p => String(p.id) === String(pId)) ||
      (typeof target === 'object' && 'rut' in target ? (target as unknown as Paciente) : undefined)
    if (pac) (alSeleccionarPaciente || alVerFichaPaciente)?.(pac)
  }

  if (theme === 'surgical') {
    return (
      <div 
        className="animate-in fade-in duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        key="surgical-mode"
      >
        <AgendaQuirurgica 
          citas={citasDelDia} 
          onAbrirFicha={funcionVerFicha} 
        />
      </div>
    )
  }

  if (!loadingDoctores && doctores.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-surface-border rounded-2xl shadow-xs">
        <h2 className="text-xl font-bold text-graphite-900 dark:text-white mb-2">Configura los doctores de tu clínica</h2>
        <p className="text-graphite-600 dark:text-graphite-300 mb-4">Para ver la agenda multi-doctor, primero configura el equipo de tu clínica.</p>
        <Button type="button" onClick={() => window.dispatchEvent(new CustomEvent('navegar_seccion', { detail: 'Administración' }))} variant="primary">Ir a Administración → Equipo</Button>
      </div>
    )
  }

  return (
    <div 
      className="animate-in fade-in duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] space-y-6" 
      role="main" 
      aria-label="Agenda de citas"
      key="normal-mode"
    >
      <PageHeader
        icon={Calendar}
        title="Agenda multi-box y control de sillones"
        description="Gestión inteligente de citas, ocupación de Boxes y confirmación omnicanal."
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {permisos.configurarHorariosDoctor && (
              <Button
                type="button"
                onClick={() => setModalHorariosAbierto(true)}
                variant="secondary"
                size="sm"
                icon={Settings}
              >
                Horarios
              </Button>
            )}
            {permisos.gestionarDiasFestivos && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModalDiasFestivosAbierto(true)}
                icon={Calendar}
              >
                Festivos
              </Button>
            )}
            {permisos.gestionarDoctoresAusentes && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModalDoctorAusenteAbierto(true)}
                icon={UserX}
                title="Marcar doctor como ausente"
              >
                Doctor ausente
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSalaEsperaAbierta(true)}
              icon={Users}
            >
              Sala de Espera
            </Button>
            {permisos.crearBloqueos && (
              <Button
                type="button"
                onClick={() => setModalNuevoBloqueoAbierto(true)}
                variant="secondary"
                size="sm"
                icon={Ban}
              >
                Bloqueo
              </Button>
            )}
            {permisos.crearCitas && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setModalNuevaCitaAbierto(true)
                  window.dispatchEvent(new CustomEvent('nueva_cita_urgencia'))
                }}
                icon={AlertTriangle}
                title="Crear cita urgente (permite sobrecupo)"
              >
                Urgencia
              </Button>
            )}
            {permisos.crearCitas && (
              <Button
                type="button"
                onClick={() => setModalNuevaCitaAbierto(true)}
                variant="primary"
                size="sm"
                icon={Plus}
              >
                Nueva cita
              </Button>
            )}
          </div>
        }
      />

      <AgendaNavigation currentDateIso={fechaSeleccionada} onDateChange={(nuevaFecha) => setFechaSeleccionada(nuevaFecha)} onExportCSV={handleExportarCSV} doctorFiltro={doctorFiltro} setDoctorFiltro={setDoctorFiltro} doctores={doctores} />

      {currentView === 'day' && (
        <>
          <DoctorWaitingRoomBar
            onLlamarSiguiente={(citaId) => {
              const cita = todasLasCitas.find((c) => String(c.id) === String(citaId))
              if (cita) handleLlamarSiguiente(cita)
            }}
          />
          <AgendaDayView
            appointments={citasDelDia}
            doctors={doctores.map((d) => ({ id: d.userId, nombre: d.nombreCompleto, colorIdentidad: d.colorIdentidad }))}
            currentDateIso={fechaSeleccionada}
            selectedDoctor={doctorFiltroEfectivo} selectedBox={boxFiltro}
            onAppointmentClick={(c) => {
              if (c.recurrence_group_id) handleAbrirEdicionSerie(c)
              else funcionVerFicha(c)
            }}
            onSlotClick={() => {
              if (permisos.crearCitas) setModalNuevaCitaAbierto(true)
            }}
            onAppointmentMove={handleAppointmentMove}
            onWhatsAppClick={(c) => handleAbrirConfirmacion(c)}
            onLlamarSiguiente={(c) => handleLlamarSiguiente(c)}
            onAbrirCambiarEstado={(c) => setCitaParaEstado(c)}
            onEstadoChange={handleCambiarEstado}
            onReasignar={(c) => {
              setCitaParaReasignar(c)
              setModalReasignarAbierto(true)
            }}
            onEditar={handleEditarCita}
          />
        </>
      )}

      {currentView === 'week' && (
        <AgendaWeekView
          appointments={todasLasCitas} currentDateIso={fechaSeleccionada}
          onAppointmentClick={(c) => {
            if (c.recurrence_group_id) handleAbrirEdicionSerie(c)
            else funcionVerFicha(c)
          }}
          onDayClick={(iso) => { setFechaSeleccionada(iso); setStoreView('day') }}
          onNewAppointment={(iso) => {
            if (permisos.crearCitas) {
              setFechaSeleccionada(iso)
              setModalNuevaCitaAbierto(true)
            }
          }}
          onAppointmentMove={handleAppointmentMove}
        />
      )}

      {currentView === 'month' && (
        <AgendaMonthView
          appointments={todasLasCitas} currentDateIso={fechaSeleccionada}
          onDayClick={(iso) => { setFechaSeleccionada(iso); setStoreView('day') }}
          onAppointmentMove={handleAppointmentMove}
        />
      )}

      {currentView === 'list' && (
        <AgendaListView
          citas={citasDelDia}
          alVerFichaPaciente={(c) => {
            if (typeof c === 'object' && c && 'recurrence_group_id' in c && c.recurrence_group_id) {
              handleAbrirEdicionSerie(c as Cita)
            } else {
              funcionVerFicha(c)
            }
          }}
          alCambiarEstadoCita={cambiarEstadoCita}
          onEditar={handleEditarCita}
          onCambiarEstado={(c) => setCitaParaEstado(c)}
          onWhatsApp={(c) => handleAbrirConfirmacion(c)}
          onEliminar={handleEliminarCita}
        />
      )}

      {modalNuevaCitaAbierto && (
        <ModalNuevaCita
          pacientes={pacientes}
          fechaPredeterminada={fechaSeleccionada}
          alGuardar={guardarCita}
          alCerrar={() => {
            setModalNuevaCitaAbierto(false)
            setCitaAEditar(null)
          }}
          citasExistentes={citas}
          citaAEditar={citaAEditar}
          onEliminar={handleEliminarCita}
        />
      )}
      {modalNuevoBloqueoAbierto && (
        <ModalNuevoBloqueo fechaPredeterminada={fechaSeleccionada} alGuardar={guardarCita} alCerrar={() => setModalNuevoBloqueoAbierto(false)} citasExistentes={citas} />
      )}
      {modalHorariosAbierto && (
        <ModalConfiguracionHorarios isOpen={modalHorariosAbierto} alCerrar={() => setModalHorariosAbierto(false)} alGuardar={cargarDoctores} />
      )}
      {modalConfirmacionAbierto && (
        <ModalConfirmacionCita
          isOpen={modalConfirmacionAbierto} cita={citaParaConfirmar}
          alCerrar={() => { setModalConfirmacionAbierto(false); setCitaParaConfirmar(null) }}
          alConfirmar={handleConfirmarCita} alCancelar={handleCancelarCita}
        />
      )}
      {modalEdicionSerieAbierto && (
        <ModalEdicionSerie
          isOpen={modalEdicionSerieAbierto} cita={citaParaEditar}
          alCerrar={() => { setModalEdicionSerieAbierto(false); setCitaParaEditar(null) }}
          alEditar={handleEditarSerie} alCancelar={handleCancelarSerie}
        />
      )}
      <ModalDiasFestivos
        isOpen={modalDiasFestivosAbierto}
        alCerrar={() => setModalDiasFestivosAbierto(false)}
      />
      <ModalDoctorAusente
        isOpen={modalDoctorAusenteAbierto}
        doctoresDisponibles={doctores}
        citasActuales={todasLasCitas}
        alCerrar={() => setModalDoctorAusenteAbierto(false)}
        alProcesar={(resultado) => {
          console.log('Ausencia procesada:', resultado)
          agendaStorageService.obtenerCitasDesdeSupabase().then((res) => {
            if (res?.length) useAgendaStore.getState().setCitas(res)
          }).catch(console.error)
        }}
      />
      <SalaEsperaDrawer
        open={salaEsperaAbierta}
        citasHoy={citasDelDia}
        alCerrar={() => setSalaEsperaAbierta(false)}
        alCheckIn={(id) => handleCambiarEstado(id, 'En sala de espera')}
        alLlamar={(id) => {
          const c = todasLasCitas.find((item) => String(item.id) === String(id))
          if (c) handleLlamarSiguiente(c)
        }}
        alIniciar={(id) => handleCambiarEstado(id, 'En atención')}
        alNoShow={(id) => handleCambiarEstado(id, 'No-show')}
      />
      <ModalReasignarCita
        isOpen={modalReasignarAbierto}
        cita={citaParaReasignar}
        doctores={doctores}
        alCerrar={() => {
          setModalReasignarAbierto(false)
          setCitaParaReasignar(null)
        }}
        alReasignar={handleReasignarCita}
      />
      <ModalCambiarEstado
        isOpen={citaParaEstado !== null}
        cita={citaParaEstado}
        alCerrar={() => setCitaParaEstado(null)}
        alCambiar={handleCambiarEstado}
      />
    </div>
  )
})

AgendaModulo.displayName = 'AgendaModulo'
