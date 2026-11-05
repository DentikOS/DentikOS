import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import { agendaStorageService } from '../services/agendaStorageService'
import { generarCitasRecurrencia } from '../../../../shared/utils/recurrenciaUtils'
import { pacientesStorageService } from '../../../../domains/clinical/patient/services/pacientesStorageService'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useWhatsAppConfirmacion, type CitaWhatsAppRef } from './useWhatsAppConfirmacion'
import type { Cita } from '../schemas/citaSchema'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface UseAgendaReturn {
  citas: Cita[]
  pacientes: Paciente[]
  vista: string
  setVista: (vista: string) => void
  fechaSeleccionada: string
  setFechaSeleccionada: (fecha: string) => void
  boxFiltro: string
  setBoxFiltro: (box: string) => void
  doctorFiltro: string
  setDoctorFiltro: (doc: string) => void
  irAHoy: () => void
  modalNuevaCitaAbierto: boolean
  setModalNuevaCitaAbierto: React.Dispatch<React.SetStateAction<boolean>>
  modalNuevoBloqueoAbierto: boolean
  setModalNuevoBloqueoAbierto: React.Dispatch<React.SetStateAction<boolean>>
  guardarCita: (nuevaCita: Cita | (CitaWhatsAppRef & { id: string | number; fecha: string; horaInicio: string; estado: string }), crearFichaSiExpress?: boolean) => void
  eliminarCita: (citaId: string | number) => void
  cambiarEstadoCita: (citaId: string | number, nuevoEstado: string) => void
  enviarWhatsAppConfirmacion: (cita: Cita | CitaWhatsAppRef) => Promise<void>
}

