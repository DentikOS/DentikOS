import { describe, expect, it } from 'vitest'
import { evaluarEstadoPlanTratamiento } from './estadoPlanTratamiento'
import type { FasePlan } from './planOdontogramaGenerator'
import type { PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'

const pacienteId = 'aaaaaaaa-1111-4222-8333-444444444444'
const revision = '2026-10-30T12:00:00.000Z'
const fases = (estado: 'realizado' | 'pendiente'): FasePlan[] => [{
  id: 'fase-urgencias', nombre: 'Urgencias', subtitulo: '',
  procedimientos: [{ id: 'proc-1', descripcion: 'Control', prestacionId: 'prest-1', costo: 10000, requiereRevision: false, estado }]
}]
const presupuesto = (abonado: number, extras: Partial<PresupuestoLocal> = {}): PresupuestoLocal => ({
  id: 'bbbbbbbb-1111-4222-8333-444444444444', pacienteId, origenPlan: true,
  planRevision: revision, versionGrupoId: 'grupo-1', version: 1,
  montoTotal: 10000, montoAbonado: abonado, estado: 'en-curso', sincronizado: true,
  items: [{ id: 'item-1', origenPlanProcedimientoId: 'proc-1', codigoPrestacion: 'prest-1', precioPlanOriginal: 10000 }],
  ...extras
})

describe('estado del plan vinculado', () => {
  it('requiere tratamientos realizados y saldo confirmado en cero', () => {
    expect(evaluarEstadoPlanTratamiento(fases('pendiente'), [presupuesto(10000)], pacienteId, revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [presupuesto(5000)], pacienteId, revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [presupuesto(10000)], pacienteId, revision).completado).toBe(true)
  })

  it('no toma pagos de otro paciente, ítems distintos ni presupuestos pendientes de sincronización', () => {
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [presupuesto(10000)], 'otro-paciente', revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [presupuesto(10000, { items: [] })], pacienteId, revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [presupuesto(10000, { items: [{ id: 'item-1', origenPlanProcedimientoId: 'proc-1', codigoPrestacion: 'prest-1', precioPlanOriginal: 20000 }] })], pacienteId, revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [presupuesto(10000, { sincronizado: false })], pacienteId, revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento([], [presupuesto(10000)], pacienteId, revision).completado).toBe(false)
  })

  it('conserva el vínculo tras una revisión que solo cambia el estado clínico', () => {
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [presupuesto(10000)], pacienteId, 'revision-clinica-nueva').completado).toBe(true)
  })

  it('muestra aprobación solo desde la versión vigente con prestación y precio coincidentes', () => {
    const aprobado = presupuesto(0, { estado: 'aprobado', folio: 'PRE-47' })
    expect(evaluarEstadoPlanTratamiento(fases('pendiente'), [aprobado], pacienteId, revision).aprobaciones['proc-1'])
      .toEqual({ folio: 'PRE-47', version: 1 })
    expect(evaluarEstadoPlanTratamiento(fases('pendiente'), [aprobado,
      presupuesto(0, { id: 'version-2', version: 2, estado: 'borrador' })], pacienteId, revision).aprobaciones['proc-1'])
      .toBeUndefined()
    expect(evaluarEstadoPlanTratamiento(fases('pendiente'), [presupuesto(0, { estado: 'aprobado', items: [] })], pacienteId, revision).aprobaciones['proc-1'])
      .toBeUndefined()
  })

  it('usa la versión vigente de cada presupuesto vinculado y exige todos los saldos cubiertos', () => {
    const versiones = [presupuesto(10000), presupuesto(0, { id: 'version-2', version: 2 })]
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), versiones, pacienteId, revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [
      ...versiones, presupuesto(10000, { id: 'version-3', version: 3 })
    ], pacienteId, revision).completado).toBe(true)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [
      presupuesto(10000), presupuesto(10000, { id: 'version-2', version: 2, estado: 'archivado' })
    ], pacienteId, revision).completado).toBe(false)
    expect(evaluarEstadoPlanTratamiento(fases('realizado'), [], pacienteId, revision).completado).toBe(false)
  })
})
