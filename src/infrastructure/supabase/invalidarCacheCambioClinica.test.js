/**
 * Tests de invalidarCacheCambioClinica — F7-36 FASE 1 (Commit 1.3)
 *
 * Cubre los 5 pasos fail-safe:
 *   1. tenantCache (claves tenant-aware)
 *   2. 4 storage services (cache en memoria)
 *   3. 2 stores Zustand
 *   4. claves legacy localStorage
 *   5. IndexedDB
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock de tenantCache
vi.mock('../tenant/tenantCache', () => ({
  tenantCache: {
    invalidarClinica: vi.fn(() => 5),
    invalidarTodas: vi.fn(() => 10),
  },
}))

// Mock de los 4 storage services
vi.mock('../../domains/billing/cash-register/services/finanzasStorageService', () => ({
  finanzasStorageService: { resetCache: vi.fn() },
}))
vi.mock('../../domains/operations/agenda/services/agendaStorageService', () => ({
  agendaStorageService: { resetCache: vi.fn() },
}))
vi.mock('../../domains/billing/payment/services/pagosStorageService', () => ({
  pagosStorageService: { resetCache: vi.fn() },
}))
vi.mock('../../domains/billing/budget/services/presupuestosStorageService', () => ({
  presupuestosStorageService: { resetCache: vi.fn() },
}))

// Mock de stores Zustand
vi.mock('../../app/stores/pacientesStore', () => ({
  usePacientesStore: { setState: vi.fn() },
}))
vi.mock('../../app/stores/prestacionesStore', () => ({
  usePrestacionesStore: { setState: vi.fn() },
}))

vi.mock('../storage/adjuntosStorageService', () => ({
  invalidarCacheAdjuntos: vi.fn(async () => ({ eliminados: 3, conservadosPendientes: true })),
}))

// Importar mocks y servicio
import { tenantCache } from '../tenant/tenantCache'
import { finanzasStorageService } from '../../domains/billing/cash-register/services/finanzasStorageService'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { pagosStorageService } from '../../domains/billing/payment/services/pagosStorageService'
import { presupuestosStorageService } from '../../domains/billing/budget/services/presupuestosStorageService'
import { usePacientesStore } from '../../app/stores/pacientesStore'
import { usePrestacionesStore } from '../../app/stores/prestacionesStore'
import { invalidarCacheAdjuntos } from '../storage/adjuntosStorageService'
import { invalidarCacheCambioClinica } from './invalidarCacheCambioClinica'

/**
 * Crea un mock de indexedDB.deleteDatabase que llama al callback correcto.
 * @param {'success' | 'error' | 'blocked'} resultado - Qué callback invocar
 */
const mockIndexedDB = (resultado = 'success') => {
  global.indexedDB = {
    deleteDatabase: vi.fn((_dbName) => {
      const request = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      }
      // Usar queueMicrotask para llamar al callback después de que se asignen
      queueMicrotask(() => {
        if (resultado === 'success' && request.onsuccess) {
          request.onsuccess({ target: { result: undefined } })
        } else if (resultado === 'error' && request.onerror) {
          request.onerror({ target: { error: new Error('DB error') } })
        } else if (resultado === 'blocked' && request.onblocked) {
          request.onblocked()
        }
      })
      return request
    }),
  }
}

