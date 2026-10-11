import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVinculacionPlanTratamiento } from './useVinculacionPlanTratamiento'
import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'

describe('useVinculacionPlanTratamiento (BP06 <-> BP07)', () => {
  beforeEach(() => {
    usePresupuestosStore.setState({
      presupuestos: [],
    })
  })

  it('convierte procedimientos clínicos a items de presupuesto', () => {
    const { result } = renderHook(() => useVinculacionPlanTratamiento())
    const procs = [
      { id: 'p1', descripcion: 'Obturación Resina', pieza: '1.4', costo: 40000, estado: 'pendiente' as const },
      { id: 'p2', descripcion: 'Corona Porcelana', pieza: '1.6', costo: 250000, estado: 'pendiente' as const },
    ]

    const items = result.current.convertirProcedimientosAItems(procs)
    expect(items.length).toBe(2)
    expect(items[0].nombrePrestacion).toBe('Obturación Resina')
    expect(items[0].subtotal).toBe(40000)
  })

  it('genera un presupuesto a partir del plan de tratamiento', () => {
    const { result } = renderHook(() => useVinculacionPlanTratamiento())
    const procs = [
      { id: 'p1', descripcion: 'Destartraje', costo: 35000, estado: 'aprobado' as const },
    ]

    let nuevoPresupuesto
    act(() => {
      nuevoPresupuesto = result.current.generarPresupuestoDesdePlan(
        'pac-50',
        'Felipe Muñoz',
        procs,
        'plan-123'
      )
    })

    expect(nuevoPresupuesto?.totalAPagar).toBe(35000)
    expect(nuevoPresupuesto?.pacienteNombre).toBe('Felipe Muñoz')
    expect(nuevoPresupuesto?.planTratamientoId).toBe('plan-123')
  })
})
