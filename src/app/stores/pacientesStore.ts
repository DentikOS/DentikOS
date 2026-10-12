import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { pacientesStorageService } from '../../domains/clinical/patient/services/pacientesStorageService'
import type { Paciente } from '../../domains/clinical/patient/schemas/pacienteSchema'
import type { FichaClinica } from '../../domains/clinical/patient/schemas/fichaClinicaSchema'
import { createLogger } from '../../infrastructure/logging/logger'

const log = createLogger('pacientesStore')

const SEED_PACIENTES_DEMO: Paciente[] = [
  { id: 1, nombre: 'Camila Silva Morales', rut: '18.452.123-K', telefono: '+56 9 8765 4321', edad: 28, prevision: 'Isapre', alergias: 'Penicilina', email: 'camila.silva@gmail.com', ocupacion: 'Diseñadora', estado: 'activo' },
  { id: 2, nombre: 'Carlos Mendoza Vera', rut: '15.321.987-4', telefono: '+56 9 1234 5678', edad: 42, prevision: 'Fonasa', alergias: 'Ninguna', email: 'carlos.mendoza@gmail.com', ocupacion: 'Ingeniero', estado: 'activo' }
]

export type PacientesUpdater = Paciente[] | ((prev: Paciente[]) => Paciente[])
export type PestanaFicha =
  | 'datos'
  | 'odontograma'
  | 'periodontograma'
  | 'evoluciones'
  | 'recetas'
  | 'consentimientos'
  | 'plan-tratamiento'
  | 'adjuntos'
  | 'timeline'
  | 'resumen-ejecutivo'
  | 'presupuestos'
  | 'recetas-consentimientos'

export interface FiltrosPacientes {
  estado: string[]
  doctor: string[]
  ultimaVisita: string
  proximaCita: string
  etiquetas: string[]
}

export interface PacientesStore {
  pacientes: Paciente[]
  pacienteActivo: Paciente | null
  vistaActual: 'lista' | 'tabla' | 'tarjetas'
  filtros: FiltrosPacientes
  seleccion: (string | number)[]
  fichaActiva: FichaClinica | null
  pestanaActiva: PestanaFicha

  setPacientes: (updater: PacientesUpdater) => void
  setPacienteActivo: (paciente: Paciente | null) => void
  setVista: (vista: 'lista' | 'tabla' | 'tarjetas') => void
  setFiltros: (filtros: Partial<FiltrosPacientes>) => void
  toggleSeleccion: (id: string | number) => void
  seleccionarTodos: () => void
  limpiarSeleccion: () => void

  abrirFicha: (pacienteId: string | number, pestanaInicial?: PestanaFicha) => void
  cerrarFicha: () => void
  setPestanaActiva: (pestana: PestanaFicha) => void
  bloquearPaciente: (id: string | number) => void
  desbloquearPaciente: (id: string | number) => void
  actualizarPaciente: (id: string | number, updates: Partial<Paciente>) => void
  refrescarDesdeSupabase: () => Promise<void>
  isLoadingPacientes: boolean
  cargarPacientes: () => Promise<void>
}

export const usePacientesStore = create<PacientesStore>()(
  persist(
    (set, get) => ({
      pacientes: pacientesStorageService.obtenerPacientes(SEED_PACIENTES_DEMO),
      pacienteActivo: null,
      vistaActual: 'lista',
      filtros: { estado: [], doctor: [], ultimaVisita: '', proximaCita: '', etiquetas: [] },
      seleccion: [],
      fichaActiva: null,
      pestanaActiva: 'datos',
      isLoadingPacientes: false,

      setPacientes: (updater: PacientesUpdater) => set((state) => {
        const next = typeof updater === 'function' ? updater(state.pacientes) : updater
        pacientesStorageService.guardarPacientes(next)
        return { pacientes: next }
      }),

      setPacienteActivo: (paciente: Paciente | null, pestanaInicial?: PestanaFicha) => {
        if (paciente) {
          get().abrirFicha(paciente.id, pestanaInicial)
        } else {
          get().cerrarFicha()
        }
      },

      setVista: (vista) => set({ vistaActual: vista }),

      setFiltros: (filtrosParciales) => set((state) => ({
        filtros: { ...state.filtros, ...filtrosParciales }
      })),

      toggleSeleccion: (id) => set((state) => ({
        seleccion: state.seleccion.includes(id)
          ? state.seleccion.filter((item) => item !== id)
          : [...state.seleccion, id]
      })),

      seleccionarTodos: () => set((state) => ({
        seleccion: state.pacientes.map((p) => p.id)
      })),

      limpiarSeleccion: () => set({ seleccion: [] }),

      abrirFicha: (pacienteId, pestanaInicial = 'datos') => {
        const paciente = get().pacientes.find((p) => String(p.id) === String(pacienteId))
        if (paciente) {
          const ficha: FichaClinica = {
            id: `ficha-${paciente.id}`,
            pacienteId: paciente.id,
            odontograma: [],
            periodontograma: [],
            evoluciones: [],
            recetas: [],
            consentimientos: [],
            timeline: [],
            version: 1
          }
          set({ fichaActiva: ficha, pacienteActivo: paciente, pestanaActiva: pestanaInicial })
        }
      },

      cerrarFicha: () => set({ fichaActiva: null, pacienteActivo: null }),

      setPestanaActiva: (pestana) => set({ pestanaActiva: pestana }),

      bloquearPaciente: (id) => {
        get().setPacientes((prev) =>
          prev.map((p) => (String(p.id) === String(id) ? { ...p, estado: 'bloqueado' } : p))
        )
      },

      desbloquearPaciente: (id) => {
        get().setPacientes((prev) =>
          prev.map((p) => (String(p.id) === String(id) ? { ...p, estado: 'activo' } : p))
        )
      },

      actualizarPaciente: (id, updates) => {
        set((state) => {
          const nuevos = state.pacientes.map((p) =>
            String(p.id) === String(id) ? { ...p, ...updates } : p
          )
          const activo = state.pacienteActivo && String(state.pacienteActivo.id) === String(id)
            ? { ...state.pacienteActivo, ...updates }
            : state.pacienteActivo
          pacientesStorageService.guardarPacientes(nuevos)
          return { pacientes: nuevos, pacienteActivo: activo }
        })
      },

      refrescarDesdeSupabase: async (): Promise<void> => {
        try {
          if (typeof pacientesStorageService.procesarColaPacientes === 'function') {
            await pacientesStorageService.procesarColaPacientes().catch((e: unknown) => log.warn('Error procesando cola:', e))
          }
          const datos = await pacientesStorageService.sincronizarDesdeSupabase()
          if (Array.isArray(datos)) set({ pacientes: datos })
        } catch (e: unknown) {
          log.error('Error refrescarDesdeSupabase:', e)
        }
      },

      cargarPacientes: async (): Promise<void> => {
        set({ isLoadingPacientes: true })
        try {
          const locales = pacientesStorageService.obtenerPacientes()
          if (locales && locales.length > 0) {
            set({ pacientes: locales })
          }
          if (typeof pacientesStorageService.sincronizarDesdeSupabase === 'function') {
            const datos = await pacientesStorageService.sincronizarDesdeSupabase()
            if (Array.isArray(datos) && datos.length > 0) {
              set({ pacientes: datos })
            }
          }
        } catch (error) {
          log.error('Error cargando pacientes:', error)
        } finally {
          set({ isLoadingPacientes: false })
        }
      }
    }),
    {
      name: 'dentikos_pacientes_store_v2',
      partialize: (state) => ({
        vistaActual: state.vistaActual,
        filtros: state.filtros
      })
    }
  )
)
