/**
 * useDarkMode — Wrapper reactivo sobre useThemeStore (DentikOS)
 *
 * Expone el tema claro/oscuro usando el store compartido.
 * Estado unificado y compartido en toda la aplicación vía useThemeStore.
 */
import { useCallback } from 'react'
import { useThemeStore, type Theme } from '../../app/stores/useThemeStore'

export type { Theme }

export interface UseDarkModeReturn {
  theme: Theme
  setTheme: (nuevoTema: Theme) => void
  darkMode: boolean
  toggleDarkMode: () => void
  cycleTheme: () => void
}

export const useDarkMode = (): UseDarkModeReturn => {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const cycleTheme = useThemeStore((s) => s.cycleTheme)

  const toggleDarkMode = useCallback((): void => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return {
    theme,
    setTheme,
    darkMode: theme === 'dark',
    toggleDarkMode,
    cycleTheme,
  }
}
