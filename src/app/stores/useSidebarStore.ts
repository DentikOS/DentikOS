import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SidebarMode = 'expanded' | 'collapsed' | 'hidden'
export type AppTheme = 'light' | 'surgical' | 'dark'
export type ConnectivityStatus = 'connected' | 'pending' | 'error'

export interface SidebarState {
  // Estado de navegación
  mode: SidebarMode
  activeModule: string
  sedeActiva: string | null

  // Tema
  theme: AppTheme

  // Badges en tiempo real (Supabase Realtime)
  badges: Record<string, number>

  // Estado del sistema
  connectivityStatus: ConnectivityStatus
  lastSyncAt: number | null
  activeDevices: number

  // Compatibilidad hacia atrás (UI existente)
  preSurgicalMode: SidebarMode | null
  focusMode: boolean
  mobileOpen: boolean

  // Acciones
  setMode: (mode: SidebarMode) => void
  toggleCollapsed: () => void
  toggleMode: () => void
  setActiveModule: (module: string) => void
  setTheme: (theme: AppTheme) => void
  setActiveSede: (sedeId: string | null) => void
  updateBadge: (module: string, count: number) => void
  clearBadge: (module: string) => void
  setConnectivityStatus: (status: ConnectivityStatus) => void
  setLastSyncAt: (timestamp: number) => void
  setActiveDevices: (count: number) => void

  // Acciones de compatibilidad hacia atrás
  setPreSurgicalMode: (mode: SidebarMode | null) => void
  setFocusMode: (focus: boolean) => void
  toggleFocusMode: () => void
  setMobileOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      // Estado inicial
      mode: 'expanded',
      activeModule: 'Dashboard',
      sedeActiva: null,
      theme: 'light',
      badges: {},
      connectivityStatus: 'connected',
      lastSyncAt: null,
      activeDevices: 1,

      // Compatibilidad
      preSurgicalMode: null,
      focusMode: false,
      mobileOpen: false,

      // Acciones
      setMode: (mode) => set({ mode }),

      toggleCollapsed: () =>
        set((state) => ({
          mode: state.mode === 'expanded' ? 'collapsed' : 'expanded',
        })),

      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'expanded' ? 'collapsed' : 'expanded',
        })),

      setActiveModule: (module) => set({ activeModule: module }),

      setTheme: (theme) => set({ theme }),

      setActiveSede: (sedeId) => set({ sedeActiva: sedeId }),

      updateBadge: (module, count) =>
        set((state) => ({
          badges: { ...state.badges, [module]: count },
        })),

      clearBadge: (module) =>
        set((state) => {
          const { [module]: _, ...rest } = state.badges
          return { badges: rest }
        }),

      setConnectivityStatus: (status) => set({ connectivityStatus: status }),

      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

      setActiveDevices: (count) => set({ activeDevices: count }),

      // Compatibilidad
      setPreSurgicalMode: (preSurgicalMode) => set({ preSurgicalMode }),

      setFocusMode: (focusMode) => set({ focusMode }),

      toggleFocusMode: () =>
        set((state) => ({ focusMode: !state.focusMode })),

      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
    }),
    {
      name: 'sd_sidebar_state', // Se actualizará con UUID en el hook de inicialización
      partialize: (state) => ({
        mode: state.mode,
        theme: state.theme,
        activeModule: state.activeModule,
      }),
    }
  )
)

/**
 * INTEGRACIÓN SUPABASE REALTIME (Fase 4)
 * 
 * Los badges se sincronizarán vía Supabase Realtime subscribiendo a:
 * - Tabla: notificaciones_modulo
 * - Filtro: clinic_id = currentClinicId
 * 
 * El hook useSidebarCounters (ya existe en src/shared/hooks/useSidebarCounters.ts)
 * será responsable de subscribirse y llamar a updateBadge() cuando lleguen cambios.
 */
