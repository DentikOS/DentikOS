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
})
