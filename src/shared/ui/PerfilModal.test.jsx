/**
 * Tests — PerfilModal (Blueprint 03 Hotfix)
 * Valida apertura/cierre y renderizado del formulario de perfil profesional.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PerfilModal } from './PerfilModal'

describe('PerfilModal (Blueprint 03)', () => {
  const mockProfile = {
    nombreCompleto: 'Dr. Roberto Gomez',
    rut: '12.345.678-9',
    especialidad: 'Ortodoncia',
    numeroRegistroISP: 'ISP-998877',
    email: 'roberto@clinica.cl',
    rol: 'dentista',
  }

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(<PerfilModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza título y formulario de perfil profesional cuando isOpen es true', () => {
    render(<PerfilModal isOpen={true} onClose={vi.fn()} userProfile={mockProfile} />)

    expect(screen.getByRole('dialog', { name: /perfil profesional/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Dr. Roberto Gomez')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12.345.678-9')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ISP-998877')).toBeInTheDocument()
  })

  it('cierra el modal al pulsar el botón cerrar o presionar tecla Escape', () => {
    const onClose = vi.fn()
    render(<PerfilModal isOpen={true} onClose={onClose} userProfile={mockProfile} />)

    const closeBtn = screen.getByRole('button', { name: /cerrar/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
