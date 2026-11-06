import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDarkMode } from './useDarkMode'
import { useThemeStore } from '../../app/stores/useThemeStore'

describe('useDarkMode con tema claro/oscuro y Store Compartido', () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({ theme: 'light' })
    document.documentElement.className = ''
  })

  it('inicia en modo light por defecto cuando no hay persistencia', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.theme).toBe('light')
    expect(result.current.darkMode).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('permite alternar a modo oscuro con toggleDarkMode', () => {
    const { result } = renderHook(() => useDarkMode())
    act(() => {
      result.current.toggleDarkMode()
    })
    expect(result.current.theme).toBe('dark')
    expect(result.current.darkMode).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('permite ciclar entre light y dark', () => {
    const { result } = renderHook(() => useDarkMode())

    // light -> dark
    act(() => {
      result.current.cycleTheme()
    })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // dark -> light
    act(() => {
      result.current.cycleTheme()
    })
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('sincroniza el estado del tema reactivamente entre diferentes instancias', () => {
    const { result: hookA } = renderHook(() => useDarkMode())
    const { result: hookB } = renderHook(() => useDarkMode())

    expect(hookA.current.theme).toBe('light')
    expect(hookB.current.theme).toBe('light')

    act(() => {
      hookA.current.setTheme('dark')
    })

    expect(hookA.current.theme).toBe('dark')
    expect(hookB.current.theme).toBe('dark')
  })
})
