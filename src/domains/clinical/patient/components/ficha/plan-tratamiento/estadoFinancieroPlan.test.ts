import { describe, expect, it } from 'vitest'
import type { SnapshotImputacionesPresupuesto } from '../../../../../billing/budget/services/imputacionesPagoService'
import type { PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'
import type { FasePlan } from './planOdontogramaGenerator'
import { evaluarEstadoFinancieroProcedimientos } from './estadoFinancieroPlan'

const presupuesto = (extras: Partial<PresupuestoLocal> = {}): PresupuestoLocal => ({
  id: 'budget-1',
  pacienteId: 'patient-1',
  sincronizado: true,
  items: [{ id: 'item-1', origenPlanProcedimientoId: 'proc-1' }],
  ...extras,
})

const fases: FasePlan[] = [{
  id: 'fase-1', nombre: 'Fase 1', subtitulo: '',
  procedimientos: [{
    id: 'proc-1', descripcion: 'Tratamiento', costo: 10000,
    requiereRevision: false, estado: 'pendiente',
  }],
}]

const snapshot = (montoNeto: number, montoImputado: number): SnapshotImputacionesPresupuesto => ({
  presupuestoId: 'budget-1', pagos: [], imputaciones: [],
  items: [{
    id: 'item-1', nombre: 'Tratamiento', valorBruto: montoNeto,
    montoNeto, montoImputado, saldoPendiente: montoNeto - montoImputado,
    estadoFinanciero: montoImputado === montoNeto ? 'pagado' : montoImputado > 0 ? 'parcial' : 'pendiente',
  }],
})

describe('estado financiero de prestaciones del plan', () => {
  it('no marca pagada una prestación si el abono sigue sin imputarse', () => {
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto()], {
      'budget-1': snapshot(10000, 0),
    })['proc-1']).toBe('pendiente')
  })

  it('muestra pendiente, parcial y pagado según la imputación confirmada', () => {
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto()], {
      'budget-1': snapshot(10000, 0),
    })['proc-1']).toBe('pendiente')
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto()], {
      'budget-1': snapshot(10000, 4000),
    })['proc-1']).toBe('parcial')
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto()], {
      'budget-1': snapshot(10000, 10000),
    })['proc-1']).toBe('pagado')
  })

  it('fail-closed si el presupuesto no está sincronizado o el servidor no entrega su ítem', () => {
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto({ sincronizado: false })], {
      'budget-1': snapshot(10000, 10000),
    })['proc-1']).toBe('no_disponible')
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto()], {
      'budget-1': { ...snapshot(10000, 10000), items: [] },
    })['proc-1']).toBe('no_disponible')
  })

  it('distingue una prestación sin presupuesto, una lectura en curso y un costo cubierto por descuento', () => {
    expect(evaluarEstadoFinancieroProcedimientos(fases, [], {})['proc-1']).toBe('sin_presupuesto')
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto()], {}, true)['proc-1']).toBe('consultando')
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto()], {
      'budget-1': snapshot(0, 0),
    })['proc-1']).toBe('sin_saldo')
  })

  it('suma las versiones vigentes vinculadas al mismo procedimiento', () => {
    const otro = presupuesto({
      id: 'budget-2',
      items: [{ id: 'item-2', origenPlanProcedimientoId: 'proc-1' }],
    })
    const segundoSnapshot: SnapshotImputacionesPresupuesto = {
      ...snapshot(5000, 5000),
      presupuestoId: 'budget-2',
      items: [{ ...snapshot(5000, 5000).items[0], id: 'item-2' }],
    }
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto(), otro], {
      'budget-1': snapshot(5000, 5000),
      'budget-2': segundoSnapshot,
    })['proc-1']).toBe('pagado')
    expect(evaluarEstadoFinancieroProcedimientos(fases, [presupuesto(), otro], {
      'budget-1': snapshot(5000, 5000),
      'budget-2': { ...segundoSnapshot, items: [{ ...segundoSnapshot.items[0], montoImputado: 0 }] },
    })['proc-1']).toBe('parcial')
  })
})
