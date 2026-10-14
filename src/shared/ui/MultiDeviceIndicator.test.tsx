import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiDeviceIndicator } from './MultiDeviceIndicator'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

describe('MultiDeviceIndicator (Blueprint 02 §05)', () => {
  beforeEach(() => {
    useSidebarStore.setState({ activeDevices: 1 })
  })

  it('no se renderiza en expanded cuando hay menos de 2 dispositivos', () => {
    const { container } = render(<MultiDeviceIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('se renderiza cuando hay 2 o más dispositivos activos', () => {
    useSidebarStore.setState({ activeDevices: 2 })
    render(<MultiDeviceIndicator />)

    expect(screen.getByTestId('multi-device-indicator')).toBeInTheDocument()
    expect(screen.getByText('2 dispositivos activos')).toBeInTheDocument()
  })

  it('muestra tooltip al hacer hover', () => {
    useSidebarStore.setState({ activeDevices: 3 })
    render(<MultiDeviceIndicator />)

    const indicator = screen.getByTestId('multi-device-indicator')
    fireEvent.mouseEnter(indicator)

    expect(screen.getByText('Desktop (esta sesión)')).toBeInTheDocument()
    expect(screen.getByText('iPad Box 3')).toBeInTheDocument()
    expect(screen.getByText('Cerrar sesiones remotas')).toBeInTheDocument()
  })

  it('soporta modo compacto con dot accesible', () => {
    render(<MultiDeviceIndicator compact={true} />)
    expect(screen.getByTestId('multi-device-indicator-compact')).toBeInTheDocument()
    expect(screen.getByLabelText(/dispositivo/i)).toBeInTheDocument()
  })
})
