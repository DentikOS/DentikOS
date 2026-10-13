/**
 * useKeyboardShortcuts — Hook único y global para atajos de teclado (Blueprint 02 §07)
 */
import { useEffect } from 'react'
import { useTopBarStore } from '../../app/stores/useTopBarStore'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

export const useKeyboardShortcuts = (): void => {
  const toggleSearch = useTopBarStore((s) => s.toggleSearch)
  const focusMode = useSidebarStore((s) => s.focusMode)
  const setFocusMode = useSidebarStore((s) => s.setFocusMode)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        (typeof document !== 'undefined' &&
          (document.activeElement instanceof HTMLInputElement ||
            document.activeElement instanceof HTMLTextAreaElement ||
            document.activeElement?.getAttribute('contenteditable') === 'true'))

      const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
      const modKey = isMac ? e.metaKey : (e.ctrlKey || e.metaKey)

      // Esc -> Cerrar modales o salir de Modo Foco (prioridad máxima)
      if (e.key === 'Escape') {
        const currentFocusMode = useSidebarStore.getState().focusMode
        if (currentFocusMode) {
          e.preventDefault()
          setFocusMode(false)
          return
        }

        const searchOpen = useTopBarStore.getState().searchOpen
        if (searchOpen) {
          e.preventDefault()
          toggleSearch()
          return
        }

        const shortcutsModal = document.querySelector('[data-shortcuts-modal="true"]')
        if (shortcutsModal) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('close-shortcuts-modal'))
          return
        }
        return
      }

      // ⌘K / Ctrl+K -> Command Palette (funciona siempre, incluso en inputs)
      const isKeyK = e.code === 'KeyK' || e.key === 'k' || e.key === 'K'
      if (modKey && isKeyK) {
        e.preventDefault()
        toggleSearch()
        return
      }

      // ⌘⇧F / Ctrl+Shift+F -> Toggle Modo Foco (usar e.code y e.key)
      const isKeyF = e.code === 'KeyF' || e.key === 'f' || e.key === 'F'
      if (modKey && e.shiftKey && isKeyF) {
        e.preventDefault()
        setFocusMode(!useSidebarStore.getState().focusMode)
        return
      }

      // ⌘⇧M / Ctrl+Shift+M -> Modo Presentación
      const isKeyM = e.code === 'KeyM' || e.key === 'm' || e.key === 'M'
      if (modKey && e.shiftKey && isKeyM) {
        e.preventDefault()
        const current = useTopBarStore.getState().presentationMode
        useTopBarStore.getState().setPresentationMode(!current)
        return
      }

      // ⌘⇧D / Ctrl+Shift+D -> Ciclar tema (para compatibilidad legacy)
      const isKeyD = e.code === 'KeyD' || e.key === 'd' || e.key === 'D'
      if (modKey && e.shiftKey && isKeyD) {
        e.preventDefault()
        const themes: ('light' | 'surgical' | 'dark')[] = ['light', 'surgical', 'dark']
        const current = useSidebarStore.getState().theme
        const nextIndex = (themes.indexOf(current) + 1) % themes.length
        useSidebarStore.getState().setTheme(themes[nextIndex])
        return
      }

      // ⌘1, ⌘2, ⌘3 → Navegación directa a módulos (solo fuera de inputs)
      if (modKey && !isInput) {
        const navMap: Record<string, string> = { Digit1: 'Dashboard', '1': 'Dashboard', Digit2: 'Agenda', '2': 'Agenda', Digit3: 'Pacientes', '3': 'Pacientes' }
        const targetSection = navMap[e.code] || navMap[e.key]
        if (targetSection) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('navegar_seccion', { detail: targetSection }))
          return
        }
      }

      // ⌘N → Nueva cita (solo en Agenda, fuera de inputs)
      if (modKey && (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') && !isInput) {
        e.preventDefault()
        const currentSection = localStorage.getItem('clinica_active_section') || 'Dashboard'
        if (currentSection === 'Agenda') {
          window.dispatchEvent(new CustomEvent('nueva_cita'))
        }
        return
      }

      // ⌘P → Nuevo paciente (solo en Pacientes, fuera de inputs)
      if (modKey && (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') && !isInput) {
        e.preventDefault()
        const currentSection = localStorage.getItem('clinica_active_section') || 'Dashboard'
        if (currentSection === 'Pacientes') {
          window.dispatchEvent(new CustomEvent('abrir_nuevo_paciente'))
        }
        return
      }

      // ⌘S → Guardar cambios (dispara evento global)
      if (modKey && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('guardar_cambios'))
        return
      }

      // ? -> Panel de Atajos como toggle (solo fuera de inputs)
      if (e.key === '?' && !isInput) {
        e.preventDefault()
        const isOpen = document.querySelector('[data-shortcuts-modal="true"]')
        if (isOpen) {
          window.dispatchEvent(new CustomEvent('close-shortcuts-modal'))
        } else {
          window.dispatchEvent(new CustomEvent('open-shortcuts-modal'))
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [focusMode, setFocusMode, toggleSearch])
}
