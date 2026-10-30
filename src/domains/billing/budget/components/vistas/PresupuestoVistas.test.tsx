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
  const opciones = [
    { id: 'opcion-clinica', nombre: 'Alternativa registrada', descripcion: 'Descripción clínica', tiempoEstimado: 'Según evaluación', beneficios: [], total: 100000 },
  ]

  it('sin opciones registradas no inventa tratamientos', () => {
    render(<PresupuestoComparativo onAprobarOpcion={vi.fn()} />)
    expect(screen.getByTestId('presupuesto-comparativo-modulo')).toBeInTheDocument()
    expect(screen.getByText(/No hay alternativas clínicas registradas/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-aprobar-opcion-comparativa')).toBeDisabled()
  })

  it('permite aprobar la opción seleccionada', () => {
    const onAprobar = vi.fn()
    render(<PresupuestoComparativo opciones={opciones} onAprobarOpcion={onAprobar} />)

    fireEvent.click(screen.getByText('Alternativa registrada'))
    fireEvent.click(screen.getByTestId('btn-aprobar-opcion-comparativa'))
    expect(onAprobar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'opcion-clinica' })
    )
  })

  it('renderiza ModoPresentacion con total real y permite aprobar', () => {
    const onAprobar = vi.fn()
    render(<ModoPresentacion presupuesto={mockPresupuesto} onAprobar={onAprobar} onSalir={vi.fn()} />)

    expect(screen.getByTestId('modo-presentacion-presupuesto')).toBeInTheDocument()
    expect(screen.getByText('$600.000')).toBeInTheDocument()
    expect(screen.queryByText('$200.000')).not.toBeInTheDocument()

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

  it('historial vacío no inventa versiones; permite expandir diferencias reales', () => {
    const { rerender } = render(<HistorialVersiones folioPresupuesto="PRE-TEST" />)

    expect(screen.getByTestId('historial-versiones')).toBeInTheDocument()
    expect(screen.getByText(/No hay versiones registradas/i)).toBeInTheDocument()
    rerender(<HistorialVersiones folioPresupuesto="PRE-TEST" versiones={[{
      version: 3, fecha: '2026-10-30T12:00:00Z', usuario: 'Dentista',
      tipoModificacion: 'Edición', motivo: 'Corrección', totalAnterior: 90000,
      totalNuevo: 100000, hashSha256: 'sha256', cambios: ['Corrección de monto'],
    }]} />)
    expect(screen.getByText('v3.0')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-expandir-version-3'))
    expect(screen.getByTestId('diff-version-3')).toBeInTheDocument()
  })
})
