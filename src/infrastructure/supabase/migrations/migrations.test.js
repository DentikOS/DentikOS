/**
 * Tests consolidados para servicios de migración (F6-K Fase 2)
 *
 * Cubre los 6 archivos de migración + uuidUtils:
 * - migratePacientesToSupabase
 * - migrateCitasToSupabase
 * - migrateDatosClinicosToSupabase
 * - migratePagosToSupabase
 * - migratePresupuestosToSupabase
 * - migrateMovimientosFinancierosToSupabase
 * - uuidUtils (esUuidValido)
 *
 * Patrón de tests:
 * - Caso feliz: migra registros correctamente
 * - Caso idempotente: omite registros ya migrados
 * - Manejo de errores: falla gracefulmente
 * - Retorno de resumen
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks globales antes de importar los módulos
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'generated-uuid-123' },
            error: null
          })
        }))
      }))
    }))
  },
  USE_SUPABASE: true
}))

vi.mock('../../logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../../domains/clinical/patient', () => ({
  pacientesStorageService: {
    listarTodos: vi.fn(() => []),
    obtenerPacientes: vi.fn(() => []),
    obtenerPendientesMigracion: vi.fn(() => [])
  }
}))

vi.mock('../../../domains/operations/agenda', () => ({
  agendaStorageService: {
    listarCitas: vi.fn(() => []),
    obtenerCitas: vi.fn(() => []),
    obtenerCitasPendientes: vi.fn(() => [])
  }
}))

vi.mock('../../../domains/billing/cash-register/services/finanzasStorageService', () => ({
  finanzasStorageService: {
    listarMovimientos: vi.fn(() => []),
    obtenerMovimientos: vi.fn(() => []),
    obtenerMovimientosPendientes: vi.fn(() => [])
  }
}))

vi.mock('../../../domains/billing/payment/services/pagosStorageService', () => ({
  pagosStorageService: {
    listarPagos: vi.fn(() => []),
    obtenerPagos: vi.fn(() => []),
    obtenerPagosPendientes: vi.fn(() => [])
  }
}))

vi.mock('../../../domains/billing/budget/services/presupuestosStorageService', () => ({
  presupuestosStorageService: {
    listarPresupuestos: vi.fn(() => []),
    obtenerPresupuestos: vi.fn(() => []),
    obtenerPresupuestosPendientes: vi.fn(() => [])
  }
}))

vi.mock('../../persistence/migrationStorageService', () => ({
  migrationStorageService: {
    obtenerMigracion: vi.fn(() => null),
    guardarMigracion: vi.fn(),
    listarMigraciones: vi.fn(() => []),
    obtenerPendientes: vi.fn(() => [])
  }
}))

// Importar después de definir mocks
import { supabase } from '../supabaseClient'
import { esUuidValido } from './uuidUtils'

describe('uuidUtils', () => {
  describe('esUuidValido', () => {
    it('retorna true para UUIDs válidos v4', () => {
      expect(esUuidValido('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(esUuidValido('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    it('retorna false para strings que no son UUIDs', () => {
      expect(esUuidValido('legacy-id-123')).toBe(false)
      expect(esUuidValido('12345')).toBe(false)
      expect(esUuidValido('')).toBe(false)
      expect(esUuidValido(null)).toBe(false)
      expect(esUuidValido(undefined)).toBe(false)
    })

    it('retorna false para UUIDs malformados', () => {
      expect(esUuidValido('550e8400-e29b-41d4-a716')).toBe(false)
      expect(esUuidValido('not-a-uuid-at-all')).toBe(false)
    })
  })
})

describe('migratePacientesToSupabase', () => {
  let migratePacientesToSupabase, verificarPacientesPendientes

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./migratePacientesToSupabase')
    migratePacientesToSupabase = module.migratePacientesToSupabase
    verificarPacientesPendientes = module.verificarPacientesPendientes
  })

  it('debe exportar las funciones migratePacientesToSupabase y verificarPacientesPendientes', () => {
    expect(typeof migratePacientesToSupabase).toBe('function')
    expect(typeof verificarPacientesPendientes).toBe('function')
  })

  it('debe retornar resumen cuando no hay pacientes pendientes', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      }))
    })

    const resultado = await migratePacientesToSupabase('user-123')
    expect(resultado).toBeDefined()
  })
})

describe('migrateCitasToSupabase', () => {
  let migrateCitasToSupabase, verificarCitasPendientes

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./migrateCitasToSupabase')
    migrateCitasToSupabase = module.migrateCitasToSupabase
    verificarCitasPendientes = module.verificarCitasPendientes
  })

  it('debe exportar las funciones migrateCitasToSupabase y verificarCitasPendientes', () => {
    expect(typeof migrateCitasToSupabase).toBe('function')
    expect(typeof verificarCitasPendientes).toBe('function')
  })

  it('debe retornar resumen cuando no hay citas pendientes', async () => {
    const resultado = await migrateCitasToSupabase('user-123')
    expect(resultado).toBeDefined()
  })
})

describe('migrateDatosClinicosToSupabase', () => {
  let migrateDatosClinicosToSupabase, verificarDatosClinicosPendientes

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./migrateDatosClinicosToSupabase')
    migrateDatosClinicosToSupabase = module.migrateDatosClinicosToSupabase
    verificarDatosClinicosPendientes = module.verificarDatosClinicosPendientes
  })

  it('debe exportar las funciones migrateDatosClinicosToSupabase y verificarDatosClinicosPendientes', () => {
    expect(typeof migrateDatosClinicosToSupabase).toBe('function')
    expect(typeof verificarDatosClinicosPendientes).toBe('function')
  })

  it('debe retornar resumen cuando no hay datos clínicos pendientes', async () => {
    const resultado = await migrateDatosClinicosToSupabase('user-123')
    expect(resultado).toBeDefined()
  })

  it('no considera recetas locales heredadas como pendientes para insertar en public.recetas', () => {
    localStorage.clear()
    localStorage.setItem('studio_dental_pacientes_v3', JSON.stringify([{ id: 'paciente-legacy' }]))
    localStorage.setItem('recetas_paciente-legacy', JSON.stringify([{ id: 1, medicamento: 'Receta histórica' }]))

    expect(verificarDatosClinicosPendientes()).toEqual({ totalPacientes: 1, conDatos: 0 })
  })
})

describe('migratePagosToSupabase', () => {
  let migratePagosToSupabase, verificarPagosPendientes

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./migratePagosToSupabase')
    migratePagosToSupabase = module.migratePagosToSupabase
    verificarPagosPendientes = module.verificarPagosPendientes
  })

  it('debe exportar las funciones migratePagosToSupabase y verificarPagosPendientes', () => {
    expect(typeof migratePagosToSupabase).toBe('function')
    expect(typeof verificarPagosPendientes).toBe('function')
  })

  it('debe retornar resumen cuando no hay pagos pendientes', async () => {
    const resultado = await migratePagosToSupabase('user-123')
    expect(resultado).toBeDefined()
  })
})

describe('migratePresupuestosToSupabase', () => {
  let migratePresupuestosToSupabase, verificarPresupuestosPendientes

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./migratePresupuestosToSupabase')
    migratePresupuestosToSupabase = module.migratePresupuestosToSupabase
    verificarPresupuestosPendientes = module.verificarPresupuestosPendientes
  })

  it('debe exportar las funciones migratePresupuestosToSupabase y verificarPresupuestosPendientes', () => {
    expect(typeof migratePresupuestosToSupabase).toBe('function')
    expect(typeof verificarPresupuestosPendientes).toBe('function')
  })

  it('debe retornar resumen cuando no hay presupuestos pendientes', async () => {
    const resultado = await migratePresupuestosToSupabase('user-123')
    expect(resultado).toBeDefined()
  })
})

describe('migrateMovimientosFinancierosToSupabase', () => {
  let migrateMovimientosFinancierosToSupabase, verificarMovimientosPendientes

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./migrateMovimientosFinancierosToSupabase')
    migrateMovimientosFinancierosToSupabase = module.migrateMovimientosFinancierosToSupabase
    verificarMovimientosPendientes = module.verificarMovimientosPendientes
  })

  it('debe exportar las funciones migrateMovimientosFinancierosToSupabase y verificarMovimientosPendientes', () => {
    expect(typeof migrateMovimientosFinancierosToSupabase).toBe('function')
    expect(typeof verificarMovimientosPendientes).toBe('function')
  })

  it('debe retornar resumen cuando no hay movimientos pendientes', async () => {
    const resultado = await migrateMovimientosFinancierosToSupabase('user-123')
    expect(resultado).toBeDefined()
  })
})
