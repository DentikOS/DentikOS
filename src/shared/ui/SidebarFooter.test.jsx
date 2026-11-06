import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SidebarFooter } from './SidebarFooter'

vi.mock('../hooks/useSessionDevices', () => ({
  useSessionDevices: () => ({
    devices: [],
    loading: false,
    refresh: vi.fn(),
  }),
}))

describe('SidebarFooter (Blueprint 02 §05)', () => {
  it('renderiza versión y elementos en modo expandido', () => {
    render(<SidebarFooter compact={false} />)

    expect(screen.getByTestId('sidebar-footer-expanded')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0 · DentikOS')).toBeInTheDocument()
  })

  it('render compacto: centrado sin desborde horizontal (scrollWidth <= clientWidth)', () => {
    const { container } = render(
      <div style={{ width: '48px', overflow: 'hidden' }}>
        <SidebarFooter compact={true} />
      </div>
    )

    const footer = screen.getByTestId('sidebar-footer-compact')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveClass('items-center')

    // Los 3 elementos del footer compacto deben existir
    expect(screen.getByLabelText(/cambiar tema/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/conectado/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/dispositivo/i)).toBeInTheDocument()

    // Comprobar que no hay desborde horizontal en el contenedor
    const root = container.firstElementChild
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth || 48)
  })
})
