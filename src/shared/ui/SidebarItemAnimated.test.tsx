import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayoutDashboard } from 'lucide-react'
import { SidebarItemAnimated } from './SidebarItemAnimated'

describe('SidebarItemAnimated — Trazo de Cera Quirúrgica (Blueprint 02 §02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza etiqueta e icono correctamente', () => {
    render(
      <SidebarItemAnimated
        icon={LayoutDashboard}
        label="Dashboard"
        slug="dashboard"
        isActive={false}
        onClick={vi.fn()}
      />
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-dashboard')).not.toHaveAttribute('aria-current')
  })

  it('indica estado activo con aria-current="page"', () => {
    render(
      <SidebarItemAnimated
        icon={LayoutDashboard}
        label="Dashboard"
        slug="dashboard"
        isActive={true}
        onClick={vi.fn()}
      />
    )

    expect(screen.getByTestId('sidebar-menu-dashboard')).toHaveAttribute('aria-current', 'page')
  })

  it('ejecuta onClick al hacer clic', () => {
    const handleClick = vi.fn()
    render(
      <SidebarItemAnimated
        icon={LayoutDashboard}
        label="Dashboard"
        slug="dashboard"
        isActive={false}
        onClick={handleClick}
      />
    )

    fireEvent.click(screen.getByTestId('sidebar-menu-dashboard'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('muestra badge numérico con formateo cuando hay contador', () => {
    render(
      <SidebarItemAnimated
        icon={LayoutDashboard}
        label="Pacientes"
        slug="pacientes"
        isActive={false}
        onClick={vi.fn()}
        badge={5}
        badgeColor="amber"
      />
    )

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('en modo colapsado oculta label de texto y muestra title para tooltip', () => {
    render(
      <SidebarItemAnimated
        icon={LayoutDashboard}
        label="Agenda"
        slug="agenda"
        isActive={false}
        onClick={vi.fn()}
        isCollapsed={true}
        title="Agenda (3)"
      />
    )

    expect(screen.queryByText('Agenda')).not.toBeInTheDocument()
    expect(screen.getByTestId('sidebar-menu-agenda')).toHaveAttribute('title', 'Agenda (3)')
  })
})
