/**
 * @vitest-environment jsdom
 *
 * F7-36 FASE 1 (Commit 1.8): 5 tests obligatorios de aislamiento multi-tenant
 * end-to-end.
 *
 * Valida el comportamiento integrado de las 3 capas de defensa en profundidad:
 *   CAPA 1: Supabase Storage + RLS (validado en F7-24)
 *   CAPA 2: Campo clinicaId + filtro en consultas (createTenantRepository + IndexedDB v2)
 *   CAPA 3: invalidarCacheCambioClinica (5 pasos fail-safe)
 *
 * Estos tests garantizan que el aislamiento multi-tenant funciona de extremo
 * a extremo, no solo en unidades individuales.
 *
 * Ejecutar con: npm test -- --run src/test/security/f7-36-fase1-mandatory.test.js
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Variable de estado para mockear getClinicaActiva de forma síncrona.
// tenantCache.js llama a getClinicaId() síncronamente en claveTenant().
let clinicaActivaActual = null

// Mock de authService — getClinicaActiva como función síncrona mockeable
vi.mock('../../infrastructure/auth/authService', () => ({
  getClinicaActiva: vi.fn(() => clinicaActivaActual),
  getClinicaActivaSync: vi.fn(() => clinicaActivaActual),
  setClinicaActiva: vi.fn(async (id) => {
    clinicaActivaActual = id
  }),
  listarMisClinicas: vi.fn(async () => []),
  obtenerPerfil: vi.fn(() => null),
}))

// Mock de supabaseClient — evita llamadas reales a Supabase
vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
  USE_SUPABASE: true,
  estaOnline: vi.fn(() => Promise.resolve(true)),
}))

// Mock de logger — evita ruido en tests
vi.mock('../../infrastructure/logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// F7-36 FIX: Mock de stores Zustand para evitar que se inicialicen con
// SEED_PACIENTES_DEMO al ser importados (lo que contaminaba la caché
// de pacientesStorageService con Camila Silva y Carlos Mendoza).
vi.mock('../../app/stores/pacientesStore', () => ({
  usePacientesStore: {
    getState: vi.fn(() => ({ pacientes: [], setPacientes: vi.fn() })),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}))

vi.mock('../../app/stores/prestacionesStore', () => ({
  usePrestacionesStore: {
    getState: vi.fn(() => ({ prestaciones: [], setPrestaciones: vi.fn() })),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}))

vi.mock('../../app/stores/sesionStore', () => ({
  useSesionStore: {
    getState: vi.fn(() => ({ userProfile: { clinicaId: clinicaActivaActual } })),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}))

/**
 * Helper: configura la clínica activa simulada.
 * @param {string|null} clinicaId - UUID de la clínica o null para "sin clínica"
 */
const configurarClinica = (clinicaId) => {
  clinicaActivaActual = clinicaId
}

/**
 * F7-36: Simula el reload de página que ocurre en producción al cambiar clínica.
 *
 * En producción, ClinicaSelector.handleCambio() hace:
 *   1. invalidarCacheCambioClinica()
 *   2. window.location.reload()
 *
 * El reload causa que los módulos JS se re-evalúen, reseteando:
 *   - Variables de módulo (let pacientesCache = null, cacheInicializado = false)
 *   - Singletons Zustand
 *   - Cualquier estado en memoria
 *
 * Esta función simula ese comportamiento para los tests:
 *   1. Preserva la clínica activa actual
 *   2. Resetea módulos (vi.resetModules)
 *   3. Re-importa los servicios (se inicializan con nueva clínica)
 *
 * @returns {Promise<Object>} Servicios recargados
 */
const simularReload = async () => {
  const clinicaPrevia = clinicaActivaActual
  vi.resetModules()

  // Re-importar servicios (se inicializan frescos)
  const pacMod = await import('../../domains/clinical/patient/services/pacientesStorageService.js')
  const agMod = await import('../../domains/operations/agenda/services/agendaStorageService.js')
  const adjMod = await import('../../infrastructure/storage/adjuntosStorageService.js')
  const invMod = await import('../../infrastructure/supabase/invalidarCacheCambioClinica.js')
  const tcMod = await import('../../infrastructure/tenant/tenantCache.js')

  // Asegurar que la clínica sigue siendo la misma
  clinicaActivaActual = clinicaPrevia

  // NO resetear el caché: dejar que los servicios se inicialicen
  // naturalmente desde localStorage (tenant-aware). Si la clínica
  // actual tiene datos en su clave tenant, los verá; si no, verá [].
  // Esto simula fielmente el reload de página de producción.

  return {
    pacientesStorageService: pacMod.pacientesStorageService,
    agendaStorageService: agMod.agendaStorageService,
    guardarAdjunto: adjMod.guardarAdjunto,
    obtenerAdjuntosPorPaciente: adjMod.obtenerAdjuntosPorPaciente,
    invalidarCacheCambioClinica: invMod.invalidarCacheCambioClinica,
    tenantCache: tcMod.tenantCache,
  }
}

