import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgendaNavigation } from './AgendaNavigation'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'

describe('AgendaNavigation (BP05 §02)', () => {
  beforeEach(() => {
    useAgendaStore.setState({ currentView: 'day' })
  })

  it('permite alternar entre vistas (Día, Semana, Mes, Lista)', () => {
    render(<AgendaNavigation currentDateIso="2026-10-15" onDateChange={vi.fn()} />)

    expect(screen.getByText('Día')).toBeInTheDocument()
    expect(screen.getByText('Semana')).toBeInTheDocument()
    expect(screen.getByText('Mes')).toBeInTheDocument()
    expect(screen.getByText('Lista')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Semana'))
    expect(useAgendaStore.getState().currentView).toBe('week')
  })

  it('permite navegar día anterior y día siguiente', () => {
    const handleDateChange = vi.fn()
    render(<AgendaNavigation currentDateIso="2026-10-15" onDateChange={handleDateChange} />)

    fireEvent.click(screen.getByLabelText('Anterior'))
    expect(handleDateChange).toHaveBeenCalledWith('2026-10-14')

    fireEvent.click(screen.getByLabelText('Siguiente'))
    expect(handleDateChange).toHaveBeenCalledWith('2026-10-16')
  })

  it('permite ir a hoy', () => {
    const handleDateChange = vi.fn()
    render(<AgendaNavigation currentDateIso="2026-10-01" onDateChange={handleDateChange} />)

    fireEvent.click(screen.getByText('Hoy'))
    expect(handleDateChange).toHaveBeenCalled()
  })

  it('atajo G enfoca el input de fecha (BP05 §01)', () => {
    render(
      <AgendaNavigation
        currentDateIso="2026-10-14"
        onDateChange={vi.fn()}
      />
    )
    
    const dateInput = screen.getByLabelText(/Seleccionar fecha/i)
    
    fireEvent.keyDown(window, { key: 'g' })
    
    expect(dateInput).toHaveFocus()
  })

  it('botones Hoy y Exportar tienen clases active:scale-95 para feedback visual', () => {
    render(<AgendaNavigation currentDateIso="2026-10-15" onDateChange={() => {}} onExportCSV={() => {}} />)

    const botonHoy = screen.getByRole('button', { name: /Hoy/i })
    expect(botonHoy.className).toContain('active:scale-95')

    const botonExportar = screen.getByRole('button', { name: /Exportar/i })
    expect(botonExportar.className).toContain('active:scale-95')
  })
})
