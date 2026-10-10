import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PlanTratamiento } from './PlanTratamiento'

describe('PlanTratamiento BP06', () => {
  it('renderiza las 4 fases clínicas completas', () => {
    render(<PlanTratamiento nombrePaciente="María Valenzuela" />)
    expect(screen.getByTestId('plan-tratamiento-bp06')).toBeInTheDocument()
    expect(screen.getByText(/Fase 1: Urgencias/i)).toBeInTheDocument()
    expect(screen.getByText(/Fase 2: Estabilización/i)).toBeInTheDocument()
    expect(screen.getByText(/Fase 3: Rehabilitación/i)).toBeInTheDocument()
    expect(screen.getByText(/Fase 4: Estética/i)).toBeInTheDocument()
  })

  it('permite cambiar el estado de un procedimiento en el plan', () => {
    render(<PlanTratamiento />)
    const selectEstado = screen.getAllByRole('combobox')[0]
    fireEvent.change(selectEstado, { target: { value: 'aprobado' } })
    expect(selectEstado).toHaveValue('aprobado')
  })

  it('abre la ficha de derivación al presionar el botón', () => {
    render(<PlanTratamiento nombrePaciente="María Valenzuela" />)
    fireEvent.click(screen.getByText('Ficha Derivación'))
    expect(screen.getByTestId('modal-ficha-derivacion')).toBeInTheDocument()
  })

  it('dispara onGenerarPresupuesto con las 4 fases', () => {
    const onGenerar = vi.fn()
    render(<PlanTratamiento onGenerarPresupuesto={onGenerar} />)
    fireEvent.click(screen.getByTestId('btn-generar-presupuesto-plan'))
    expect(onGenerar).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'fase-urgencias' }),
    ]))
  })


  it('muestra mensaje cuando el odontograma no tiene patologías', async () => {
    const { useOdontogramaStore } = await import('../../../../../../app/stores/odontogramaStore')
    useOdontogramaStore.getState().setOdontograma({ piezas: [] })
    render(<PlanTratamiento />)
    expect(screen.getByText('No hay patologías registradas')).toBeInTheDocument()
  })
})
