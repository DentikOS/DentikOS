import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sincronizarCacheSupabase, ejecutarPasosMigracion } from './dataMigrationUtils'
import { pacientesStorageService } from '../../domains/clinical/patient'
import { agendaStorageService } from '../../domains/operations/agenda'
import { presupuestosStorageService } from '../../domains/billing/budget/services/presupuestosStorageService'
import { pagosStorageService } from '../../domains/billing/payment/services/pagosStorageService'
import { finanzasStorageService } from '../../domains/billing/cash-register/services/finanzasStorageService'
import { migratePacientesToSupabase } from '../../infrastructure/supabase/migrations/migratePacientesToSupabase'
import { migrateCitasToSupabase } from '../../infrastructure/supabase/migrations/migrateCitasToSupabase'
import { migratePresupuestosToSupabase } from '../../infrastructure/supabase/migrations/migratePresupuestosToSupabase'
import { migratePagosToSupabase } from '../../infrastructure/supabase/migrations/migratePagosToSupabase'
import { migrateMovimientosFinancierosToSupabase } from '../../infrastructure/supabase/migrations/migrateMovimientosFinancierosToSupabase'
import { migrateDatosClinicosToSupabase } from '../../infrastructure/supabase/migrations/migrateDatosClinicosToSupabase'

vi.mock('../../infrastructure/supabase/migrations/migratePacientesToSupabase', () => ({
  migratePacientesToSupabase: vi.fn(async () => ({ errores: [] }))
}))
vi.mock('../../infrastructure/supabase/migrations/migrateCitasToSupabase', () => ({
  migrateCitasToSupabase: vi.fn(async () => ({ errores: [] }))
}))
vi.mock('../../infrastructure/supabase/migrations/migratePresupuestosToSupabase', () => ({
  migratePresupuestosToSupabase: vi.fn(async () => ({ errores: [] }))
}))
vi.mock('../../infrastructure/supabase/migrations/migratePagosToSupabase', () => ({
  migratePagosToSupabase: vi.fn(async () => ({ errores: [] }))
}))
vi.mock('../../infrastructure/supabase/migrations/migrateMovimientosFinancierosToSupabase', () => ({
  migrateMovimientosFinancierosToSupabase: vi.fn(async () => ({ errores: [] }))
}))
vi.mock('../../infrastructure/supabase/migrations/migrateDatosClinicosToSupabase', () => ({
  migrateDatosClinicosToSupabase: vi.fn(async () => ({ errores: [] }))
}))

vi.mock('../../domains/clinical/patient', () => ({
  pacientesStorageService: {
    sincronizarDesdeSupabase: vi.fn(async () => {}),
    obtenerPacientes: vi.fn(() => [{ id: 'p1', nombre: 'Test' }])
  }
}))
vi.mock('../../domains/operations/agenda', () => ({
  agendaStorageService: {
    sincronizarDesdeSupabase: vi.fn(async () => {})
  }
}))
vi.mock('../../domains/billing/budget/services/presupuestosStorageService', () => ({
  presupuestosStorageService: {
    sincronizarDesdeSupabase: vi.fn(async () => {})
  }
}))
vi.mock('../../domains/billing/payment/services/pagosStorageService', () => ({
  pagosStorageService: {
    sincronizarDesdeSupabase: vi.fn(async () => {})
  }
}))
vi.mock('../../domains/billing/cash-register/services/finanzasStorageService', () => ({
  finanzasStorageService: {
    sincronizarDesdeSupabase: vi.fn(async () => {})
  }
}))

describe('dataMigrationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sincronizarCacheSupabase sincroniza todos los servicios', async () => {
    await sincronizarCacheSupabase()
    expect(pacientesStorageService.sincronizarDesdeSupabase).toHaveBeenCalled()
    expect(agendaStorageService.sincronizarDesdeSupabase).toHaveBeenCalled()
    expect(presupuestosStorageService.sincronizarDesdeSupabase).toHaveBeenCalled()
    expect(pagosStorageService.sincronizarDesdeSupabase).toHaveBeenCalled()
    expect(finanzasStorageService.sincronizarDesdeSupabase).toHaveBeenCalled()
  })

  it('ejecutarPasosMigracion solo llama migradores con pendientes > 0', async () => {
    const mockPendientes = {
      pacientes: { pendientes: 2 } as any,
      citas: { pendientes: 0 } as any,
      presupuestos: { pendientes: 1 } as any,
      pagos: { globalesPendientes: 0 } as any,
      movimientos: { pendientes: 3 } as any,
      datosClinicos: { conDatos: 0 } as any,
      total: 6
    }

    await ejecutarPasosMigracion('user-123', mockPendientes)

    expect(migratePacientesToSupabase).toHaveBeenCalledWith('user-123')
    expect(migrateCitasToSupabase).not.toHaveBeenCalled()
    expect(migratePresupuestosToSupabase).toHaveBeenCalledWith('user-123')
    expect(migratePagosToSupabase).not.toHaveBeenCalled()
    expect(migrateMovimientosFinancierosToSupabase).toHaveBeenCalledWith('user-123')
    expect(migrateDatosClinicosToSupabase).not.toHaveBeenCalled()
  })
})
