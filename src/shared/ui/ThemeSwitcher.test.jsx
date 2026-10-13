import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeSwitcher } from './ThemeSwitcher'
import { useThemeStore } from '../../app/stores/useThemeStore'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

describe('ThemeSwitcher (Blueprint 02)', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' })
    useSidebarStore.setState({ theme: 'light' })
    document.documentElement.classList.remove('dark', 'theme-surgical')
  })

  it('renderiza slider físico con 3 botones de tema y accesibilidad slider', () => {
    render(<ThemeSwitcher />)
    expect(screen.getByTestId('theme-switcher-slider')).toBeInTheDocument()

    const slider = screen.getByRole('slider', { name: /tema de interfaz/i })
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '2')
    expect(slider).toHaveAttribute('aria-valuenow', '0')

    expect(screen.getByRole('button', { name: /activar modo claro/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activar modo quirúrgico/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activar modo oscuro/i })).toBeInTheDocument()
  })

  it('cambia de tema al presionar botón de modo quirúrgico', () => {
    render(<ThemeSwitcher />)
    const surgicalBtn = screen.getByRole('button', { name: /activar modo quirúrgico/i })
    fireEvent.click(surgicalBtn)
    expect(useSidebarStore.getState().theme).toBe('surgical')
    expect(document.documentElement.classList.contains('theme-surgical')).toBe(true)
  })

  it('cambia de tema al presionar botón de modo oscuro', () => {
    render(<ThemeSwitcher />)
    const darkBtn = screen.getByRole('button', { name: /activar modo oscuro/i })
    fireEvent.click(darkBtn)
    expect(useSidebarStore.getState().theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('navega entre temas usando teclas de flechas (accesibilidad slider)', () => {
    render(<ThemeSwitcher />)
    const slider = screen.getByRole('slider')

    // De light -> surgical con ArrowRight
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(useSidebarStore.getState().theme).toBe('surgical')

    // De surgical -> dark con ArrowRight
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(useSidebarStore.getState().theme).toBe('dark')

    // De dark -> surgical con ArrowLeft
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(useSidebarStore.getState().theme).toBe('surgical')
  })

  it('soporta interacción de drag con Pointer Events', () => {
    render(<ThemeSwitcher />)
    const slider = screen.getByRole('slider')

    slider.getBoundingClientRect = () => ({
      left: 0,
      width: 160,
      top: 0,
      bottom: 34,
      height: 34,
      right: 160,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Pointer down en posición correspondiente al 85% (oscuro)
    fireEvent.pointerDown(slider, {
      clientX: 140,
      pointerId: 1,
      button: 0,
    })

    fireEvent.pointerMove(slider, {
      clientX: 150,
      pointerId: 1,
    })

    fireEvent.pointerUp(slider, {
      clientX: 150,
      pointerId: 1,
    })

    expect(useSidebarStore.getState().theme).toBe('dark')
  })
})
