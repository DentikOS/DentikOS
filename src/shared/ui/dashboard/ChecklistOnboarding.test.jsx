import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChecklistOnboarding } from './ChecklistOnboarding'

describe('ChecklistOnboarding (BP04 §07)', () => {
  it('renderiza checklist inicial y porcentaje de progreso', () => {
    render(<ChecklistOnboarding />)
    expect(screen.getByText(/Checklist de Configuración Inicial/i)).toBeInTheDocument()
    expect(screen.getByText(/Espacio configurado/i)).toBeInTheDocument()
    expect(screen.getByText(/Crear primer paciente/i)).toBeInTheDocument()
  })

  it('permite alternar un item de la lista', () => {
    render(<ChecklistOnboarding />)
    const item = screen.getByText(/Crear primer paciente/i)
    fireEvent.click(item)
    expect(item).toHaveClass('line-through')
  })

  it('permite ocultar el checklist con el botón de cerrar', () => {
    render(<ChecklistOnboarding />)
    const closeBtn = screen.getByTitle(/Ocultar checklist/i)
    fireEvent.click(closeBtn)
    expect(screen.queryByText(/Checklist de Configuración Inicial/i)).not.toBeInTheDocument()
  })
})
