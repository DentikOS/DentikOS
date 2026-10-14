import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectivityIndicator } from './ConnectivityIndicator'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

describe('ConnectivityIndicator (Blueprint 02 §05)', () => {
  beforeEach(() => {
    useSidebarStore.setState({ connectivityStatus: 'connected', lastSyncAt: null })
  })

  it('muestra estado conectado (verde)', () => {
    render(<ConnectivityIndicator />)
    expect(screen.getByTestId('connectivity-indicator')).toBeInTheDocument()
    expect(screen.getByText('Sincronizado')).toBeInTheDocument()
  })

  it('muestra cambios pendientes cuando status es pending (ámbar)', () => {
    useSidebarStore.setState({ connectivityStatus: 'pending' })
    render(<ConnectivityIndicator />)
    expect(screen.getByText('Cambios locales pendientes')).toBeInTheDocument()
  })

  it('muestra error de sincronización y botón reintentar cuando status es error (rojo)', () => {
    const onRetry = vi.fn()
    useSidebarStore.setState({ connectivityStatus: 'error' })
    render(<ConnectivityIndicator onRetry={onRetry} />)

    expect(screen.getByText('Error de sincronización')).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /reintentar/i })
    expect(retryBtn).toBeInTheDocument()

    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalled()
  })

  it('soporta modo compacto con dot accesible', () => {
    render(<ConnectivityIndicator compact={true} />)
    expect(screen.getByTestId('connectivity-indicator-compact')).toBeInTheDocument()
    expect(screen.getByLabelText(/conectado/i)).toBeInTheDocument()
  })
})