export const useAgenda = (pacientesProp: Paciente[] | null = null): UseAgendaReturn => {
  const clinicaId = useSesionStore((state) => state.clinicaActual || state.userProfile?.clinicaId || null)
    || getClinicaActivaSync()
  const [citas, setCitas] = useState<Cita[]>([])
  const citasRef = useRef<Cita[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>(pacientesProp || [])
  const [vista, setVista] = useState<string>('box')
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    obtenerFechaLocalISO()
  )
  const [boxFiltro, setBoxFiltro] = useState<string>('Todos')
  const [doctorFiltro, setDoctorFiltro] = useState<string>('Todos')
  const [modalNuevaCitaAbierto, setModalNuevaCitaAbierto] = useState<boolean>(false)
  const [modalNuevoBloqueoAbierto, setModalNuevoBloqueoAbierto] = useState<boolean>(false)

  const sincronizar = useCallback((nuevas: Cita[]): void => {
    citasRef.current = nuevas
    setCitas(nuevas)
    queueMicrotask(() => {
      useAgendaStore.getState().setCitas(nuevas)
    })
  }, [])

  // Cargar citas y pacientes de forma reactiva
  const pacientesPropRef = useRef(pacientesProp)
  useEffect(() => {
    pacientesPropRef.current = pacientesProp
    if (pacientesProp && pacientesProp.length > 0) {
      setPacientes(pacientesProp)
    }
  }, [pacientesProp])

  const cargarDatos = useCallback((): void => {
    const citasGuardadas = agendaStorageService?.obtenerCitas ? agendaStorageService.obtenerCitas() : []
    
    // Si App.jsx envió la lista por props, se priorizan las props
    const pProp = pacientesPropRef.current
    const pacientesGuardados = (pProp && pProp.length > 0) ? pProp : pacientesStorageService.obtenerPacientes()

    citasRef.current = citasGuardadas || []
    sincronizar(citasGuardadas || [])
    setPacientes(pacientesGuardados || [])
  }, [sincronizar])

  useEffect(() => {
    let montado = true
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    cargarDatos()
    window.addEventListener('storage', cargarDatos)
    const actualizarAgenda = async (): Promise<void> => {
      const citasActualizadas = await agendaStorageService.obtenerCitasDesdeSupabase()
      if (!montado) return
      // El servicio devuelve [] ante errores de red. No reemplazar una agenda
      // visible si no llegó ninguna fila desde la nube.
      if (citasActualizadas.length > 0 || citasRef.current.length === 0) sincronizar(citasActualizadas)
    }
    const programarActualizacionAgenda = (): void => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        void actualizarAgenda()
      }, 150)
    }
    const refrescarCitasAsignadas = (event: Event): void => {
      const clinicaEvento = (event as CustomEvent<{ clinicaId?: string }>).detail?.clinicaId
      if (clinicaEvento && clinicaEvento !== getClinicaActivaSync()) return
      programarActualizacionAgenda()
    }
    window.addEventListener('agenda_citas_necesitan_sync', refrescarCitasAsignadas)
    const canal = USE_SUPABASE && supabase && clinicaId
      ? supabase.channel(`agenda-citas-${clinicaId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'citas',
          filter: `clinica_id=eq.${clinicaId}`,
        }, () => {
          if (clinicaId === getClinicaActivaSync()) programarActualizacionAgenda()
        })
        .subscribe()
      : null
    return () => {
      montado = false
      window.removeEventListener('storage', cargarDatos)
      window.removeEventListener('agenda_citas_necesitan_sync', refrescarCitasAsignadas)
      if (refreshTimer) clearTimeout(refreshTimer)
      if (canal) void supabase?.removeChannel(canal)
    }
  }, [cargarDatos, clinicaId, sincronizar])

  const irAHoy = useCallback((): void => {
    setFechaSeleccionada(obtenerFechaLocalISO())
  }, [])

  // Guardar cita + auto-creación de ficha clínica si es registro Express
  const guardarCita = useCallback((nuevaCita: Cita | (CitaWhatsAppRef & { id: string | number; fecha: string; horaInicio: string; estado: string }), crearFichaSiExpress: boolean = false): void => {
    let pacienteFinalId = nuevaCita.pacienteId

    if (crearFichaSiExpress && (!nuevaCita.pacienteId || String(nuevaCita.pacienteId).startsWith('express_'))) {
      const nuevoPacienteObj: Paciente = {
        id: Date.now(),
        nombre: (nuevaCita.pacienteNombre as string) || 'Paciente Express',
        telefono: String(nuevaCita.pacienteTelefono || ''),
        rut: String(nuevaCita.pacienteRut || ''),
        email: '',
        prevision: 'Particular',
        alergias: '',
        motivoConsulta: (nuevaCita.trataMiento as string) || 'Agendado desde Agenda Multi-Box',
        fechaIngreso: obtenerFechaLocalISO()
      } as unknown as Paciente

      // (F2-02b) — pasar por el store global
      const pacientesActualesGlobal = (usePacientesStore.getState() as { pacientes: Paciente[] }).pacientes
      const pacientesActualizados = [nuevoPacienteObj, ...pacientesActualesGlobal]

      ;(usePacientesStore.getState() as { setPacientes: (p: Paciente[]) => void }).setPacientes(pacientesActualizados)
      setPacientes(pacientesActualizados)

      pacienteFinalId = nuevoPacienteObj.id
    }

    const citaAjustada = { ...nuevaCita, pacienteId: pacienteFinalId } as Cita

    const prev = citasRef.current
    const idStr = String(citaAjustada.id)
    const existeIdx = prev.findIndex((c) => String(c.id) === idStr)
    let actualizadas: Cita[]
    if (existeIdx !== -1) {
      actualizadas = [...prev]
      actualizadas[existeIdx] = citaAjustada
    } else {
      const citasRecurrencia =
        citaAjustada.recurrencia && citaAjustada.recurrencia !== 'ninguna'
          ? (generarCitasRecurrencia(citaAjustada, 10) as unknown as Cita[])
          : []
      actualizadas = [citaAjustada, ...prev, ...citasRecurrencia]
    }

    citasRef.current = actualizadas
    setCitas(actualizadas)

    queueMicrotask(() => {
      useAgendaStore.getState().setCitas(actualizadas)
      if (agendaStorageService?.guardarCitas) {
        void agendaStorageService.guardarCitas(actualizadas).then(() => {
          const desdeCache = agendaStorageService.obtenerCitas()
          if (desdeCache && desdeCache.length > 0) {
            citasRef.current = desdeCache
            setCitas(desdeCache)
            useAgendaStore.getState().setCitas(desdeCache)
          }
        })
      }
    })

    setModalNuevaCitaAbierto(false)
    setModalNuevoBloqueoAbierto(false)
  }, [])

  const eliminarCita = useCallback((citaId: string | number): void => {
    const prev = citasRef.current
    const actualizadas = prev.filter((c) => String(c.id) !== String(citaId))
    citasRef.current = actualizadas
    setCitas(actualizadas)

    queueMicrotask(() => {
      useAgendaStore.getState().setCitas(actualizadas)
      if (agendaStorageService?.eliminarCita) {
        agendaStorageService.eliminarCita(citaId)
      } else if (agendaStorageService?.guardarCitas) {
        agendaStorageService.guardarCitas(actualizadas)
      }
    })
  }, [])

  const cambiarEstadoCita = useCallback((citaId: string | number, nuevoEstado: string): void => {
    const prev = citasRef.current
    const actualizadas = prev.map((c) => {
      if (String(c.id) === String(citaId)) {
        return {
          ...c,
          estado: nuevoEstado,
          horaInicioAtencion: nuevoEstado === 'En Sillón' ? new Date().toISOString() : c.horaInicioAtencion
        }
      }
      return c
    })
    citasRef.current = actualizadas
    setCitas(actualizadas)

    queueMicrotask(() => {
      useAgendaStore.getState().setCitas(actualizadas)
      if (agendaStorageService?.guardarCitas) {
        agendaStorageService.guardarCitas(actualizadas)
      }
    })
  }, [])

  const { enviarWhatsAppConfirmacion } = useWhatsAppConfirmacion({
    pacientes,
    alCambiarEstado: cambiarEstadoCita,
  })

  return {
    citas,
    pacientes,
    vista,
    setVista,
    fechaSeleccionada,
    setFechaSeleccionada,
    boxFiltro,
    setBoxFiltro,
    doctorFiltro,
    setDoctorFiltro,
    irAHoy,
    modalNuevaCitaAbierto,
    setModalNuevaCitaAbierto,
    modalNuevoBloqueoAbierto,
    setModalNuevoBloqueoAbierto,
    guardarCita,
    eliminarCita,
    cambiarEstadoCita,
    enviarWhatsAppConfirmacion
  }
}
