/**
 * Tests — Input component (F7-25 Fase 3, Iteración 2)
 *
 * Valida label, error states, helper text, tamaños, iconos,
 * disabled state y accesibilidad.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from './Input'
import { Mail } from 'lucide-react'

describe('Input (F7-25)', () => {

  describe('renderizado básico', () => {
    it('renderiza un input con label', () => {
      render(<Input label="Email" />)
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('renderiza sin label (input directo)', () => {
      render(<Input placeholder="Enter email" />)
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument()
    })

    it('renderiza el value controlado', () => {
      render(<Input label="Email" value="test@example.com" onChange={() => {}} />)
      expect(screen.getByLabelText('Email')).toHaveValue('test@example.com')
    })
  })

  describe('label y required', () => {
    it('muestra indicador de requerido (*) cuando required=true', () => {
      render(<Input label="Email" required />)
      const label = screen.getByText('Email')
      expect(label.querySelector('.text-clinical-error')).toBeInTheDocument()
    })

    it('tiene aria-required="true" cuando required=true', () => {
      render(<Input label="Email" required />)
      expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-required', 'true')
    })

    it('asocia el label con el input vía htmlFor/id', () => {
      render(<Input label="Email" id="test-email" />)
      const label = screen.getByText('Email')
      const input = screen.getByLabelText('Email')
      expect(label.getAttribute('for')).toBe('test-email')
      expect(input.id).toBe('test-email')
    })
  })

  describe('error state', () => {
    it('muestra el mensaje de error cuando error está presente', () => {
      render(<Input label="Email" error="Email inválido" />)
      expect(screen.getByRole('alert')).toHaveTextContent('Email inválido')
    })

    it('tiene aria-invalid="true" cuando hay error', () => {
      render(<Input label="Email" error="Email inválido" />)
      expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true')
    })

    it('aplica clases de error al input', () => {
      render(<Input label="Email" error="Error" />)
      const input = screen.getByLabelText(/Email/)
      expect(input.className).toContain('border-clinical-error')
    })

    it('NO muestra helperText cuando hay error', () => {
      render(<Input label="Email" error="Error" helperText="Helper" />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })
  })

  describe('helper text', () => {
    it('muestra helperText cuando no hay error', () => {
      render(<Input label="Email" helperText="Formato: nombre@clinica.com" />)
      expect(screen.getByText('Formato: nombre@clinica.com')).toBeInTheDocument()
    })

    it('asocia helperText vía aria-describedby', () => {
      render(<Input label="Email" helperText="Helper" id="test-input" />)
      const input = screen.getByLabelText('Email')
      expect(input.getAttribute('aria-describedby')).toContain('test-input-helper')
    })
  })

  describe('tamaños', () => {
    it('aplica clases de tamaño sm', () => {
      render(<Input label="Email" size="sm" />)
      const input = screen.getByLabelText('Email')
      expect(input.className).toContain('px-2.5 py-1.5 text-xs')
    })

    it('aplica clases de tamaño md por defecto', () => {
      render(<Input label="Email" />)
      const input = screen.getByLabelText('Email')
      expect(input.className).toContain('px-3 py-2 text-sm')
    })

    it('aplica clases de tamaño lg', () => {
      render(<Input label="Email" size="lg" />)
      const input = screen.getByLabelText('Email')
      expect(input.className).toContain('px-4 py-2.5 text-base')
    })
  })

  describe('iconos', () => {
    it('renderiza icono a la izquierda por defecto', () => {
      const { container } = render(<Input label="Email" icon={Mail} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
      const input = screen.getByLabelText('Email')
      expect(input.className).toContain('pl-10')
    })

    it('renderiza icono a la derecha cuando iconPosition="right"', () => {
      const { container } = render(<Input label="Email" icon={Mail} iconPosition="right" />)
      expect(container.querySelector('svg')).toBeInTheDocument()
      const input = screen.getByLabelText('Email')
      expect(input.className).toContain('pr-10')
    })
  })

  describe('disabled state', () => {
    it('está disabled cuando disabled=true', () => {
      render(<Input label="Email" disabled />)
      expect(screen.getByLabelText('Email')).toBeDisabled()
    })

    it('tiene cursor-not-allowed cuando disabled', () => {
      render(<Input label="Email" disabled />)
      const input = screen.getByLabelText('Email')
      expect(input.className).toContain('disabled:cursor-not-allowed')
      expect(input.className).toContain('disabled:opacity-50')
    })
  })

  describe('eventos', () => {
    it('dispara onChange al escribir', () => {
      const onChange = vi.fn()
      render(<Input label="Email" onChange={onChange} />)
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('forwardRef', () => {
    it('pasa el ref al input element', () => {
      const ref = React.createRef()
      render(<Input label="Email" ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })
  })

  describe('aria-describedby', () => {
    it('combina error y aria-describedby custom', () => {
      render(<Input label="Email" error="Error" aria-describedby="custom-desc" id="test-input" />)
      const input = screen.getByLabelText(/Email/)
      const describedBy = input.getAttribute('aria-describedby')
      expect(describedBy).toContain('test-input-error')
      expect(describedBy).toContain('custom-desc')
    })
  })
})
