import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationCenter, type NotificationCenterItem } from './NotificationCenter'

describe('NotificationCenter (Blueprint 02 §07 Feature 03)', () => {
  it('renderiza notificaciones agrupadas por severidad', () => {
    const notifications: NotificationCenterItem[] = [
      {
        id: '1',
        severity: 'critical',
        title: 'Falla de Esterilización',
        message: 'Ciclo de autoclave interrumpido',
        timestamp: Date.now() - 60000,
      },
      {
        id: '2',
        severity: 'operational',
        title: 'Cita Confirmada',
        message: 'Paciente confirmó vía WhatsApp',
        timestamp: Date.now() - 120000,
      },
      {
        id: '3',
        severity: 'informational',
        title: 'Stock Actualizado',
        message: 'Se cargaron 50 guantes de látex',
        timestamp: Date.now() - 3600000,
      },
    ]

    render(
      <NotificationCenter
        isOpen={true}
        onClose={vi.fn()}
        notifications={notifications}
      />
    )

    expect(screen.getByText('Notificaciones')).toBeInTheDocument()
    expect(screen.getByText(/Críticas \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('Falla de Esterilización')).toBeInTheDocument()
    expect(screen.getByText(/Operativas \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('Cita Confirmada')).toBeInTheDocument()
    expect(screen.getByText(/Informativas \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('Stock Actualizado')).toBeInTheDocument()
  })

  it('ejecuta acción contextual al pulsar el botón de acción', () => {
    const handleAction = vi.fn()
    const notifications: NotificationCenterItem[] = [
      {
        id: '1',
        severity: 'critical',
        title: 'Alerta Crítica',
        message: 'Atención requerida',
        timestamp: Date.now(),
        action: {
          label: 'Ver Ficha',
          onClick: handleAction,
        },
      },
    ]

    render(
      <NotificationCenter
        isOpen={true}
        onClose={vi.fn()}
        notifications={notifications}
      />
    )

    const actionBtn = screen.getByText('Ver Ficha')
    fireEvent.click(actionBtn)
    expect(handleAction).toHaveBeenCalled()
  })

  it('muestra estado vacío cuando no hay notificaciones', () => {
    render(
      <NotificationCenter
        isOpen={true}
        onClose={vi.fn()}
        notifications={[]}
      />
    )

    expect(screen.getByText('Sin notificaciones pendientes')).toBeInTheDocument()
  })
})