describe('F7-36 FASE 1 — 5 tests obligatorios de aislamiento multi-tenant', () => {
  let pacientesStorageService
  let _agendaStorageService
  let guardarAdjunto
  let obtenerAdjuntosPorPaciente
  let invalidarCacheCambioClinica
  let tenantCache
  let cerrarDB

  beforeEach(async () => {
    // F7-36 FIX: Reset AGRESIVO de estado antes de cada test
    clinicaActivaActual = null

    // 0. Cerrar conexiones activas de IndexedDB para evitar bloqueo
    if (cerrarDB) {
      await cerrarDB()
    }

    // 1. Limpiar localStorage COMPLETO (incluye claves tenant-aware de tests previos)
    localStorage.clear()

    // 2. Eliminar IndexedDB para aislar tests de adjuntos
    if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
      try {
        indexedDB.deleteDatabase('studio_dental_adjuntos')
      } catch {}
    }

    // 3. Resetear módulos para forzar re-evaluación de imports
    vi.resetModules()

    // 4. Configurar clínica ANTES de importar servicios
    //    (para que el caché en memoria se inicialice con el contexto correcto)
    configurarClinica('clinica-A')

    // 5. Cargar servicios dinámicamente (respetan mocks arriba)
    const pacMod = await import('../../domains/clinical/patient/services/pacientesStorageService.js')
    pacientesStorageService = pacMod.pacientesStorageService

    const agMod = await import('../../domains/operations/agenda/services/agendaStorageService.js')
    _agendaStorageService = agMod.agendaStorageService

    const adjMod = await import('../../infrastructure/storage/adjuntosStorageService.js')
    guardarAdjunto = adjMod.guardarAdjunto
    obtenerAdjuntosPorPaciente = adjMod.obtenerAdjuntosPorPaciente
    cerrarDB = adjMod.cerrarDB

    const invMod = await import('../../infrastructure/supabase/invalidarCacheCambioClinica.js')
    invalidarCacheCambioClinica = invMod.invalidarCacheCambioClinica

    const tcMod = await import('../../infrastructure/tenant/tenantCache.js')
    tenantCache = tcMod.tenantCache

    // 6. Resetear el caché en memoria del storageService guardando array vacío.
    //    Esto garantiza que obtenerPacientes() retorne [] y no SEED heredado.
    pacientesStorageService.guardarPacientes([])
  })

  afterEach(async () => {
    if (cerrarDB) {
      await cerrarDB()
    }
    vi.restoreAllMocks()
  })

  // ════════════════════════════════════════════════════════════════════
  // TEST 1: Cambio de clínica end-to-end (localStorage)
  // ════════════════════════════════════════════════════════════════════
  it('1. Cambio de clínica aísla datos en localStorage (pacientes)', async () => {
    // F7-36: En producción, cambiar clínica dispara un reload. Este test
    // simula ese comportamiento para validar aislamiento end-to-end.

    // Arrange: Clínica A activa
    configurarClinica('clinica-A')

    // Act: Clínica A crea sus datos
    pacientesStorageService.guardarPacientes([
      { id: 'p-a1', rut: '11111111-1', nombre: 'Paciente Confidencial A' },
    ])

    // Assert 1: Clínica A ve sus datos
    const datosA = pacientesStorageService.obtenerPacientes()
    expect(datosA).toHaveLength(1)
    expect(datosA[0].nombre).toBe('Paciente Confidencial A')

    // Act: Cambiar a Clínica B + simular reload (como en producción)
    configurarClinica('clinica-B')
    const reload1 = await simularReload()

    // Assert 2: Después del reload, Clínica B ve array vacío
    // (su clave sd_clinica-B_studio_dental_pacientes_v3 no existe)
    const datosB = reload1.pacientesStorageService.obtenerPacientes()
    expect(datosB).toEqual([])

    // Act: Clínica B crea sus propios datos
    reload1.pacientesStorageService.guardarPacientes([
      { id: 'p-b1', rut: '22222222-2', nombre: 'Paciente Confidencial B' },
    ])

    // Assert 3: Clínica B ve solo sus datos
    const datosBSolos = reload1.pacientesStorageService.obtenerPacientes()
    expect(datosBSolos).toHaveLength(1)
    expect(datosBSolos[0].nombre).toBe('Paciente Confidencial B')

    // Act: Volver a Clínica A + simular reload
    configurarClinica('clinica-A')
    const reload2 = await simularReload()

    // Assert 4: Clínica A sigue viendo sus datos originales intactos
    // (la clave sd_clinica-A_studio_dental_pacientes_v3 preservó los datos)
    const datosAVuelta = reload2.pacientesStorageService.obtenerPacientes()
    expect(datosAVuelta).toHaveLength(1)
    expect(datosAVuelta[0].nombre).toBe('Paciente Confidencial A')
  })

  // ════════════════════════════════════════════════════════════════════
  // TEST 2: Cambio de clínica end-to-end (IndexedDB)
  // ════════════════════════════════════════════════════════════════════
  it('2. Cambio de clínica aísla adjuntos en IndexedDB', async () => {
    // Arrange: Clínica A activa
    configurarClinica('clinica-A')

    // Act: Clínica A guarda un adjunto clínico
    const blob = new Blob(['imagen-radiografia'], { type: 'image/png' })
    await guardarAdjunto({
      pacienteId: 'p-a1',
      tipo: 'rx',
      blob,
      nombre: 'radiografia-clinica-A.png',
    })

    // Assert 1: Clínica A ve su adjunto
    const adjuntosA = await obtenerAdjuntosPorPaciente('p-a1')
    expect(adjuntosA).toHaveLength(1)
    expect(adjuntosA[0].nombre).toBe('radiografia-clinica-A.png')
    expect(adjuntosA[0].clinicaId).toBe('clinica-A')

    // Act: Cambiar a Clínica B (sin invalidación manual)
    configurarClinica('clinica-B')

    // Assert 2: Clínica B NO ve adjuntos de A (filtro por clinicaId)
    const adjuntosB = await obtenerAdjuntosPorPaciente('p-a1')
    expect(adjuntosB).toEqual([])

    // Act: Clínica B guarda su propio adjunto para el MISMO pacienteId
    const blobB = new Blob(['imagen-b'], { type: 'image/png' })
    await guardarAdjunto({
      pacienteId: 'p-a1', // Mismo UUID (podría ocurrir si UUIDs colisionan entre clínicas)
      tipo: 'foto',
      blob: blobB,
      nombre: 'foto-clinica-B.png',
    })

    // Assert 3: Clínica B solo ve su adjunto
    const adjuntosBPropios = await obtenerAdjuntosPorPaciente('p-a1')
    expect(adjuntosBPropios).toHaveLength(1)
    expect(adjuntosBPropios[0].nombre).toBe('foto-clinica-B.png')
    expect(adjuntosBPropios[0].clinicaId).toBe('clinica-B')

    // Act: Volver a Clínica A
    configurarClinica('clinica-A')

    // Assert 4: Clínica A sigue viendo solo su adjunto (aislamiento total)
    const adjuntosAVuelta = await obtenerAdjuntosPorPaciente('p-a1')
    expect(adjuntosAVuelta).toHaveLength(1)
    expect(adjuntosAVuelta[0].nombre).toBe('radiografia-clinica-A.png')
  })

  // ════════════════════════════════════════════════════════════════════
  // TEST 3: Invalidación de cache al cambiar clínica
  // ════════════════════════════════════════════════════════════════════
  it('3. invalidarCacheCambioClinica ejecuta los 5 pasos fail-safe', async () => {
    // Arrange: Clínica A con datos en todas las capas
    configurarClinica('clinica-A')
    pacientesStorageService.guardarPacientes([
      { id: 'p-1', rut: '11111111-1', nombre: 'Test' },
    ])

    // Verificar pre-condición: hay claves tenant-aware de clínica A
    const clavesAntes = tenantCache.listarClavesTenant()
    const clavesDeAAntes = clavesAntes.filter((k) => k.includes('clinica-A'))
    expect(clavesDeAAntes.length).toBeGreaterThan(0)

    // Act: Ejecutar invalidación completa (con timeout extendido por seguridad)
    const resultado = await invalidarCacheCambioClinica('clinica-A')

    // Assert 1: La función reporta ejecución de los 5 pasos
    // Estructura real: { tenantKeys, storageServices, stores, legacyKeys,
    //                    patientKeys, explicitKeys, indexedDB, errores }
    expect(resultado).toBeDefined()
    expect(typeof resultado.tenantKeys).toBe('number')
    expect(typeof resultado.storageServices).toBe('number')
    expect(Array.isArray(resultado.stores)).toBe(true)
    expect(resultado.indexedDB).toBeDefined()
    expect(typeof resultado.indexedDB.eliminada).toBe('boolean')

    // Assert 2: Las claves tenant-aware de clínica A fueron eliminadas
    const clavesDespues = tenantCache.listarClavesTenant()
    const clavesDeADespues = clavesDespues.filter((k) => k.includes('clinica-A'))
    expect(clavesDeADespues).toEqual([])

    // Assert 3: Se ejecutó invalidación no destructiva de IndexedDB (P0-2)
    expect(resultado.indexedDB.eliminada).toBe(true)
    expect(resultado.indexedDB.conservadosPendientes).toBe(true)
  }, 10000)

  // ════════════════════════════════════════════════════════════════════
  // TEST 4: Defensa en profundidad (CAPA 2)
  // ════════════════════════════════════════════════════════════════════
  it('4. Si invalidación falla, aislamiento sigue funcionando tras reload', async () => {
    // F7-36: La CAPA 2 (tenant-aware) garantiza aislamiento incluso si
    // la invalidación (CAPA 3) fallara por alguna razón. El reload
    // re-inicializa los módulos, que leen de la clave tenant correcta.

    // Arrange: Clínica A con datos confidenciales
    configurarClinica('clinica-A')
    pacientesStorageService.guardarPacientes([
      { id: 'p-a1', rut: '11111111-1', nombre: 'Confidencial A' },
    ])

    // Verificar pre-condición
    expect(pacientesStorageService.obtenerPacientes()).toHaveLength(1)
    expect(pacientesStorageService.obtenerPacientes()[0].nombre).toBe('Confidencial A')

    // Act: Cambiar a Clínica B + simular reload SIN invalidación
    // (simulando que invalidarCacheCambioClinica falló completamente)
    configurarClinica('clinica-B')
    const reload = await simularReload()

    // Assert 1: Clínica B NO ve datos de A tras reload (CAPA 2 protege)
    // Aunque la clave sd_clinica-A_* siga en localStorage, la clave
    // sd_clinica-B_* está vacía, por lo que B ve [].
    const datosB = reload.pacientesStorageService.obtenerPacientes()
    expect(datosB).toEqual([])

    // Act: Volver a Clínica A + reload
    configurarClinica('clinica-A')
    const reload2 = await simularReload()

    // Assert 2: Los datos de A siguen intactos (no se borraron, solo aislados)
    const datosA = reload2.pacientesStorageService.obtenerPacientes()
    expect(datosA).toHaveLength(1)
    expect(datosA[0].nombre).toBe('Confidencial A')
  })

  // ════════════════════════════════════════════════════════════════════
  // TEST 5: Migración de claves legacy
  // ════════════════════════════════════════════════════════════════════
  it('5. Claves legacy preexistentes no interfieren con tenant-aware', async () => {
    // Arrange: Simular datos legacy de ANTES de la migración F7-36
    localStorage.setItem(
      'studio_dental_pacientes_v3',
      JSON.stringify([{ id: 'legacy-1', rut: '99999999-9', nombre: 'Datos legacy' }])
    )

    // Act: Configurar clínica + simular reload (como en primer inicio post-migración)
    configurarClinica('clinica-A')
    const reload = await simularReload()

    // Assert 1: Consulta retorna vacío (datos legacy son ignorados)
    // El servicio lee de sd_clinica-A_studio_dental_pacientes_v3 (no existe)
    // La clave legacy studio_dental_pacientes_v3 es ignorada completamente.
    const datosIniciales = reload.pacientesStorageService.obtenerPacientes()
    expect(datosIniciales).toEqual([])

    // Act: Clínica A crea datos nuevos (en clave tenant-aware)
    reload.pacientesStorageService.guardarPacientes([
      { id: 'p-a1', rut: '11111111-1', nombre: 'Datos modernos A' },
    ])

    // Assert 2: Solo ve los datos modernos (en clave tenant-aware)
    const datos = reload.pacientesStorageService.obtenerPacientes()
    expect(datos).toHaveLength(1)
    expect(datos[0].nombre).toBe('Datos modernos A')

    // Assert 3: Clave legacy sigue ahí (inofensiva)
    // Será limpiada por invalidarCacheCambioClinica en el próximo cambio
    const legacyPersiste = localStorage.getItem('studio_dental_pacientes_v3')
    expect(legacyPersiste).not.toBeNull()
    const legacyParseado = JSON.parse(legacyPersiste)
    expect(legacyParseado[0].nombre).toBe('Datos legacy')
  })
})
