import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { AgendaModulo } from './AgendaModulo'
import { useAgendaStore } from '../../../app/stores/useAgendaStore'
import { useThemeStore } from '../../../app/stores/useThemeStore'

describe('AgendaModulo (BP05 Integrador)', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' })
    useAgendaStore.setState({
      currentView: 'day',
      currentDateIso: '2026-10-10',
      selectedDoctor: 'Todos',
      selectedBox: 'Todos',
      citas: []
    })
  })

  it('renderiza cabecera, navegación y vista día por defecto', () => {
    render(<AgendaModulo />)

    expect(screen.getByText(/Agenda multi-box y control de sillones/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agendar nueva cita/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /añadir bloqueo/i })).toBeInTheDocument()
  })

  it('renderiza modo quirúrgico cuando theme es surgical', () => {
    useThemeStore.setState({ theme: 'surgical' })
    render(<AgendaModulo />)

    expect(screen.getByText('AGENDA QUIRÚRGICA')).toBeInTheDocument()
    expect(screen.getByText(/pantalla quirúrgica antirreflejo/i)).toBeInTheDocument()
  })

  it('permite alternar a la Sala de Espera Virtual según vista del store', () => {
    useAgendaStore.setState({ currentView: 'waiting_room' })
    render(<AgendaModulo />)

    expect(screen.getByText('Sala de Espera Virtual')).toBeInTheDocument()
  })

  it('permite alternar a la Vista Semana según vista del store', () => {
    useAgendaStore.setState({ currentView: 'week' })
    render(<AgendaModulo />)

    expect(screen.getByRole('region', { name: /calendario semanal/i })).toBeInTheDocument()
  })

  it('permite alternar a la Vista Mes según vista del store', () => {
    useAgendaStore.setState({ currentView: 'month' })
    render(<AgendaModulo />)

    expect(screen.getByRole('region', { name: /calendario mensual/i })).toBeInTheDocument()
  })
})
