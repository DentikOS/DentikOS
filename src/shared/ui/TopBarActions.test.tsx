import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TopBarActions } from './TopBarActions'
import { UserPlus, Calendar, Filter } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'

// Mock usePermissions
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: vi.fn(() => ({
    puede: vi.fn(() => true), // Por defecto todos los permisos
    rol: 'admin',
    isAdmin: true,
  })),
}))

describe('TopBarActions (Blueprint 03 §07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePermissions).mockReturnValue({
      puede: vi.fn(() => true),
      rol: 'admin',
      isAdmin: true,
      seccionesFiltradas: [],
    })
  })

  it('renderiza botón primario con gradiente dorado', () => {
    const onClick = vi.fn()
    render(
      <TopBarActions
        primaria={{
          label: 'Nuevo paciente',
          icon: UserPlus,
          onClick,
        }}
      />
    )

    const button = screen.getByRole('button', { name: /nuevo paciente/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveStyle({
      background: 'linear-gradient(135deg, #E5C378 0%, #B88E3A 100%)',
      color: '#070B14',
    })

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renderiza botón ⋯ y abre dropdown al hacer click', () => {
    render(
      <TopBarActions
        primaria={{ label: 'Acción', onClick: vi.fn() }}
        secundarias={[
          { label: 'Secundaria 1', icon: Calendar, onClick: vi.fn() },
          { label: 'Secundaria 2', icon: Filter, onClick: vi.fn() },
        ]}
      />
    )

    // Dropdown inicialmente cerrado
    expect(screen.queryByText('Secundaria 1')).not.toBeInTheDocument()

    // Click en botón ⋯
    const menuButton = screen.getByRole('button', { name: /más acciones/i })
    fireEvent.click(menuButton)

    // Dropdown abierto con ancho 220px
    expect(screen.getByText('Secundaria 1')).toBeInTheDocument()
    expect(screen.getByText('Secundaria 2')).toBeInTheDocument()
  })

  it('cierra dropdown con Esc', async () => {
    render(
      <TopBarActions
        primaria={{ label: 'Acción', onClick: vi.fn() }}
        secundarias={[
          { label: 'Item', onClick: vi.fn() },
        ]}
      />
    )

    const menuButton = screen.getByRole('button', { name: /más acciones/i })
    fireEvent.click(menuButton)
    expect(screen.getByText('Item')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByText('Item')).not.toBeInTheDocument()
    })
  })

  it('filtra acciones primarias por permisos', () => {
    vi.mocked(usePermissions).mockReturnValue({
      puede: vi.fn(() => false), // Sin permisos
      rol: 'recepcion',
      isAdmin: false,
      seccionesFiltradas: [],
    })

    render(
      <TopBarActions
        primaria={{
          label: 'Nuevo presupuesto',
          onClick: vi.fn(),
          permisoRequerido: 'gestionar_presupuestos',
        }}
      />
    )

    // No debe renderizar el botón primario
    expect(screen.queryByText('Nuevo presupuesto')).not.toBeInTheDocument()
  })

  it('filtra acciones secundarias por permisos', () => {
    const puedeMock = vi.fn((permiso: string) => permiso === 'ver_reportes')
    vi.mocked(usePermissions).mockReturnValue({
      puede: puedeMock,
      rol: 'recepcion',
      isAdmin: false,
      seccionesFiltradas: [],
    })

    render(
      <TopBarActions
        primaria={{ label: 'Acción', onClick: vi.fn() }}
        secundarias={[
          { label: 'Reportes', onClick: vi.fn(), permisoRequerido: 'ver_reportes' },
          { label: 'Presupuestos', onClick: vi.fn(), permisoRequerido: 'gestionar_presupuestos' },
        ]}
      />
    )

    const menuButton = screen.getByRole('button', { name: /más acciones/i })
    fireEvent.click(menuButton)

    expect(screen.getByText('Reportes')).toBeInTheDocument()
    expect(screen.queryByText('Presupuestos')).not.toBeInTheDocument()
  })

  it('no renderiza nada si no hay acciones visibles', () => {
    vi.mocked(usePermissions).mockReturnValue({
      puede: vi.fn(() => false),
      rol: 'recepcion',
      isAdmin: false,
      seccionesFiltradas: [],
    })

    const { container } = render(
      <TopBarActions
        primaria={{
          label: 'Acción',
          onClick: vi.fn(),
          permisoRequerido: 'gestionar_pacientes',
        }}
        secundarias={[
          { label: 'Item', onClick: vi.fn(), permisoRequerido: 'gestionar_presupuestos' },
        ]}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('dropdown tiene ancho 220px', () => {
    render(
      <TopBarActions
        primaria={{ label: 'Acción', onClick: vi.fn() }}
        secundarias={[
          { label: 'Item', onClick: vi.fn() },
        ]}
      />
    )

    const menuButton = screen.getByRole('button', { name: /más acciones/i })
    fireEvent.click(menuButton)

    const dropdown = screen.getByRole('menu')
    expect(dropdown).toHaveClass('w-[220px]')
  })
})
