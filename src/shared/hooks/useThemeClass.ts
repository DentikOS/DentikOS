import { useEffect } from 'react'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

/**
 * Hook que aplica la clase de tema (light/surgical/dark) al document.documentElement
 * para que los tokens CSS globales funcionen correctamente (Blueprint 02 §04).
 */
export const useThemeClass = (): void => {
  const theme = useSidebarStore((s) => s.theme)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    // Remover todas las clases de tema
    root.classList.remove('light', 'surgical', 'theme-surgical', 'dark')

    // Agregar la clase correspondiente
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'surgical') {
      root.classList.add('surgical', 'theme-surgical')
    } else {
      root.classList.add('light')
    }
  }, [theme])
}
