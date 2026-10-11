/**
 * Tests — Modal component (F7-25 Fase 3, Iteración 2)
 *
 * Valida accesibilidad F6-04 (ESC, trampa de foco), overlay click,
 * tamaños, y comportamiento de open/close.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal (F7-25)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  describe('renderizado condicional', () => {
    it('no renderiza cuando isOpen=false', () => {
      render(<Modal {...defaultProps} isOpen={false}>Contenido</Modal>)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renderiza cuando isOpen=true', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Contenido')).toBeInTheDocument()
    })

    it('muestra el título cuando se proporciona', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      expect(screen.getByText('Test Modal')).toBeInTheDocument()
    })
  })

  describe('accesibilidad F6-04', () => {
    it('tiene role="dialog" y aria-modal="true"', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('usa aria-labelledby apuntando al título', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      const dialog = screen.getByRole('dialog')
      const title = screen.getByText('Test Modal')
      expect(dialog.getAttribute('aria-labelledby')).toBe(title.id)
    })

    it('cierra con tecla ESC cuando closeOnEscape=true', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('NO cierra con ESC cuando closeOnEscape=false', () => {
      render(<Modal {...defaultProps} closeOnEscape={false}>Contenido</Modal>)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('overlay click', () => {
    it('cierra al hacer click en el overlay (fuera del modal)', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      const overlay = screen.getByRole('presentation')
      fireEvent.click(overlay)
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('NO cierra cuando closeOnOverlayClick=false', () => {
      render(
        <Modal {...defaultProps} closeOnOverlayClick={false}>Contenido</Modal>
      )
      const overlay = screen.getByRole('presentation')
      fireEvent.click(overlay)
      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })

    it('NO cierra al hacer click dentro del contenido del modal', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      fireEvent.click(screen.getByText('Contenido'))
      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('botón de cierre', () => {
    it('muestra botón de cierre por defecto', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      expect(screen.getByRole('button', { name: /cerrar modal/i })).toBeInTheDocument()
    })

    it('NO muestra botón de cierre cuando showCloseButton=false', () => {
      render(<Modal {...defaultProps} showCloseButton={false}>Contenido</Modal>)
      expect(screen.queryByRole('button', { name: /cerrar modal/i })).not.toBeInTheDocument()
    })

    it('cierra el modal al hacer click en el botón de cierre', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      fireEvent.click(screen.getByRole('button', { name: /cerrar modal/i }))
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('tamaños', () => {
    it('aplica max-w-md para size="sm"', () => {
      render(<Modal {...defaultProps} size="sm">Contenido</Modal>)
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('max-w-md')
    })

    it('aplica max-w-lg para size="md" (default)', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('max-w-lg')
    })

    it('aplica max-w-2xl para size="lg"', () => {
      render(<Modal {...defaultProps} size="lg">Contenido</Modal>)
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('max-w-2xl')
    })

    it('aplica max-w-4xl para size="xl"', () => {
      render(<Modal {...defaultProps} size="xl">Contenido</Modal>)
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('max-w-4xl')
    })

    it('aplica max-w-full para size="full"', () => {
      render(<Modal {...defaultProps} size="full">Contenido</Modal>)
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('max-w-full')
    })
  })

  describe('prevención de scroll del body', () => {
    it('oculta overflow del body cuando el modal está abierto', () => {
      render(<Modal {...defaultProps}>Contenido</Modal>)
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restaura overflow del body cuando el modal se cierra', async () => {
      const { rerender } = render(<Modal {...defaultProps}>Contenido</Modal>)
      expect(document.body.style.overflow).toBe('hidden')
      
      rerender(<Modal {...defaultProps} isOpen={false}>Contenido</Modal>)
      await waitFor(() => {
        expect(document.body.style.overflow).toBe('')
      })
    })
  })
})
