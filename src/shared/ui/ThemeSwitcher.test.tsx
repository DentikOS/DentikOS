import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeSwitcher } from './ThemeSwitcher'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

describe('ThemeSwitcher (Blueprint 02 §04)', () => {
  beforeEach(() => {
    useSidebarStore.setState({ theme: 'light' })
  })

  it('renderiza las 3 posiciones y label en modo expandido', () => {
    render(<ThemeSwitcher compact={false} />)

    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument()
    expect(screen.getByText('Modo Claro')).toBeInTheDocument()
    expect(screen.getByLabelText('Cambiar a modo light')).toBeInTheDocument()
    expect(screen.getByLabelText('Cambiar a modo surgical')).toBeInTheDocument()
    expect(screen.getByLabelText('Cambiar a modo dark')).toBeInTheDocument()
  })

  it('permite cambiar a modo quirúrgico mediante click', () => {
    render(<ThemeSwitcher compact={false} />)

    const surgicalBtn = screen.getByLabelText('Cambiar a modo surgical')
    fireEvent.click(surgicalBtn)

    expect(useSidebarStore.getState().theme).toBe('surgical')
    expect(screen.getByText('Modo Quirúrgico')).toBeInTheDocument()
  })

  it('permite cambiar a modo oscuro mediante click', () => {
    render(<ThemeSwitcher compact={false} />)

    const darkBtn = screen.getByLabelText('Cambiar a modo dark')
    fireEvent.click(darkBtn)

    expect(useSidebarStore.getState().theme).toBe('dark')
    expect(screen.getByText('Modo Oscuro')).toBeInTheDocument()
  })

  it('renderiza botón compacto accesible cuando compact={true}', () => {
    render(<ThemeSwitcher compact={true} />)

    const compactBtn = screen.getByLabelText(/cambiar tema/i)
    expect(compactBtn).toBeInTheDocument()

    // Click cicla el tema
    fireEvent.click(compactBtn)
    expect(useSidebarStore.getState().theme).toBe('surgical')
  })

  it('permite cambiar directamente de light a dark en un solo drag', () => {
    render(<ThemeSwitcher compact={false} />)
    const slider = screen.getByTestId('theme-switcher-slider')

    slider.getBoundingClientRect = () => ({
      left: 0,
      width: 160,
      top: 0,
      bottom: 32,
      height: 32,
      right: 160,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Drag directo hacia posición dark (> 66% del track)
    fireEvent.pointerUp(slider, { clientX: 140 })
    expect(useSidebarStore.getState().theme).toBe('dark')

    // Drag directo desde dark de regreso a light (< 33% del track)
    fireEvent.pointerUp(slider, { clientX: 20 })
    expect(useSidebarStore.getState().theme).toBe('light')
  })

  it('soporta flechas de teclado para cambiar tema', () => {
    render(<ThemeSwitcher compact={false} />)
    const slider = screen.getByTestId('theme-switcher-slider')

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(useSidebarStore.getState().theme).toBe('surgical')

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(useSidebarStore.getState().theme).toBe('dark')

    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(useSidebarStore.getState().theme).toBe('surgical')
  })
})
