import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PresupuestoComparativo } from './PresupuestoComparativo'
import { ModoPresentacion } from './ModoPresentacion'
import { crearRegistroVersion, compararVersiones } from '../../utils/historialVersiones'
import type { Presupuesto } from '../../schemas/presupuestoSchema'

const mockPresupuesto: Presupuesto = {
  id: 'pres-123',
  folio: 'P-999',
  pacienteNombre: 'Daniela Valdés',
  totalAPagar: 600000,
  estado: 'enviado',
}

describe('PresupuestoComparativo & ModoPresentacion (BP07)', () => {
  it('renderiza 3 opciones alternativas en PresupuestoComparativo', () => {
    render(<PresupuestoComparativo onAprobarOpcion={vi.fn()} />)
    expect(screen.getByTestId('presupuesto-comparativo-modulo')).toBeInTheDocument()
    expect(screen.getByText(/Opción A: Rehabilitación sobre Implantes/i)).toBeInTheDocument()
    expect(screen.getByText(/Opción B: Puente Fijo/i)).toBeInTheDocument()
    expect(screen.getByText(/Opción C: Prótesis Parcial/i)).toBeInTheDocument()
  })

  it('permite aprobar la opción seleccionada', () => {
    const onAprobar = vi.fn()
    render(<PresupuestoComparativo onAprobarOpcion={onAprobar} />)

    fireEvent.click(screen.getByTestId('btn-aprobar-opcion-comparativa'))
    expect(onAprobar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'opc-implante' })
    )
  })

  it('renderiza ModoPresentacion con desglose de cuotas y permite aprobar', () => {
    const onAprobar = vi.fn()
    render(<ModoPresentacion presupuesto={mockPresupuesto} onAprobar={onAprobar} onSalir={vi.fn()} />)

    expect(screen.getByTestId('modo-presentacion-presupuesto')).toBeInTheDocument()
    expect(screen.getByText('$600.000')).toBeInTheDocument()
    expect(screen.getByText('$200.000')).toBeInTheDocument() // 600.000 / 3

    fireEvent.click(screen.getByTestId('btn-aprobar-presentacion'))
    expect(onAprobar).toHaveBeenCalled()
  })

  it('cierra ModoPresentacion al presionar ESC', () => {
    const onSalir = vi.fn()
    render(<ModoPresentacion presupuesto={mockPresupuesto} onSalir={onSalir} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onSalir).toHaveBeenCalled()
  })

  it('crea y compara registros de historial de versiones con hash', () => {
    const v1 = crearRegistroVersion(1, 'Dra. Soto', 'Creación inicial de presupuesto')
    const v2 = crearRegistroVersion(2, 'Dr. Perez', 'Aplicado descuento ISAPRE')

    expect(v1.hash).toMatch(/^VER-1-[A-F0-9]+$/)
    expect(v2.version).toBe(2)

    const diff = compararVersiones(v1, v2)
    expect(diff).toContain('V1 -> V2')
    expect(diff).toContain('Aplicado descuento ISAPRE')
  })
})
