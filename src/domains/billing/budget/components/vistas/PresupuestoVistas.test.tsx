import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PresupuestoComparativo } from './PresupuestoComparativo'
import { ModoPresentacion } from './ModoPresentacion'
import { SimuladorCuotas } from './SimuladorCuotas'
import { HistorialVersiones } from './HistorialVersiones'
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
})

describe('SimuladorCuotas & HistorialVersiones (BP07 §09, §15)', () => {
  it('renderiza SimuladorCuotas con opciones de 1, 3 y 6 cuotas', () => {
    const onSeleccionar = vi.fn()
    render(<SimuladorCuotas montoTotal={600000} onSeleccionarPlan={onSeleccionar} />)

    expect(screen.getByTestId('simulador-cuotas')).toBeInTheDocument()
    expect(screen.getByTestId('plan-cuotas-1')).toBeInTheDocument()
    expect(screen.getByTestId('plan-cuotas-3')).toBeInTheDocument()
    expect(screen.getByTestId('plan-cuotas-6')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-confirmar-plan-cuotas'))
    expect(onSeleccionar).toHaveBeenCalledWith(
      expect.objectContaining({ cuotas: 3, valorCuota: 200000 })
    )
  })

  it('renderiza HistorialVersiones con SHA-256 y permite expandir diferencias', () => {
    render(<HistorialVersiones folioPresupuesto="PRE-TEST" />)

    expect(screen.getByTestId('historial-versiones')).toBeInTheDocument()
    expect(screen.getByText('v3.0')).toBeInTheDocument()
    expect(screen.getByTestId('diff-version-3')).toBeInTheDocument()
  })
})
