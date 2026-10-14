import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useSidebarStore } from '../../app/stores/useSidebarStore'
import { useTopBarStore } from '../../app/stores/useTopBarStore'

describe('useKeyboardShortcuts (Blueprint 02 §07)', () => {
  beforeEach(() => {
    useSidebarStore.setState({ focusMode: false })
    useTopBarStore.setState({ searchOpen: false })
    document.body.innerHTML = ''
  })

  it('alterna Modo Foco con Meta+Shift+KeyF y Meta+Shift+F', () => {
    renderHook(() => useKeyboardShortcuts())

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyF',
        key: 'F',
        metaKey: true,
        shiftKey: true,
      })
    )
    expect(useSidebarStore.getState().focusMode).toBe(true)

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyF',
        key: 'F',
        metaKey: true,
        shiftKey: true,
      })
    )
    expect(useSidebarStore.getState().focusMode).toBe(false)
  })

  it('abre y cierra Command Palette con Meta+K', () => {
    renderHook(() => useKeyboardShortcuts())

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyK',
        key: 'k',
        metaKey: true,
      })
    )
    expect(useTopBarStore.getState().searchOpen).toBe(true)
  })

  it('dispara open-shortcuts-modal y close-shortcuts-modal como toggle al pulsar ?', () => {
    renderHook(() => useKeyboardShortcuts())
    const openListener = vi.fn()
    const closeListener = vi.fn()
    window.addEventListener('open-shortcuts-modal', openListener)
    window.addEventListener('close-shortcuts-modal', closeListener)

    // Primero abre
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '?',
      })
    )
    expect(openListener).toHaveBeenCalledTimes(1)

    // Simular que el modal está abierto en el DOM
    const modalEl = document.createElement('div')
    modalEl.setAttribute('data-shortcuts-modal', 'true')
    document.body.appendChild(modalEl)

    // Pulsar de nuevo -> cierra
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '?',
      })
    )
    expect(closeListener).toHaveBeenCalledTimes(1)

    window.removeEventListener('open-shortcuts-modal', openListener)
    window.removeEventListener('close-shortcuts-modal', closeListener)
  })

  it('ignora ? cuando el foco está en un input', () => {
    renderHook(() => useKeyboardShortcuts())
    const openListener = vi.fn()
    window.addEventListener('open-shortcuts-modal', openListener)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '?',
        bubbles: true,
      })
    )

    expect(openListener).not.toHaveBeenCalled()
    window.removeEventListener('open-shortcuts-modal', openListener)
  })

  it('alterna Modo Presentación con Meta+Shift+KeyM', () => {
    useTopBarStore.setState({ presentationMode: false })
    renderHook(() => useKeyboardShortcuts())

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyM',
        key: 'M',
        metaKey: true,
        shiftKey: true,
      })
    )
    expect(useTopBarStore.getState().presentationMode).toBe(true)
  })

  it('cicla tema con Meta+Shift+KeyD', () => {
    useSidebarStore.setState({ theme: 'light' })
    renderHook(() => useKeyboardShortcuts())

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyD',
        key: 'D',
        metaKey: true,
        shiftKey: true,
      })
    )
    expect(useSidebarStore.getState().theme).toBe('surgical')
  })

  it('sale de Modo Foco al pulsar Escape', () => {
    useSidebarStore.setState({ focusMode: true })
    renderHook(() => useKeyboardShortcuts())

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
      })
    )

    expect(useSidebarStore.getState().focusMode).toBe(false)
  })

  it('navega a Dashboard, Agenda y Pacientes con ⌘1, ⌘2, ⌘3', () => {
    renderHook(() => useKeyboardShortcuts())
    const navListener = vi.fn()
    window.addEventListener('navegar_seccion', navListener)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', metaKey: true }))
    expect(navListener).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Dashboard' }))

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', metaKey: true }))
    expect(navListener).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Agenda' }))

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3', metaKey: true }))
    expect(navListener).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Pacientes' }))

    window.removeEventListener('navegar_seccion', navListener)
  })

  it('dispara nueva_cita con ⌘N cuando está en Agenda', () => {
    localStorage.setItem('clinica_active_section', 'Agenda')
    renderHook(() => useKeyboardShortcuts())
    const listener = vi.fn()
    window.addEventListener('nueva_cita', listener)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', metaKey: true }))
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener('nueva_cita', listener)
  })

  it('dispara abrir_nuevo_paciente con ⌘P cuando está en Pacientes', () => {
    localStorage.setItem('clinica_active_section', 'Pacientes')
    renderHook(() => useKeyboardShortcuts())
    const listener = vi.fn()
    window.addEventListener('abrir_nuevo_paciente', listener)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', metaKey: true }))
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener('abrir_nuevo_paciente', listener)
  })

  it('dispara guardar_cambios con ⌘S', () => {
    renderHook(() => useKeyboardShortcuts())
    const listener = vi.fn()
    window.addEventListener('guardar_cambios', listener)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', metaKey: true }))
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener('guardar_cambios', listener)
  })
})
