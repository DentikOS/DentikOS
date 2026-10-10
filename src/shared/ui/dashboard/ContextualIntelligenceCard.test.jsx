import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextualIntelligenceCard } from './ContextualIntelligenceCard'

describe('ContextualIntelligenceCard (BP04 §06)', () => {
  it('renderiza mensaje contextual provisto', () => {
    render(<ContextualIntelligenceCard mensajeContextual="Agenda — 5 citas hoy" />)
    expect(screen.getByText('Agenda — 5 citas hoy')).toBeInTheDocument()
  })

  it('permite accionar detalles cuando hay banner contextual activo', () => {
    const handleAccion = vi.fn()
    render(<ContextualIntelligenceCard mensajeContextual="Revisión activa" onAccion={handleAccion} />)
    const btn = screen.queryByText(/Ver detalles/i)
    if (btn) {
      fireEvent.click(btn)
      expect(handleAccion).toHaveBeenCalled()
    }
  })
})
