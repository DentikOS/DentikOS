import { describe, it, expect, beforeEach } from 'vitest'
import { usePresupuestosStore } from './presupuestosStore'

describe('usePresupuestosStore (BP07)', () => {
  beforeEach(() => {
    usePresupuestosStore.setState({
      presupuestos: [],
      presupuestoActivo: null,
      vistaActual: 'simplificada',
    })
  })

  it('crea un presupuesto con folio automático y valores base', () => {
    const store = usePresupuestosStore.getState()
    const p = store.crearPresupuesto({
      pacienteNombre: 'Rosa Martínez',
      pacienteRut: '14.567.890-1',
    })

    expect(p.id).toBeDefined()
    expect(p.folio).toBe('P-001')
    expect(p.estado).toBe('borrador')
    expect(usePresupuestosStore.getState().presupuestos.length).toBe(1)
  })

  it('actualiza el estado del presupuesto y registra fechas de transición', () => {
    const store = usePresupuestosStore.getState()
    const p = store.crearPresupuesto({ pacienteNombre: 'Rosa Martínez' })

    store.cambiarEstado(p.id, 'enviado')
    const actualizado = usePresupuestosStore.getState().presupuestos[0]
    expect(actualizado.estado).toBe('enviado')
    expect(actualizado.fechaEnvio).toBeDefined()
  })

  it('registra un pago y transiciona estado a completado si saldo es cubierto', () => {
    const store = usePresupuestosStore.getState()
    const p = store.crearPresupuesto({
      pacienteNombre: 'Rosa Martínez',
      totalAPagar: 100000,
    })

    store.registrarPago(p.id, {
      presupuestoId: p.id,
      monto: 100000,
      metodoPago: 'transferencia',
      fechaPago: new Date().toISOString(),
    })

    const actualizado = usePresupuestosStore.getState().presupuestos[0]
    expect(actualizado.montoAbonado).toBe(100000)
    expect(actualizado.estado).toBe('completado')
  })

  it('genera un presupuesto a partir de items del plan de tratamiento', () => {
    const store = usePresupuestosStore.getState()
    const itemsPlan = [
      { id: '1', nombre: 'Endodoncia', costo: 180000 },
      { id: '2', nombre: 'Corona', costo: 250000 },
    ]

    const nuevo = store.generarDesdePlanTratamiento('pac-99', 'Rosa Martínez', itemsPlan)
    expect(nuevo.totalAPagar).toBe(430000)
    expect(nuevo.items?.length).toBe(2)
  })
})
