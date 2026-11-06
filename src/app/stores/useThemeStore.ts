import { create } from 'zustand'
import { useSidebarStore } from './useSidebarStore'

export type Theme = 'light' | 'dark'

export interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  cycleTheme: () => void
}

export const aplicarClasesDocumento = (theme: Theme): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.add('light')
  }
}

/**
 * useThemeStore — Wrapper legacy que delega a useSidebarStore
 * 
 * La fuente única de verdad es useSidebarStore.theme.
 * Este store existe SOLO para compatibilidad con código legacy
 * que importa useThemeStore directamente.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  theme: useSidebarStore.getState().theme,

  setTheme: (theme: Theme) => {
    useSidebarStore.getState().setTheme(theme)
    set({ theme })
  },

  toggleTheme: () => {
    const current = useSidebarStore.getState().theme
    const next: Theme = current === 'dark' ? 'light' : 'dark'
    useSidebarStore.getState().setTheme(next)
    set({ theme: next })
  },

  cycleTheme: () => {
    const themes: Theme[] = ['light', 'dark']
    const current = useSidebarStore.getState().theme
    const next = themes[(themes.indexOf(current) + 1) % themes.length]
    useSidebarStore.getState().setTheme(next)
    set({ theme: next })
  },
}))

// Sincronización bidireccional y actualización de clases para compatibilidad
useSidebarStore.subscribe((state) => {
  aplicarClasesDocumento(state.theme as Theme)
  if (useThemeStore.getState().theme !== state.theme) {
    useThemeStore.setState({ theme: state.theme })
  }
})

useThemeStore.subscribe((state) => {
  aplicarClasesDocumento(state.theme)
  if (useSidebarStore.getState().theme !== state.theme) {
    useSidebarStore.getState().setTheme(state.theme)
  }
})
