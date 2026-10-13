import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TopBarBreadcrumbs } from './TopBarBreadcrumbs'
import { useTopBarStore } from '../../app/stores/useTopBarStore'

describe('TopBarBreadcrumbs (BP03 §08 Feature 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useTopBarStore.setState({ isDirty: false, savedAt: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('estado neutral: NO renderiza indicador de guardado (ni ✓ ni ●)', () => {
    render(<TopBarBreadcrumbs items={[{ label: 'Dashboard' }]} />)
    expect(screen.queryByTestId('topbar-dirty-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('topbar-saved-indicator')).not.toBeInTheDocument()
    expect(screen.queryByText(/Guardado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cambios sin guardar/i)).not.toBeInTheDocument()
  })

  it('estado dirty: renderiza ● ámbar y "Cambios sin guardar"', () => {
    render(<TopBarBreadcrumbs items={[{ label: 'Dashboard' }]} />)

    act(() => {
      useTopBarStore.getState().setIsDirty(true)
    })

    expect(screen.getByTestId('topbar-dirty-indicator')).toBeInTheDocument()
    expect(screen.getByText(/Cambios sin guardar/i)).toBeInTheDocument()
    expect(screen.queryByTestId('topbar-saved-indicator')).not.toBeInTheDocument()
  })

  it('estado saved: renderiza ✓ y a 2.5s desaparece por completo', () => {
    render(<TopBarBreadcrumbs items={[{ label: 'Dashboard' }]} />)

    act(() => {
      useTopBarStore.getState().markSaved()
    })

    expect(screen.getByTestId('topbar-saved-indicator')).toBeInTheDocument()
    expect(screen.getByText(/Guardado/i)).toBeInTheDocument()
    expect(screen.queryByTestId('topbar-dirty-indicator')).not.toBeInTheDocument()

    // Avanzamos 2.5s
    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.queryByTestId('topbar-saved-indicator')).not.toBeInTheDocument()
    expect(screen.queryByText(/Guardado/i)).not.toBeInTheDocument()
  })

  it('limita a máximo 3 niveles visibles (BP03 §02)', () => {
    const items = [
      { label: 'Nivel 1' },
      { label: 'Nivel 2' },
      { label: 'Nivel 3' },
      { label: 'Nivel 4' },
    ]
    render(<TopBarBreadcrumbs items={items} />)

    expect(screen.getByText('Nivel 1')).toBeInTheDocument()
    expect(screen.getByText('Nivel 2')).toBeInTheDocument()
    expect(screen.getByText('Nivel 3')).toBeInTheDocument()
    expect(screen.queryByText('Nivel 4')).not.toBeInTheDocument()
  })

  it('trunca con "…" al inicio si el texto excede 20 caracteres y mantiene title completo', () => {
    const longName = 'María José González Rodríguez'
    render(<TopBarBreadcrumbs items={[{ label: 'Pacientes' }, { label: longName }]} />)

    // Truncado a 20 caracteres: '…' + slice(-19)
    const expectedTruncated = '…' + longName.slice(-19)
    expect(screen.getByText(expectedTruncated)).toBeInTheDocument()

    const currentLevel = screen.getByText(expectedTruncated)
    expect(currentLevel).toHaveAttribute('title', longName)
    expect(currentLevel).toHaveAttribute('aria-current', 'page')
  })
})
