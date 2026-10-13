import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useThemeClass } from './useThemeClass'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

describe('useThemeClass', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    useSidebarStore.setState({ theme: 'light' })
  })

  it('aplica clase light por defecto', () => {
    renderHook(() => useThemeClass())
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('aplica clase dark al cambiar a modo oscuro', () => {
    renderHook(() => useThemeClass())
    act(() => {
      useSidebarStore.getState().setTheme('dark')
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('aplica clases surgical y theme-surgical al cambiar a quirúrgico', () => {
    renderHook(() => useThemeClass())
    act(() => {
      useSidebarStore.getState().setTheme('surgical')
    })
    expect(document.documentElement.classList.contains('surgical')).toBe(true)
    expect(document.documentElement.classList.contains('theme-surgical')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
