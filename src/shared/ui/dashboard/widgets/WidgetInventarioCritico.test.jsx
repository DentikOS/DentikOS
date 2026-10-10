import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetInventarioCritico } from './WidgetInventarioCritico'

describe('WidgetInventarioCritico (BP04 §03)', () => {
  it('renderiza items con stock bajo y agotado', () => {
    const mockItems = [
      { id: '1', nombre: 'Lidocaína 2%', cantidad: 2, minimoCritico: 10, unidad: 'tubos' },
      { id: '2', nombre: 'Agujas Cortas', cantidad: 0, minimoCritico: 5, unidad: 'cajas' }
    ]

    render(<WidgetInventarioCritico items={mockItems} />)

    expect(screen.getByText(/Inventario Crítico/i)).toBeInTheDocument()
    expect(screen.getByText('Lidocaína 2%')).toBeInTheDocument()
    expect(screen.getByText('Agujas Cortas')).toBeInTheDocument()
    expect(screen.getByText('2 tubos')).toBeInTheDocument()
    expect(screen.getByText('Agotado')).toBeInTheDocument()
    expect(screen.getByText(/2 en reposición/i)).toBeInTheDocument()
  })

  it('renderiza mensaje cuando no hay insumos críticos', () => {
    render(<WidgetInventarioCritico items={[]} />)
    expect(screen.getByText(/Stock de insumos en niveles óptimos/i)).toBeInTheDocument()
  })

  it('ejecuta onIrInventario al hacer click en el enlace inferior', () => {
    const handleIr = vi.fn()
    render(<WidgetInventarioCritico items={[]} onIrInventario={handleIr} />)

    fireEvent.click(screen.getByText(/Gestionar Stock e Insumos/i))
    expect(handleIr).toHaveBeenCalled()
  })

  it('ejecuta onIrInventario al hacer click en un item de inventario', () => {
    const handleIr = vi.fn()
    render(
      <WidgetInventarioCritico
        items={[{ id: '1', nombre: 'Guantes M', cantidad: 1, minimoCritico: 5 }]}
        onIrInventario={handleIr}
      />
    )

    fireEvent.click(screen.getByText('Guantes M'))
    expect(handleIr).toHaveBeenCalled()
  })
})
