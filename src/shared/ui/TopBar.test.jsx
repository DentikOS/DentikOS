/**
 * Tests — TopBar component (Blueprint 02)
 * Valida breadcrumbs, usuario, rol, logout, ClinicaSelector, selector de sede y ocultamiento en modo quirúrgico.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from './TopBar'

// Mock ClinicaSelector
vi.mock('./ClinicaSelector', () => ({
  ClinicaSelector: ({ onCambioClinica }) => (
    <div data-testid="clinica-selector" onClick={onCambioClinica}>
      Clínica Test
    </div>
  ),
}))

// Mock SelectorSede
vi.mock('./SelectorSede', () => ({
  SelectorSede: () => <div data-testid="selector-sede">Sede Central</div>,
}))

describe('TopBar (Blueprint 02)', () => {
  const mockUserProfile = {
    nombreCompleto: 'Dr. Miguel Díaz',
    email: 'miguel@clinica.com',
    rol: 'admin',
  }

  const defaultProps = {
    userProfile: mockUserProfile,
    onLogout: vi.fn(),
    onCambioClinica: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('renderizado básico y breadcrumbs', () => {
    it('renderiza breadcrumbs por defecto (Dashboard)', () => {
      render(<TopBar {...defaultProps} />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('renderiza breadcrumbs anidados personalizados', () => {
      const breadcrumbs = [
        { label: 'Pacientes', onClick: vi.fn() },
        { label: 'Juan Pérez' },
      ]
      render(<TopBar {...defaultProps} breadcrumbs={breadcrumbs} />)
      expect(screen.getByText('Pacientes')).toBeInTheDocument()
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    })

    it('renderiza el nombre y rol del usuario', () => {
      render(<TopBar {...defaultProps} />)
      expect(screen.getByText('Dr. Miguel Díaz')).toBeInTheDocument()
      expect(screen.getByText('Administrador')).toBeInTheDocument()
    })

    it('renderiza ClinicaSelector y SelectorSede', () => {
      render(<TopBar {...defaultProps} />)
      expect(screen.getByTestId('clinica-selector')).toBeInTheDocument()
      expect(screen.getByTestId('selector-sede')).toBeInTheDocument()
    })
  })

  describe('avatar', () => {
    it('muestra la inicial del nombre (sin Dr./Dra.)', () => {
      render(<TopBar {...defaultProps} />)
      expect(screen.getByText('M')).toBeInTheDocument()
    })

    it('muestra U si no hay nombreCompleto', () => {
      render(<TopBar {...defaultProps} userProfile={{}} />)
      expect(screen.getByText('U')).toBeInTheDocument()
    })

    it('maneja Dra. correctamente', () => {
      render(<TopBar {...defaultProps} userProfile={{ nombreCompleto: 'Dra. Ana López', rol: 'dentista' }} />)
      expect(screen.getByText('A')).toBeInTheDocument()
    })
  })

  describe('botón de logout en menú', () => {
    it('abre menú al clickear avatar y ejecuta onLogout', () => {
      render(<TopBar {...defaultProps} />)
      const trigger = screen.getByRole('button', { name: /menú de usuario/i })
      fireEvent.click(trigger)

      const logoutBtn = screen.getByRole('menuitem', { name: /cerrar sesión/i })
      expect(logoutBtn).toBeInTheDocument()
      fireEvent.click(logoutBtn)
      expect(defaultProps.onLogout).toHaveBeenCalledTimes(1)
    })
  })

  describe('modo quirúrgico', () => {
    it('se oculta completamente cuando theme="surgical"', () => {
      const { container } = render(<TopBar {...defaultProps} theme="surgical" />)
      expect(container.querySelector('header')).not.toBeInTheDocument()
    })
  })

  describe('centro de notificaciones y búsqueda', () => {
    it('renderiza botón de notificaciones y botón de búsqueda ⌘K', () => {
      const onOpenSearch = vi.fn()
      render(<TopBar {...defaultProps} onOpenSearch={onOpenSearch} />)

      const searchBtn = screen.getByRole('button', { name: /buscar pacientes y módulos/i })
      expect(searchBtn).toBeInTheDocument()
      fireEvent.click(searchBtn)
      expect(onOpenSearch).toHaveBeenCalledTimes(1)

      const notifBtn = screen.getByRole('button', { name: /centro de notificaciones/i })
      expect(notifBtn).toBeInTheDocument()
      expect(notifBtn).toHaveClass('text-[#64748B]')
    })

    it('muestra badge dorado #B88E3A con número de notificaciones pendientes y "9+" si supera 9', async () => {
      const { notificationService } = await import('../../infrastructure/notification/notificationService')
      notificationService.limpiar()
      notificationService.mostrar('Alerta 1', { severity: 'critical' })
      notificationService.mostrar('Alerta 2', { severity: 'critical' })

      const { rerender } = render(<TopBar {...defaultProps} />)
      const badge = screen.getByText('2')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-[#B88E3A]')
      expect(badge).toHaveClass('text-[#070B14]')
      expect(badge).toHaveClass('rounded-lg')

      // Probar más de 9 notificaciones
      for (let i = 3; i <= 11; i++) {
        notificationService.mostrar(`Alerta ${i}`, { severity: 'critical' })
      }
      rerender(<TopBar {...defaultProps} />)
      expect(screen.getByText('9+')).toBeInTheDocument()

      notificationService.limpiar()
    })
  })

  describe('acciones contextuales (Blueprint 03)', () => {
    it('renderiza acción primaria y secundarias', () => {
      const onPrimaryClick = vi.fn()
      const accionPrimaria = { label: 'Nueva cita', onClick: onPrimaryClick }
      const accionesSecundarias = [{ label: 'Nuevo paciente', onClick: vi.fn() }]

      render(
        <TopBar
          {...defaultProps}
          accionPrimaria={accionPrimaria}
          accionesSecundarias={accionesSecundarias}
        />
      )

      const primaryBtn = screen.getByRole('button', { name: /nueva cita/i })
      expect(primaryBtn).toBeInTheDocument()
      fireEvent.click(primaryBtn)
      expect(onPrimaryClick).toHaveBeenCalledTimes(1)

      const moreBtn = screen.getByRole('button', { name: /más acciones contextuales/i })
      expect(moreBtn).toBeInTheDocument()
      fireEvent.click(moreBtn)
      expect(screen.getByText('Nuevo paciente')).toBeInTheDocument()
    })
  })

  describe('avatar con 6 secciones (Blueprint 03)', () => {
    it('despliega las 6 secciones requeridas al abrir el menú', () => {
      render(<TopBar {...defaultProps} />)
      const trigger = screen.getByRole('button', { name: /menú de usuario/i })
      fireEvent.click(trigger)

      expect(screen.getByText('Perfil')).toBeInTheDocument()
      expect(screen.getByText('Preferencias')).toBeInTheDocument()
      expect(screen.getByText('Panel de Atajos')).toBeInTheDocument()
      expect(screen.getByText('Modo Foco')).toBeInTheDocument()
      expect(screen.getByText('Dispositivos')).toBeInTheDocument()
      expect(screen.getByText('Cerrar sesión')).toBeInTheDocument()
    })

    it('ejecuta los callbacks onOpenPerfil, onOpenPreferencias y onOpenDispositivos al seleccionarlos', () => {
      const onOpenPerfil = vi.fn()
      const onOpenPreferencias = vi.fn()
      const onOpenDispositivos = vi.fn()

      render(
        <TopBar
          {...defaultProps}
          onOpenPerfil={onOpenPerfil}
          onOpenPreferencias={onOpenPreferencias}
          onOpenDispositivos={onOpenDispositivos}
        />
      )

      const trigger = screen.getByRole('button', { name: /menú de usuario/i })
      fireEvent.click(trigger)

      fireEvent.click(screen.getByText('Perfil'))
      expect(onOpenPerfil).toHaveBeenCalledTimes(1)

      fireEvent.click(trigger)
      fireEvent.click(screen.getByText('Preferencias'))
      expect(onOpenPreferencias).toHaveBeenCalledTimes(1)

      fireEvent.click(trigger)
      fireEvent.click(screen.getByText('Dispositivos'))
      expect(onOpenDispositivos).toHaveBeenCalledTimes(1)
    })
  })
})

