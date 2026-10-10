import { describe, it, expect, vi } from 'vitest'
import {
  puedeIniciarMigracion,
  verificarTodosLosDatosPendientes
} from './dataMigrationValidation'

vi.mock('../../infrastructure/supabase/migrations/migratePacientesToSupabase', () => ({
  verificarPacientesPendientes: vi.fn(() => ({ pendientes: 2, migrados: 1 }))
}))
vi.mock('../../infrastructure/supabase/migrations/migrateCitasToSupabase', () => ({
  verificarCitasPendientes: vi.fn(() => ({ pendientes: 3, sinPacienteMigrado: 0 }))
}))
vi.mock('../../infrastructure/supabase/migrations/migratePresupuestosToSupabase', () => ({
  verificarPresupuestosPendientes: vi.fn(() => ({ pendientes: 1 }))
}))
vi.mock('../../infrastructure/supabase/migrations/migratePagosToSupabase', () => ({
  verificarPagosPendientes: vi.fn(() => ({ globalesPendientes: 4 }))
}))
vi.mock('../../infrastructure/supabase/migrations/migrateMovimientosFinancierosToSupabase', () => ({
  verificarMovimientosPendientes: vi.fn(() => ({ pendientes: 5 }))
}))
vi.mock('../../infrastructure/supabase/migrations/migrateDatosClinicosToSupabase', () => ({
  verificarDatosClinicosPendientes: vi.fn(() => ({ conDatos: 6 }))
}))

describe('dataMigrationValidation', () => {
  describe('puedeIniciarMigracion', () => {
    it('retorna true cuando todas las condiciones se cumplen', () => {
      expect(puedeIniciarMigracion(true, true, { id: 'u1' }, false, false)).toBe(true)
    })

    it('retorna false si useSupabase es false', () => {
      expect(puedeIniciarMigracion(false, true, { id: 'u1' }, false, false)).toBe(false)
    })

    it('retorna false si supabase client no está disponible', () => {
      expect(puedeIniciarMigracion(true, false, { id: 'u1' }, false, false)).toBe(false)
    })

    it('retorna false si no hay userProfile', () => {
      expect(puedeIniciarMigracion(true, true, null, false, false)).toBe(false)
    })

    it('retorna false si ya está en progreso o completada', () => {
      expect(puedeIniciarMigracion(true, true, { id: 'u1' }, true, false)).toBe(false)
      expect(puedeIniciarMigracion(true, true, { id: 'u1' }, false, true)).toBe(false)
    })
  })

  describe('verificarTodosLosDatosPendientes', () => {
    it('suma correctamente todos los pendientes calculados', () => {
      const res = verificarTodosLosDatosPendientes()
      expect(res.pacientes.pendientes).toBe(2)
      expect(res.citas.pendientes).toBe(3)
      expect(res.presupuestos.pendientes).toBe(1)
      expect(res.pagos.globalesPendientes).toBe(4)
      expect(res.movimientos.pendientes).toBe(5)
      expect(res.datosClinicos.conDatos).toBe(6)
      expect(res.total).toBe(2 + 3 + 1 + 4 + 5 + 6)
    })
  })
})
