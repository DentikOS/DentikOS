import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetBase } from './WidgetBase'

describe('WidgetBase (BP04 §03)', () => {
  it('renderiza título, icono, contenido infantil y footer', () => {
    const handleHeaderClick = vi.fn()
    render(
      <WidgetBase
        titulo="Widget Test"
        icono={<span data-testid="test-icon">icon</span>}
        borderColor="#B88E3A"
        onHeaderClick={handleHeaderClick}
        headerAction={<button>Acción</button>}
        footer={<span>Footer info</span>}
      >
        <p>Contenido interior</p>
      </WidgetBase>
    )

    expect(screen.getByText('Widget Test')).toBeInTheDocument()
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    expect(screen.getByText('Acción')).toBeInTheDocument()
    expect(screen.getByText('Contenido interior')).toBeInTheDocument()
    expect(screen.getByText('Footer info')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Widget Test'))
    expect(handleHeaderClick).toHaveBeenCalled()
  })
})
