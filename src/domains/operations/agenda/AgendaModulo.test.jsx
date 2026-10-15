import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgendaModulo } from './AgendaModulo'
import { useAgendaStore } from '../../../app/stores/useAgendaStore'
import { useThemeStore } from '../../../app/stores/useThemeStore'
import { agendaConfigService } from './services/agendaConfigService'

vi.mock('./services/agendaConfigService', () => ({
  agendaConfigService: {
    obtenerDoctoresAgenda: vi.fn(),
    actualizarConfigAgenda: vi.fn(),
    actualizarHorariosUsuario: vi.fn(),
  },
}))

describe('AgendaModulo (BP05 Integrador)', () => {
  const mockDoctorReal = {
    userId: 'doc-real-1',
    nombreCompleto: 'Dr. Juan Pérez',
    especialidad: 'General',
    rol: 'dentista',
    colorIdentidad: '#B88E3A',
    permiteSobrecupos: true,
    maxSobrecupos: 2,
    horarios: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(agendaConfigService.obtenerDoctoresAgenda).mockResolvedValue([mockDoctorReal])
    useThemeStore.setState({ theme: 'light' })
    useAgendaStore.setState({
      currentView: 'day',
      currentDateIso: '2026-10-10',
      selectedDoctor: 'Todos',
      selectedBox: 'Todos',
      citas: []
    })
  })

  it('renderiza cabecera, navegación y vista día por defecto', async () => {
    render(<AgendaModulo />)

    await waitFor(() => {
      expect(screen.getByText(/Agenda multi-box y control de sillones/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /nueva cita/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /urgencia/i })).toBeInTheDocument()
    })
  })

  it('renderiza modo quirúrgico cuando theme es surgical', () => {
    useThemeStore.setState({ theme: 'surgical' })
    render(<AgendaModulo />)

    expect(screen.getByText('AGENDA QUIRÚRGICA')).toBeInTheDocument()
    expect(screen.getByText(/pantalla quirúrgica antirreflejo/i)).toBeInTheDocument()
  })

  it('permite alternar a la Vista Lista según vista del store', async () => {
    useAgendaStore.setState({ currentView: 'list' })
    render(<AgendaModulo />)

    await waitFor(() => {
      expect(screen.getByText('Sin citas para la fecha seleccionada')).toBeInTheDocument()
    })
  })

  it('permite alternar a la Vista Semana según vista del store', async () => {
    useAgendaStore.setState({ currentView: 'week' })
    render(<AgendaModulo />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /calendario semanal/i })).toBeInTheDocument()
    })
  })

  it('permite alternar a la Vista Mes según vista del store', async () => {
    useAgendaStore.setState({ currentView: 'month' })
    render(<AgendaModulo />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /calendario mensual/i })).toBeInTheDocument()
    })
  })

  it('muestra estado vacío si no hay doctores configurados', async () => {
    vi.mocked(agendaConfigService.obtenerDoctoresAgenda).mockResolvedValue([])

    render(<AgendaModulo />)

    await waitFor(() => {
      expect(screen.getByText(/Configura los doctores de tu clínica/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Ir a Administración → Equipo/i })).toBeInTheDocument()
    })
  })

  it('NO muestra doctores inventados', async () => {
    vi.mocked(agendaConfigService.obtenerDoctoresAgenda).mockResolvedValue([])

    render(<AgendaModulo />)

    await waitFor(() => {
      expect(screen.queryByText(/Dr\. Miguel Martínez/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Dra\. Carolina Soto/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Dr\. Rodrigo Rodríguez/i)).not.toBeInTheDocument()
    })
  })

  it('NO muestra emojis en botones del header (Brand Manual)', async () => {
    render(<AgendaModulo />)
    
    await waitFor(() => {
      const botones = screen.getAllByRole('button')
      const textosBotones = botones.map(b => b.textContent).join(' ')
      
      const tieneEmojis = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|⚙️|🔬/u.test(textosBotones)
      expect(tieneEmojis).toBe(false)
    })
  })

  it('botones de acción NO tienen prefijo "+" redundante', async () => {
    render(<AgendaModulo />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Nueva cita$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Urgencia$/i })).toBeInTheDocument()
      
      // NO deben existir con "+"
      expect(screen.queryByRole('button', { name: /^\+ Nueva cita$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^\+ Bloqueo$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^\+ Urgencia$/i })).not.toBeInTheDocument()
    })
  })

  it('NO renderiza KPIs redundantes en header (BP05 §01)', () => {
    render(<AgendaModulo />)
    
    expect(screen.queryByText(/Citas programadas hoy/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/En sala de espera/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/En sillón/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Finalizados hoy/i)).not.toBeInTheDocument()
  })
})