describe('invalidarCacheCambioClinica', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockIndexedDB('success')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Paso 1: tenantCache', () => {
    it('llama a invalidarClinica() con el ID de clínica anterior', async () => {
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(tenantCache.invalidarClinica).toHaveBeenCalledWith('clinica-uuid-123')
      expect(result.tenantKeys).toBe(5)
    })

    it('usa invalidarTodas() cuando no hay clínica anterior', async () => {
      const result = await invalidarCacheCambioClinica(null)
      expect(tenantCache.invalidarTodas).toHaveBeenCalled()
      expect(result.tenantKeys).toBe(10)
    })

    it('continúa aunque tenantCache falle', async () => {
      tenantCache.invalidarClinica.mockImplementation(() => {
        throw new Error('Tenant error')
      })
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.tenantKeys).toBe(0)
      // Los otros pasos deben continuar
      expect(result.storageServices).toBeGreaterThan(0)
    })
  })

  describe('Paso 2: 4 storage services', () => {
    it('llama a resetCache() de los 4 servicios', async () => {
      await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(finanzasStorageService.resetCache).toHaveBeenCalled()
      expect(agendaStorageService.resetCache).toHaveBeenCalled()
      expect(pagosStorageService.resetCache).toHaveBeenCalled()
      expect(presupuestosStorageService.resetCache).toHaveBeenCalled()
    })

    it('cuenta correctamente los servicios reseteados', async () => {
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.storageServices).toBe(4)
    })

    it('continúa aunque un servicio falle', async () => {
      finanzasStorageService.resetCache.mockImplementation(() => {
        throw new Error('Service error')
      })
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.storageServices).toBe(3) // 3 de 4 exitosos
      // Los otros servicios deben continuar
      expect(agendaStorageService.resetCache).toHaveBeenCalled()
    })
  })

  describe('Paso 3: stores Zustand', () => {
    it('resetea pacientesStore y prestacionesStore', async () => {
      await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(usePacientesStore.setState).toHaveBeenCalledWith({ pacientes: [] })
      expect(usePrestacionesStore.setState).toHaveBeenCalledWith({ prestacionesArancel: [] })
    })

    it('retorna nombres de stores reseteados', async () => {
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.stores).toContain('pacientesStore')
      expect(result.stores).toContain('prestacionesStore')
      expect(result.stores).toHaveLength(2)
    })

    it('continúa aunque un store falle', async () => {
      usePacientesStore.setState.mockImplementation(() => {
        throw new Error('Store error')
      })
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.stores).toHaveLength(1) // Solo prestacionesStore
      expect(result.stores).toContain('prestacionesStore')
    })
  })

  describe('Paso 4: claves clínicas (legacy + por paciente + específicas)', () => {
    it('elimina claves legacy studio_dental_', async () => {
      localStorage.setItem('studio_dental_pacientes', 'datos')
      localStorage.setItem('studio_dental_citas', 'datos')
      localStorage.setItem('darkMode', 'true') // No debe eliminarse
      localStorage.setItem('otro_prefijo', 'datos') // No debe eliminarse

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      expect(result.legacyKeys).toBe(2)
      expect(localStorage.getItem('studio_dental_pacientes')).toBeNull()
      expect(localStorage.getItem('studio_dental_citas')).toBeNull()
      expect(localStorage.getItem('darkMode')).toBe('true') // Preservado
      expect(localStorage.getItem('otro_prefijo')).toBe('datos') // Preservado
    })

    it('elimina claves por pacienteId (PHI)', async () => {
      localStorage.setItem('recetas_uuid-123', 'receta1')
      localStorage.setItem('recetas_uuid-456', 'receta2')
      localStorage.setItem('evoluciones_notas_uuid-123', 'evolucion1')
      localStorage.setItem('certificados_uuid-789', 'certificado1')
      localStorage.setItem('odonto_inicial_uuid-abc', 'odonto1')
      localStorage.setItem('odonto_evolucion_uuid-def', 'odonto2')
      localStorage.setItem('periodontograma_uuid-ghi', 'periodonto1')
      localStorage.setItem('periodonto_historial_uuid-jkl', 'historial1')
      localStorage.setItem('pediatria_uuid-mno', 'pediatria1')
      localStorage.setItem('quirurgico_implantes_uuid-pqr', 'implante1')
      localStorage.setItem('quirurgico_endodoncia_uuid-stu', 'endodoncia1')
      localStorage.setItem('dsd_uuid-vwx', 'dsd1')

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      expect(result.patientKeys).toBe(12)
      expect(localStorage.getItem('recetas_uuid-123')).toBeNull()
      expect(localStorage.getItem('evoluciones_notas_uuid-123')).toBeNull()
      expect(localStorage.getItem('certificados_uuid-789')).toBeNull()
      expect(localStorage.getItem('odonto_inicial_uuid-abc')).toBeNull()
      expect(localStorage.getItem('periodontograma_uuid-ghi')).toBeNull()
      expect(localStorage.getItem('pediatria_uuid-mno')).toBeNull()
      expect(localStorage.getItem('quirurgico_implantes_uuid-pqr')).toBeNull()
      expect(localStorage.getItem('dsd_uuid-vwx')).toBeNull()
    })

    it('elimina claves específicas de estado clínico', async () => {
      localStorage.setItem('clinica_paciente_seleccionado_id', 'uuid-yza')
      localStorage.setItem('clinica_active_section', 'Dashboard')

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      expect(result.explicitKeys).toBe(2)
      expect(localStorage.getItem('clinica_paciente_seleccionado_id')).toBeNull()
      expect(localStorage.getItem('clinica_active_section')).toBeNull()
    })

    it('PRESERVA claves del usuario (profile_, auth tokens)', async () => {
      localStorage.setItem('profile_user@test.com', JSON.stringify({ email: 'user@test.com' }))
      localStorage.setItem('clinica_active_user', 'user@test.com')
      localStorage.setItem('sb-abc123-auth-token', 'token-supabase')
      localStorage.setItem('goTrue-legacy', 'legacy-token')

      await invalidarCacheCambioClinica('clinica-uuid-123')

      // Todas estas claves deben preservarse
      expect(localStorage.getItem('profile_user@test.com')).not.toBeNull()
      expect(localStorage.getItem('clinica_active_user')).toBe('user@test.com')
      expect(localStorage.getItem('sb-abc123-auth-token')).toBe('token-supabase')
      expect(localStorage.getItem('goTrue-legacy')).toBe('legacy-token')
    })

    it('cuenta correctamente las claves legacy eliminadas', async () => {
      localStorage.setItem('studio_dental_a', '1')
      localStorage.setItem('studio_dental_b', '2')
      localStorage.setItem('studio_dental_c', '3')

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.legacyKeys).toBe(3)
    })

    it('cuenta correctamente las claves por paciente eliminadas', async () => {
      localStorage.setItem('recetas_uuid-1', 'r1')
      localStorage.setItem('recetas_uuid-2', 'r2')
      localStorage.setItem('certificados_uuid-3', 'c1')

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.patientKeys).toBe(3)
    })

    it('cuenta mix de legacy + por paciente + explícitas', async () => {
      localStorage.setItem('studio_dental_x', 'legacy')
      localStorage.setItem('recetas_uuid-1', 'paciente')
      localStorage.setItem('clinica_paciente_seleccionado_id', 'uuid')

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.legacyKeys).toBe(1)
      expect(result.patientKeys).toBe(1)
      expect(result.explicitKeys).toBe(1)
    })
  })

  describe('Paso 5: IndexedDB', () => {
    it('invoca invalidarCacheAdjuntos con la clínica anterior de forma no destructiva', async () => {
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      expect(invalidarCacheAdjuntos).toHaveBeenCalledWith('clinica-uuid-123')
      expect(result.indexedDB.eliminada).toBe(true)
    })

    it('maneja correctamente cuando indexedDB no está disponible', async () => {
      delete global.indexedDB

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      expect(result.indexedDB.eliminada).toBe(false)
      expect(result.indexedDB.razon).toBe('indexedDB no disponible')
    })

    it('cuenta como error si invalidarCacheAdjuntos falla', async () => {
      invalidarCacheAdjuntos.mockRejectedValueOnce(new Error('IDB error'))

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      expect(result.indexedDB.eliminada).toBe(false)
      expect(result.errores).toBe(1)
    })
  })

  describe('Resumen estructurado', () => {
    it('retorna resumen completo con todos los conteos', async () => {
      localStorage.setItem('studio_dental_legacy', 'datos')
      localStorage.setItem('recetas_uuid-1', 'r1')
      localStorage.setItem('clinica_paciente_seleccionado_id', 'uuid')

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      expect(result).toHaveProperty('tenantKeys')
      expect(result).toHaveProperty('storageServices')
      expect(result).toHaveProperty('stores')
      expect(result).toHaveProperty('legacyKeys')
      expect(result).toHaveProperty('patientKeys')
      expect(result).toHaveProperty('explicitKeys')
      expect(result).toHaveProperty('indexedDB')
      expect(result).toHaveProperty('errores')

      expect(typeof result.tenantKeys).toBe('number')
      expect(typeof result.storageServices).toBe('number')
      expect(Array.isArray(result.stores)).toBe(true)
      expect(typeof result.legacyKeys).toBe('number')
      expect(typeof result.patientKeys).toBe('number')
      expect(typeof result.explicitKeys).toBe('number')
      expect(typeof result.indexedDB).toBe('object')
      expect(typeof result.errores).toBe('number')
    })

    it('errores es 0 cuando todos los pasos son exitosos', async () => {
      const result = await invalidarCacheCambioClinica('clinica-uuid-123')
      expect(result.errores).toBe(0)
      expect(result.legacyKeys).toBeGreaterThanOrEqual(0)
      expect(result.patientKeys).toBeGreaterThanOrEqual(0)
      expect(result.explicitKeys).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Fail-safe behavior', () => {
    it('todos los pasos continúan aunque uno falle', async () => {
      // Hacer fallar pasos 1, 2, 3
      tenantCache.invalidarClinica.mockImplementation(() => {
        throw new Error('Tenant error')
      })
      finanzasStorageService.resetCache.mockImplementation(() => {
        throw new Error('Service error')
      })
      usePacientesStore.setState.mockImplementation(() => {
        throw new Error('Store error')
      })

      const result = await invalidarCacheCambioClinica('clinica-uuid-123')

      // Paso 4 (legacy) y 5 (IndexedDB) deben continuar
      expect(result.legacyKeys).toBeGreaterThanOrEqual(0)
      expect(result.indexedDB).toBeDefined()

      // Los otros storage services deben continuar
      expect(agendaStorageService.resetCache).toHaveBeenCalled()
      expect(pagosStorageService.resetCache).toHaveBeenCalled()
      expect(presupuestosStorageService.resetCache).toHaveBeenCalled()

      // El otro store debe continuar
      expect(usePrestacionesStore.setState).toHaveBeenCalled()
    })
  })

  describe('Seguridad F7-36: Escenario de filtración cross-clinic (crítico)', () => {
    it('previene filtración de PHI entre clínicas al cambiar clínica', async () => {
      // Simula: Usuario en Clínica A con datos clínicos de 3 pacientes
      localStorage.setItem('recetas_paciente-uuid-A1', JSON.stringify([{ medicamento: 'Ibuprofeno' }]))
      localStorage.setItem('evoluciones_notas_paciente-uuid-A2', 'Evolución con diagnóstico confidencial')
      localStorage.setItem('certificados_paciente-uuid-A3', 'Certificado médico')
      localStorage.setItem('odonto_inicial_paciente-uuid-A1', JSON.stringify({ dientes: '11,12' }))
      localStorage.setItem('clinica_paciente_seleccionado_id', 'paciente-uuid-A1')
      localStorage.setItem('studio_dental_pacientes', JSON.stringify([{ id: 'A1', nombre: 'Juan Clínica A' }]))

      // Preservar perfil del usuario
      localStorage.setItem('profile_user@test.com', JSON.stringify({ email: 'user@test.com' }))
      localStorage.setItem('clinica_active_user', 'user@test.com')

      // Usuario cambia a Clínica B
      await invalidarCacheCambioClinica('clinica-A')

      // TODO el PHI de clínica A debe estar eliminado
      expect(localStorage.getItem('recetas_paciente-uuid-A1')).toBeNull()
      expect(localStorage.getItem('evoluciones_notas_paciente-uuid-A2')).toBeNull()
      expect(localStorage.getItem('certificados_paciente-uuid-A3')).toBeNull()
      expect(localStorage.getItem('odonto_inicial_paciente-uuid-A1')).toBeNull()
      expect(localStorage.getItem('clinica_paciente_seleccionado_id')).toBeNull()
      expect(localStorage.getItem('studio_dental_pacientes')).toBeNull()

      // Perfil del usuario debe estar PRESERVADO
      expect(JSON.parse(localStorage.getItem('profile_user@test.com') || '{}')).toEqual({ email: 'user@test.com' })
      expect(localStorage.getItem('clinica_active_user')).toBe('user@test.com')
    })
  })

})
