import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Cita } from '../../domains/operations/agenda/schemas/citaSchema'
import { obtenerFechaLocalISO } from '../../shared/utils/dateUtils'

export type AgendaViewType = 'day' | 'week' | 'month' | 'list' | 'waiting_room'

export interface BloqueoAgendaItem {
  id: string | number
  fecha: string
  horaInicio: string
  horaFin: string
  motivoBloqueo: string
  boxAsignado?: string
  doctor?: string
}

export interface PacienteEsperaItem {
  id: string | number
  citaId: string | number
  pacienteNombre: string
  horaLlegada: string
  boxAsignado?: string
  doctor?: string
  notificadoRecepcion?: boolean
  enAtencion?: boolean
}

export interface AgendaState {
  currentView: AgendaViewType
  currentDateIso: string
  selectedDoctor: string
  selectedBox: string
  citas: Cita[]
  espera: PacienteEsperaItem[]
  bloqueos: BloqueoAgendaItem[]
  
  setView: (view: AgendaViewType) => void
  setDateIso: (dateIso: string) => void
  setDoctor: (doctor: string) => void
  setBox: (box: string) => void
  setCitas: (citas: Cita[]) => void
  updateCita: (id: string | number, updates: Partial<Cita>) => void
  addCita: (cita: Cita) => void
  removeCita: (id: string | number) => void
  addBloqueo: (bloqueo: BloqueoAgendaItem) => void
  setEspera: (espera: PacienteEsperaItem[]) => void
  actualizarEstadoEspera: (citaId: string | number, updates: Partial<PacienteEsperaItem>) => void
}

export const useAgendaStore = create<AgendaState>()(
  persist(
    (set) => ({
      currentView: 'day',
      currentDateIso: obtenerFechaLocalISO(),
      selectedDoctor: 'Todos',
      selectedBox: 'Todos',
      citas: [],
      espera: [],
      bloqueos: [],

      setView: (currentView) => set({ currentView }),
      setDateIso: (currentDateIso) => set({ currentDateIso }),
      setDoctor: (selectedDoctor) => set({ selectedDoctor }),
      setBox: (selectedBox) => set({ selectedBox }),
      setCitas: (citas) => set({ citas }),

      updateCita: (id, updates) =>
        set((state) => ({
          citas: state.citas.map((c) => (String(c.id) === String(id) ? { ...c, ...updates } : c))
        })),

      addCita: (cita) =>
        set((state) => ({
          citas: [...state.citas, cita]
        })),

      removeCita: (id) =>
        set((state) => ({
          citas: state.citas.filter((c) => String(c.id) !== String(id))
        })),

      addBloqueo: (bloqueo) =>
        set((state) => ({
          bloqueos: [...state.bloqueos, bloqueo]
        })),

      setEspera: (espera) => set({ espera }),

      actualizarEstadoEspera: (citaId, updates) =>
        set((state) => ({
          espera: state.espera.map((item) =>
            String(item.citaId) === String(citaId) ? { ...item, ...updates } : item
          )
        }))
    }),
    {
      name: 'dentikos_agenda_state_v1',
      partialize: (state) => ({
        currentView: state.currentView,
        selectedDoctor: state.selectedDoctor,
        selectedBox: state.selectedBox
      })
    }
  )
)
