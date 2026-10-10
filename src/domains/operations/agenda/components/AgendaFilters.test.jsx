import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { AgendaFilters } from './AgendaFilters'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'
import { useSesionStore } from '../../../../app/stores/sesionStore'

describe('AgendaFilters', () => {
  beforeEach(() => {
    useAgendaStore.setState({
      selectedDoctor: 'Todos',
      selectedBox: 'Todos'
    })
    useSesionStore.setState({
      userProfile: {
        email: 'doc@example.com',
        nombreCompleto: 'Dra. Ana López',
        rol: 'dentista'
      }
    })
  })

  it('renderiza selectores de doctor y box', () => {
    render(<AgendaFilters />)
    expect(screen.getByLabelText(/doctor:/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/box \/ sillón:/i)).toBeInTheDocument()
  })

  it('permite filtrar por doctor y actualiza useAgendaStore', () => {
    const doctores = [
      { id: '1', nombre: 'Dr. Perez' },
      { id: '2', nombre: 'Dra. Gomez' }
    ]
    render(<AgendaFilters doctors={doctores} />)

    const selectDoc = screen.getByLabelText(/doctor:/i)
    fireEvent.change(selectDoc, { target: { value: 'Dr. Perez' } })

    expect(useAgendaStore.getState().selectedDoctor).toBe('Dr. Perez')
  })

  it('muestra opción "Solo yo" cuando el usuario es dentista', () => {
    render(<AgendaFilters />)
    expect(screen.getByText(/solo yo/i)).toBeInTheDocument()
  })

  it('permite filtrar por box y actualiza useAgendaStore', () => {
    const boxes = [
      { id: 'b1', nombre: 'Sillón 1' },
      { id: 'b2', nombre: 'Sillón 2' }
    ]
    render(<AgendaFilters boxes={boxes} />)

    const selectBox = screen.getByLabelText(/box \/ sillón:/i)
    fireEvent.change(selectBox, { target: { value: 'Sillón 1' } })

    expect(useAgendaStore.getState().selectedBox).toBe('Sillón 1')
  })
})
