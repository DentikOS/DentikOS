/**
 * @vitest-environment node
 *
 * Tests unitarios y de integración para la cola offline de presupuestos (P1-3)
 * Valida la sincronización atómica de presupuestos y presupuesto_items,
 * colas de pendientes y eliminaciones explícitas, y protección contra purga.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Polyfill de localStorage para entorno Node
const localStorageStore = new Map()
global.localStorage = {
  getItem: (k) => localStorageStore.get(k) ?? null,
  setItem: (k, v) => localStorageStore.set(k, String(v)),
  removeItem: (k) => localStorageStore.delete(k),
  clear: () => localStorageStore.clear(),
  get length() { return localStorageStore.size },
  key: (i) => Array.from(localStorageStore.keys())[i] ?? null
}

const { estadoMock, mockFrom, mockRpc } = vi.hoisted(() => ({
  estadoMock: {
    clinicaId: 'aaaaaaaa-0000-4000-8000-000000000001',
    user: { id: 'user-dentista-presupuestos' },
    supabaseError: null,
    supabasePadreError: null,
    supabaseItemError: null,
    rpcLoseResponseAfterCommit: false,
    remotePresupuestos: [],
    remoteItems: [],
    presupuestosInsertados: [],
    itemsInsertados: [],
    deletedPresupuestosIds: [],
    deletedItemsIds: [],
    legacyPresupuestoIds: new Map(),
    legacyItemIds: new Map()
  },
  mockFrom: vi.fn(),
  mockRpc: vi.fn()
}))

// Mock de authService
vi.mock('../../../../infrastructure/auth/authService', () => ({
  getClinicaActiva: vi.fn(() => estadoMock.clinicaId),
  getClinicaActivaSync: vi.fn(() => estadoMock.clinicaId),
  setClinicaActiva: vi.fn(async (id) => {
    estadoMock.clinicaId = id
  }),
  listarMisClinicas: vi.fn(async () => []),
  obtenerPerfil: vi.fn(() => null)
}))

// Mock de supabaseClient
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: estadoMock.user }, error: null }))
    },
    rpc: mockRpc,
    from: mockFrom
  }
}))

import {
  presupuestosStorageService,
  guardarPresupuesto,
  guardarItemPresupuesto,
  eliminarPresupuesto,
  eliminarItemPresupuesto,
  procesarColaPresupuestos,
  procesarPendingDeletesPresupuestos,
  obtenerPendingPresupuestos,
  obtenerPendingPresupuestoItems,
  guardarPendingPresupuestoItems,
  obtenerPendingDeletesPresupuestos,
  obtenerPendingDeletesPresupuestoItems,
  sincronizarDesdeSupabase
} from './presupuestosStorageService'
import { transformarItemParaSupabase, transformarPresupuestoParaSupabase } from './presupuestosOfflineQueueService'

describe('moneda por presupuesto', () => {
  it('sincroniza la moneda fijada y usa CLP para presupuestos legacy sin moneda', () => {
    const base = { id: 'presupuesto-1', folio: 'P-1', pacienteNombre: 'Paciente', montoTotal: 1000 }
    expect(transformarPresupuestoParaSupabase({ ...base, moneda: 'USD' }, 'usuario').moneda).toBe('USD')
    expect(transformarPresupuestoParaSupabase(base, 'usuario').moneda).toBe('CLP')
  })
})

const configurarClinica = (clinicaId) => {
  estadoMock.clinicaId = clinicaId
}

describe('P1-3: Cola de Presupuestos (pendingPresupuestos + items)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageStore.clear()
    configurarClinica('aaaaaaaa-0000-4000-8000-000000000001')
    presupuestosStorageService.resetCache()
    estadoMock.supabaseError = null
    estadoMock.supabasePadreError = null
    estadoMock.supabaseItemError = null
    estadoMock.rpcLoseResponseAfterCommit = false
    estadoMock.remotePresupuestos = []
    estadoMock.remoteItems = []
    estadoMock.presupuestosInsertados = []
    estadoMock.itemsInsertados = []
    estadoMock.deletedPresupuestosIds = []
    estadoMock.deletedItemsIds = []
    estadoMock.legacyPresupuestoIds = new Map()
    estadoMock.legacyItemIds = new Map()

    mockRpc.mockImplementation(async (functionName, args) => {
      if (functionName === 'aprobar_presupuesto_bp09') {
        return { data: { ok: true, estado: 'aprobado', version: 2 }, error: null }
      }
      if (functionName !== 'sincronizar_presupuesto_offline_bp12') return { data: null, error: null }
      const fallo = estadoMock.supabaseError ||
        (args.p_presupuesto && estadoMock.supabasePadreError) ||
        (args.p_items.length > 0 && estadoMock.supabaseItemError)
      if (fallo) return { data: null, error: fallo }

      const presupuesto = args.p_presupuesto
      let presupuestoId = args.p_presupuesto_id
      if (presupuesto) {
        const idEnviado = String(presupuesto.id)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idEnviado)) {
          presupuestoId = idEnviado
        } else {
          const key = `${estadoMock.clinicaId}:${estadoMock.user.id}:${idEnviado}`
          presupuestoId = estadoMock.legacyPresupuestoIds.get(key) || '11111111-2222-3333-4444-555555555555'
          estadoMock.legacyPresupuestoIds.set(key, presupuestoId)
        }
        const fila = { ...presupuesto, id: presupuestoId }
        const anterior = estadoMock.presupuestosInsertados.find((row) => row.id === presupuestoId)
        if (anterior?.monto_abonado !== undefined) fila.monto_abonado = anterior.monto_abonado
        if (anterior) {
          estadoMock.presupuestosInsertados[estadoMock.presupuestosInsertados.indexOf(anterior)] = fila
        } else {
          estadoMock.presupuestosInsertados.push(fila)
        }
      }

      for (const item of args.p_items) {
        let idItem = String(item.id)
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idItem)) {
          const key = `${presupuestoId}:${idItem}`
          idItem = estadoMock.legacyItemIds.get(key) || '22222222-3333-4444-8555-666666666666'
          estadoMock.legacyItemIds.set(key, idItem)
        }
        const fila = { ...item, id: idItem, presupuesto_id: presupuestoId }
        const anterior = estadoMock.itemsInsertados.find((row) => row.id === idItem)
        if (anterior) {
          estadoMock.itemsInsertados[estadoMock.itemsInsertados.indexOf(anterior)] = fila
        } else {
          estadoMock.itemsInsertados.push(fila)
        }
      }
      if (estadoMock.rpcLoseResponseAfterCommit) {
        estadoMock.rpcLoseResponseAfterCommit = false
        return { data: null, error: new Error('La respuesta se perdió después del commit') }
      }
      return { data: presupuestoId, error: null }
    })

    mockFrom.mockImplementation((tabla) => {
      if (tabla === 'presupuestos') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => {
              if (estadoMock.supabaseError) {
                return { data: null, error: estadoMock.supabaseError }
              }
              return { data: estadoMock.remotePresupuestos, error: null }
            }),
            then: (resolve) => {
              if (estadoMock.supabaseError) {
                resolve({ data: null, error: estadoMock.supabaseError })
              } else {
                resolve({ data: estadoMock.remotePresupuestos, error: null })
              }
            }
          })),
          insert: vi.fn((payload) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                if (estadoMock.supabasePadreError || estadoMock.supabaseError) {
                  return { data: null, error: estadoMock.supabasePadreError || estadoMock.supabaseError }
                }
                const uuidGenerado = '11111111-2222-3333-4444-555555555555'
                estadoMock.presupuestosInsertados.push({ ...payload, id: uuidGenerado })
                return {
                  data: { id: uuidGenerado },
                  error: null
                }
              })
            }))
          })),
          upsert: vi.fn(async (payload) => {
            if (estadoMock.supabasePadreError || estadoMock.supabaseError) {
              return { error: estadoMock.supabasePadreError || estadoMock.supabaseError }
            }
            estadoMock.presupuestosInsertados.push(payload)
            return { error: null }
          }),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({
              error: estadoMock.supabasePadreError || estadoMock.supabaseError
            }))
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(async (col, val) => {
              if (estadoMock.supabaseError) {
                return { error: estadoMock.supabaseError }
              }
              estadoMock.deletedPresupuestosIds.push(val)
              return { error: null }
            }),
            in: vi.fn(async (col, vals) => {
              if (estadoMock.supabaseError) {
                return { error: estadoMock.supabaseError }
              }
              estadoMock.deletedPresupuestosIds.push(...vals)
              return { error: null }
            })
          }))
        }
      }

      if (tabla === 'presupuesto_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => {
              if (estadoMock.supabaseError) {
                return { data: null, error: estadoMock.supabaseError }
              }
              return { data: estadoMock.remoteItems, error: null }
            })
          })),
          insert: vi.fn((payload) => {
            if (estadoMock.supabaseError) {
              return Promise.resolve({ error: estadoMock.supabaseError })
            }
            if (Array.isArray(payload)) {
              estadoMock.itemsInsertados.push(...payload)
            } else {
              estadoMock.itemsInsertados.push(payload)
            }
            return Promise.resolve({ data: payload, error: null })
          }),
          upsert: vi.fn((payload) => {
            if (estadoMock.supabaseError || estadoMock.supabaseItemError) {
              return Promise.resolve({ error: estadoMock.supabaseError || estadoMock.supabaseItemError })
            }
            estadoMock.itemsInsertados.push(payload)
            return Promise.resolve({ error: null })
          }),
          delete: vi.fn(() => ({
            eq: vi.fn(async (col, val) => {
              if (estadoMock.supabaseError) {
                return { error: estadoMock.supabaseError }
              }
              estadoMock.deletedItemsIds.push(val)
              return { error: null }
            }),
            in: vi.fn(async (col, vals) => {
              if (estadoMock.supabaseError) {
                return { error: estadoMock.supabaseError }
              }
              estadoMock.deletedItemsIds.push(...vals)
              return { error: null }
            })
          }))
        }
      }

      return {}
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Encolado offline de presupuesto nuevo
  // ──────────────────────────────────────────────────────────────────────────
  it('una edición en cola no puede sobrescribir el saldo confirmado por pagos', async () => {
    await guardarPresupuesto({
      id: 'bbbbbbbb-2222-3333-4444-555555555555',
      folio: 'PRES-SALDO',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Paciente',
      montoTotal: 100000,
      montoAbonado: 40000,
      estado: 'Aprobado',
      items: [],
    })
    expect(estadoMock.presupuestosInsertados).toHaveLength(1)
    expect(estadoMock.presupuestosInsertados[0]).not.toHaveProperty('monto_abonado')
  })

  it('si falla un ítem, no persiste la cabecera y conserva el saldo remoto al reintentar', async () => {
    estadoMock.supabaseItemError = new Error('Ítems temporalmente no disponibles')
    const id = 'bbbbbbbb-1111-4222-8333-444444444444'
    const presupuesto = await guardarPresupuesto({
      id,
      folio: 'PRES-PARCIAL',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Paciente',
      montoTotal: 10000,
      estado: 'Borrador',
      items: [{ id: 'bbbbbbbb-1111-4222-8333-444444444444', prestacionNombre: 'Control', valor: 10000 }]
    })

    expect(presupuesto.sincronizado).toBe(false)
    expect(estadoMock.presupuestosInsertados).toHaveLength(0)
    expect(estadoMock.itemsInsertados).toHaveLength(0)
    expect(obtenerPendingPresupuestos()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: presupuesto.id, padreSubido: false })
    ]))
    expect(obtenerPendingPresupuestoItems()).toHaveLength(1)

    estadoMock.remotePresupuestos = [{
      id,
      clinica_id: estadoMock.clinicaId,
      paciente_id: 'aaaaaaaa-1111-2222-3333-444444444444',
      folio: 'PRES-PARCIAL',
      paciente_nombre: 'Paciente',
      monto_total: 10000,
      monto_abonado: 4000,
      detalle_items: presupuesto.items
    }]
    const refrescados = await sincronizarDesdeSupabase()
    expect(refrescados.find((p) => p.id === presupuesto.id)).toMatchObject({
      sincronizado: false,
      montoAbonado: 4000
    })

    estadoMock.supabaseItemError = null
    const resultado = await procesarColaPresupuestos()
    expect(resultado.fallidos).toBe(0)
    expect(estadoMock.presupuestosInsertados).toHaveLength(1)
    expect(estadoMock.itemsInsertados).toHaveLength(1)
    expect(obtenerPendingPresupuestos()).toHaveLength(0)
    expect(obtenerPendingPresupuestoItems()).toHaveLength(0)
    expect(presupuestosStorageService.obtenerPresupuestos().find((p) => p.id === presupuesto.id)).toMatchObject({
      sincronizado: true,
      montoAbonado: 4000
    })
  })

  it('revierte padre e ítems juntos cuando un ítem falla durante el drenaje de la cola', async () => {
    estadoMock.supabasePadreError = new Error('Sin conexión')
    await guardarPresupuesto({
      id: 902,
      folio: 'PRES-COLA-PARCIAL',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Paciente',
      montoTotal: 10000,
      estado: 'Borrador',
      items: [{ id: 'cccccccc-1111-4222-8333-444444444444', prestacionNombre: 'Control', valor: 10000 }]
    })
    estadoMock.supabasePadreError = null
    estadoMock.supabaseItemError = new Error('Fallo del ítem')

    const parcial = await procesarColaPresupuestos()
    expect(parcial.fallidos).toBe(1)
    expect(estadoMock.presupuestosInsertados).toHaveLength(0)
    expect(estadoMock.itemsInsertados).toHaveLength(0)
    expect(obtenerPendingPresupuestos()[0]).toMatchObject({ padreSubido: false, id: 902 })
    expect(presupuestosStorageService.obtenerPresupuestos().find((p) => p.folio === 'PRES-COLA-PARCIAL').sincronizado).toBe(false)

    estadoMock.supabaseItemError = null
    const reintento = await procesarColaPresupuestos()
    expect(reintento.fallidos).toBe(0)
    expect(estadoMock.presupuestosInsertados).toHaveLength(1)
    expect(estadoMock.itemsInsertados).toHaveLength(1)
    expect(obtenerPendingPresupuestos()).toHaveLength(0)
    expect(obtenerPendingPresupuestoItems()).toHaveLength(0)
  })

  it('recupera ítems huérfanos de una cola antigua sin reenviar el presupuesto', async () => {
    const id = 'dddddddd-1111-4222-8333-444444444444'
    await guardarPresupuesto({
      id,
      folio: 'PRES-HUERFANO',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Paciente',
      montoTotal: 10000,
      estado: 'Borrador',
      items: []
    })
    guardarPendingPresupuestoItems([{
      id: 'eeeeeeee-1111-4222-8333-444444444444',
      presupuestoId: id,
      clinicaId: estadoMock.clinicaId,
      prestacionNombre: 'Control',
      valor: 10000
    }])

    const resultado = await procesarColaPresupuestos()
    expect(resultado.procesados).toBe(1)
    expect(estadoMock.presupuestosInsertados).toHaveLength(1)
    expect(estadoMock.itemsInsertados).toHaveLength(1)
    expect(obtenerPendingPresupuestoItems()).toHaveLength(0)
  })

  it('reintenta con los mismos IDs estables si la respuesta se pierde después del commit', async () => {
    estadoMock.rpcLoseResponseAfterCommit = true
    const presupuesto = await guardarPresupuesto({
      id: 905,
      folio: 'PRES-RESPUESTA-PERDIDA',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Paciente',
      montoTotal: 12000,
      estado: 'Borrador',
      items: [{ id: 2005, prestacionNombre: 'Control', valor: 12000 }]
    })

    expect(presupuesto.sincronizado).toBe(false)
    expect(estadoMock.presupuestosInsertados).toHaveLength(1)
    expect(estadoMock.itemsInsertados).toHaveLength(1)
    expect(obtenerPendingPresupuestos()).toHaveLength(1)
    expect(obtenerPendingPresupuestoItems()).toHaveLength(1)

    const resultado = await procesarColaPresupuestos()
    expect(resultado).toMatchObject({ procesados: 1, fallidos: 0 })
    expect(estadoMock.presupuestosInsertados).toHaveLength(1)
    expect(estadoMock.itemsInsertados).toHaveLength(1)
    expect(obtenerPendingPresupuestos()).toHaveLength(0)
    expect(obtenerPendingPresupuestoItems()).toHaveLength(0)
  })

  it('1. Encolado offline de presupuesto nuevo: guarda en localStorage con sincronizado: false y encola en pendingPresupuestos y pendingPresupuestoItems', async () => {
    estadoMock.supabaseError = new Error('Offline (red no disponible)')

    const nuevoPresupuesto = {
      id: 501,
      folio: 'PRES-2026-001',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Camila Silva',
      montoTotal: 150000,
      estado: 'Emitido',
      items: [
        { id: 1001, prestacionNombre: 'Obturación Resina', valor: 50000, estado: 'Pendiente' },
        { id: 1002, prestacionNombre: 'Limpieza Integral', valor: 100000, estado: 'Pendiente' }
      ]
    }

    const resultado = await guardarPresupuesto(nuevoPresupuesto)
    expect(resultado).toBeDefined()
    expect(resultado.sincronizado).toBe(false)

    // Verificar en localStorage
    const guardados = presupuestosStorageService.obtenerPresupuestos()
    const pLocal = guardados.find((p) => p.id === 501 || p.folio === 'PRES-2026-001')
    expect(pLocal).toBeDefined()
    expect(pLocal.sincronizado).toBe(false)

    // Debe registrar ID padre en pendingPresupuestos
    const pendingP = obtenerPendingPresupuestos()
    const padreEncolado = pendingP.some((item) => (typeof item === 'object' ? item.id === 501 : item === 501))
    expect(padreEncolado).toBe(true)

    // Items deben estar encolados en pendingPresupuestoItems con referencia al presupuestoId
    const pendingI = obtenerPendingPresupuestoItems()
    expect(pendingI.length).toBe(2)
    expect(pendingI.every((i) => i.presupuestoId === 501)).toBe(true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Encolado offline de edición de presupuesto existente
  // ──────────────────────────────────────────────────────────────────────────
  it('2. Encolado offline de edición de presupuesto existente: actualiza localStorage y encola en pendingPresupuestos', async () => {
    const uuidPresupuesto = 'bbbbbbbb-2222-3333-4444-555555555555'
    const presupuestoExistente = {
      id: uuidPresupuesto,
      folio: 'PRES-2026-002',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Camila Silva',
      montoTotal: 150000,
      estado: 'Emitido',
      sincronizado: true,
      items: []
    }

    // Inicializar presupuesto existente como ya sincronizado
    presupuestosStorageService.guardarPresupuestos([presupuestoExistente])

    // Modificar offline
    estadoMock.supabaseError = new Error('Offline (red no disponible)')

    const presupuestoModificado = {
      ...presupuestoExistente,
      montoTotal: 180000,
      estado: 'Aprobado'
    }

    await guardarPresupuesto(presupuestoModificado)

    // Debe actualizarse en caché local con sincronizado: false
    const guardados = presupuestosStorageService.obtenerPresupuestos()
    const pActualizado = guardados.find((p) => p.id === uuidPresupuesto)
    expect(pActualizado.montoTotal).toBe(180000)
    expect(pActualizado.estado).toBe('Aprobado')
    expect(pActualizado.sincronizado).toBe(false)

    // Debe haberse encolado en pendingPresupuestos
    const pendingP = obtenerPendingPresupuestos()
    const encolado = pendingP.some((item) => (typeof item === 'object' ? item.id === uuidPresupuesto : item === uuidPresupuesto))
    expect(encolado).toBe(true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Procesamiento exitoso (padre + items en orden)
  // ──────────────────────────────────────────────────────────────────────────
  it('3. Procesamiento exitoso: sincroniza cabecera e ítems en una RPC y drena colas', async () => {
    // 1. Crear presupuesto con items offline
    estadoMock.supabaseError = new Error('Offline')

    await guardarPresupuesto({
      id: 503,
      folio: 'PRES-2026-003',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Lucas Benítez',
      montoTotal: 90000,
      estado: 'Emitido',
      items: [
        { id: 2001, prestacionNombre: 'Extracción Simple', valor: 90000, estado: 'Pendiente' }
      ]
    })

    expect(obtenerPendingPresupuestos().length).toBe(1)
    expect(obtenerPendingPresupuestoItems().length).toBe(1)

    // 2. Conexión restaurada
    estadoMock.supabaseError = null

    const resultado = await procesarColaPresupuestos()
    expect(resultado.procesados).toBe(1)
    expect(resultado.fallidos).toBe(0)

    // 3. Verificar que el padre se subió a Supabase
    expect(estadoMock.presupuestosInsertados.length).toBeGreaterThan(0)
    const padreSubido = estadoMock.presupuestosInsertados.find((p) => p.folio === 'PRES-2026-003')
    expect(padreSubido).toBeDefined()

    // 4. Verificar que el item se subió con el UUID generado del padre ('11111111-2222-3333-4444-555555555555')
    expect(estadoMock.itemsInsertados.length).toBeGreaterThan(0)
    const itemSubido = estadoMock.itemsInsertados.find((i) => i.prestacion_nombre === 'Extracción Simple')
    expect(itemSubido).toBeDefined()
    expect(itemSubido.presupuesto_id).toBe('11111111-2222-3333-4444-555555555555')

    // 5. Las colas deben quedar vacías y el presupuesto marcado como sincronizado
    expect(obtenerPendingPresupuestos().length).toBe(0)
    expect(obtenerPendingPresupuestoItems().length).toBe(0)

    const guardados = presupuestosStorageService.obtenerPresupuestos()
    const pSincronizado = guardados.find((p) => p.folio === 'PRES-2026-003')
    expect(pSincronizado.sincronizado).toBe(true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Fallo en padre → items no se suben (transaccional)
  // ──────────────────────────────────────────────────────────────────────────
  it('4. Fallo en padre → items no se suben: si Supabase rechaza el padre, los items no se suben y ambos permanecen en colas', async () => {
    // Crear offline
    estadoMock.supabaseError = new Error('Offline')

    await guardarPresupuesto({
      id: 504,
      folio: 'PRES-2026-004',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Marcela Vega',
      montoTotal: 60000,
      estado: 'Emitido',
      items: [
        { id: 2002, prestacionNombre: 'Destartraje', valor: 60000, estado: 'Pendiente' }
      ]
    })

    // Al restaurar, Supabase falla específicamente en el presupuesto padre
    estadoMock.supabaseError = null
    estadoMock.supabasePadreError = new Error('Error al insertar presupuesto padre en DB')

    const resultado = await procesarColaPresupuestos()
    expect(resultado.fallidos).toBeGreaterThan(0)

    // Los items NO deben haberse insertado en Supabase
    expect(estadoMock.itemsInsertados.length).toBe(0)

    // Ambos permanecen en sus colas para reintento futuro
    expect(obtenerPendingPresupuestos().length).toBe(1)
    expect(obtenerPendingPresupuestoItems().length).toBe(1)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Edición de item individual offline
  // ──────────────────────────────────────────────────────────────────────────
  it('5. Edición de item individual offline: encola en pendingPresupuestoItems y marca presupuesto padre como pendiente', async () => {
    const uuidPresupuesto = 'cccccccc-3333-4444-5555-666666666666'
    const uuidItem = 'dddddddd-4444-5555-6666-777777777777'

    const presupuestoConItem = {
      id: uuidPresupuesto,
      folio: 'PRES-2026-005',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Tomás Castro',
      montoTotal: 70000,
      estado: 'Emitido',
      sincronizado: true,
      items: [
        { id: uuidItem, prestacionNombre: 'Blanqueamiento', valor: 70000, estado: 'Pendiente', sincronizado: true }
      ]
    }

    presupuestosStorageService.guardarPresupuestos([presupuestoConItem])

    // Modificar item offline desde ficha clínica
    estadoMock.supabaseError = new Error('Offline')

    const itemModificado = {
      id: uuidItem,
      presupuestoId: uuidPresupuesto,
      prestacionNombre: 'Blanqueamiento Láser Plus',
      valor: 85000,
      estado: 'En Proceso'
    }

    await guardarItemPresupuesto(itemModificado)

    // El item debe encolarse en pendingPresupuestoItems
    const pendingItems = obtenerPendingPresupuestoItems()
    expect(pendingItems.some((i) => (typeof i === 'object' ? i.id === uuidItem : i === uuidItem))).toBe(true)

    // El presupuesto padre debe marcarse como pendiente en pendingPresupuestos
    const pendingP = obtenerPendingPresupuestos()
    expect(pendingP.some((p) => (typeof p === 'object' ? p.id === uuidPresupuesto : p === uuidPresupuesto))).toBe(true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Eliminación de presupuesto offline
  // ──────────────────────────────────────────────────────────────────────────
  it('6. Eliminación de presupuesto offline: encola ID en pendingDeletesPresupuestos, items en pendingDeletesPresupuestoItems y elimina de localStorage', async () => {
    const uuidPresupuesto = 'eeeeeeee-5555-6666-7777-888888888888'
    const uuidItem = 'ffffffff-6666-7777-8888-999999999999'

    const presupuestoAEliminar = {
      id: uuidPresupuesto,
      folio: 'PRES-2026-006',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Paula Garrido',
      montoTotal: 40000,
      estado: 'Emitido',
      sincronizado: true,
      items: [
        { id: uuidItem, prestacionNombre: 'Fluoración', valor: 40000, estado: 'Pendiente' }
      ]
    }

    presupuestosStorageService.guardarPresupuestos([presupuestoAEliminar])
    expect(presupuestosStorageService.obtenerPresupuestos().length).toBe(1)

    // Simular desconexión al eliminar
    estadoMock.supabaseError = new Error('Offline al eliminar')

    await eliminarPresupuesto(uuidPresupuesto)

    // Se retira inmediatamente de localStorage
    expect(presupuestosStorageService.obtenerPresupuestos().length).toBe(0)

    // El ID del padre debe estar en pendingDeletesPresupuestos
    const pendingDelP = obtenerPendingDeletesPresupuestos()
    expect(pendingDelP).toContain(uuidPresupuesto)

    // Los items asociados deben estar en pendingDeletesPresupuestoItems
    const pendingDelI = obtenerPendingDeletesPresupuestoItems()
    expect(pendingDelI).toContain(uuidItem)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Eliminación de item individual offline
  // ──────────────────────────────────────────────────────────────────────────
  it('7. Eliminación de item individual offline: encola en pendingDeletesPresupuestoItems y elimina de localStorage inmediatamente', async () => {
    const uuidPresupuesto = '12121212-3434-5656-7878-909090909090'
    const uuidItem1 = '23232323-4545-6767-8989-010101010101'
    const uuidItem2 = '34343434-5656-7878-9090-121212121212'

    const presupuesto = {
      id: uuidPresupuesto,
      folio: 'PRES-2026-007',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Jorge Fuentes',
      montoTotal: 100000,
      estado: 'Emitido',
      sincronizado: true,
      items: [
        { id: uuidItem1, prestacionNombre: 'Item 1', valor: 50000 },
        { id: uuidItem2, prestacionNombre: 'Item 2', valor: 50000 }
      ]
    }

    presupuestosStorageService.guardarPresupuestos([presupuesto])

    estadoMock.supabaseError = new Error('Offline')

    // Eliminar solo el Item 1
    await eliminarItemPresupuesto(uuidItem1, uuidPresupuesto)

    // En localStorage el presupuesto ahora solo tiene el Item 2
    const pLocal = presupuestosStorageService.obtenerPresupuestos().find((p) => p.id === uuidPresupuesto)
    expect(pLocal.items.length).toBe(1)
    expect(pLocal.items[0].id).toBe(uuidItem2)

    // pendingDeletesPresupuestoItems contiene uuidItem1
    const pendingDelItems = obtenerPendingDeletesPresupuestoItems()
    expect(pendingDelItems).toContain(uuidItem1)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Procesamiento de eliminaciones pendientes
  // ──────────────────────────────────────────────────────────────────────────
  it('8. Procesamiento de eliminaciones pendientes: ejecuta DELETE en Supabase y retira de cola solo los exitosos', async () => {
    const uuidPresupuesto = '99999999-8888-7777-6666-555555555555'
    const uuidItem = '88888888-7777-6666-5555-444444444444'

    // Registrar en colas de eliminación
    presupuestosStorageService.guardarPendingDeletesPresupuestos([uuidPresupuesto])
    presupuestosStorageService.guardarPendingDeletesPresupuestoItems([uuidItem])

    expect(obtenerPendingDeletesPresupuestos()).toContain(uuidPresupuesto)
    expect(obtenerPendingDeletesPresupuestoItems()).toContain(uuidItem)

    // Ejecutar procesamiento con conexión activa
    estadoMock.supabaseError = null
    await procesarPendingDeletesPresupuestos()

    // Debe haber ejecutado DELETE en Supabase
    expect(estadoMock.deletedPresupuestosIds).toContain(uuidPresupuesto)
    expect(estadoMock.deletedItemsIds).toContain(uuidItem)

    // Las colas de eliminaciones deben quedar vacías
    expect(obtenerPendingDeletesPresupuestos().length).toBe(0)
    expect(obtenerPendingDeletesPresupuestoItems().length).toBe(0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: Protección contra purga
  // ──────────────────────────────────────────────────────────────────────────
  it('9. Protección contra purga: sincronizarDesdeSupabase() NO borra presupuestos locales en pendingPresupuestos ni con sincronizado: false', async () => {
    // Guardar presupuesto offline
    estadoMock.supabaseError = new Error('Offline')

    await guardarPresupuesto({
      id: 509,
      folio: 'PRES-2026-009',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Valeria Díaz',
      montoTotal: 120000,
      estado: 'Emitido',
      items: []
    })

    // Supabase tiene un presupuesto remoto diferente
    estadoMock.supabaseError = null
    estadoMock.remotePresupuestos = [
      {
        id: '77777777-6666-5555-4444-333333333333',
        folio: 'PRES-2026-REMOTO',
        paciente_id: 'aaaaaaaa-1111-2222-3333-444444444444',
        paciente_nombre: 'Paciente Remoto',
        monto_total: 50000,
        estado: 'Emitido'
      }
    ]

    const resultadoSync = await sincronizarDesdeSupabase()

    // El presupuesto local offline NO debe haberse borrado
    const localProtegido = resultadoSync.find((p) => p.id === 509 || p.folio === 'PRES-2026-009')
    expect(localProtegido).toBeDefined()
    expect(localProtegido.montoTotal).toBe(120000)

    // Y el remoto también debe estar incorporado
    const remotoEnCache = resultadoSync.find((p) => p.id === '77777777-6666-5555-4444-333333333333')
    expect(remotoEnCache).toBeDefined()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10: Aislamiento multi-tenant
  // ──────────────────────────────────────────────────────────────────────────
  it('10. Aislamiento multi-tenant: pendingPresupuestos de Clínica A no se procesa cuando la sesión activa es Clínica B', async () => {
    configurarClinica('aaaaaaaa-0000-4000-8000-000000000001')
    estadoMock.supabaseError = new Error('Offline')

    await guardarPresupuesto({
      id: 510,
      folio: 'PRES-2026-010',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Presupuesto Clinica A',
      montoTotal: 250000,
      estado: 'Emitido',
      items: []
    })

    expect(obtenerPendingPresupuestos().length).toBe(1)

    // Cambiar a Clínica B
    configurarClinica('bbbbbbbb-0000-4000-8000-000000000002')
    presupuestosStorageService.resetCache()
    estadoMock.supabaseError = null

    // En Clínica B la cola debe estar vacía para su tenant
    expect(obtenerPendingPresupuestos().length).toBe(0)

    const resB = await procesarColaPresupuestos()
    expect(resB.procesados).toBe(0)

    // Regresar a Clínica A: su presupuesto pendiente sigue intacto
    configurarClinica('aaaaaaaa-0000-4000-8000-000000000001')
    presupuestosStorageService.resetCache()
    const pendingA = obtenerPendingPresupuestos()
    expect(pendingA.length).toBe(1)
    expect(pendingA.some((item) => (typeof item === 'object' ? item.id === 510 : item === 510))).toBe(true)
  })

  it('sincroniza productos con sus datos de inventario y aprueba con ubicación obligatoria', async () => {
    const item = transformarItemParaSupabase({
      id: '22222222-3333-4444-8555-666666666666',
      prestacionNombre: 'Cepillo dental',
      inventarioId: '33333333-4444-4555-8666-777777777777',
      cantidadInventario: 2,
      precioUnitarioInventario: 1000,
      ivaPorcentajeInventario: 19,
      valor: 2380
    }, '11111111-2222-4333-8444-555555555555', 'aaaaaaaa-1111-2222-3333-444444444444', estadoMock.clinicaId)

    expect(item).toMatchObject({
      inventario_id: '33333333-4444-4555-8666-777777777777',
      cantidad_inventario: 2,
      precio_unitario_inventario: 1000,
      iva_porcentaje_inventario: 19,
      valor: 2380
    })

    const presupuesto = await guardarPresupuesto({
      id: '11111111-2222-4333-8444-555555555555',
      folio: 'PRES-BP09-1',
      pacienteId: 'aaaaaaaa-1111-2222-3333-444444444444',
      pacienteNombre: 'Paciente de prueba',
      montoTotal: 2380,
      estado: 'enviado',
      items: [{
        id: '22222222-3333-4444-8555-666666666666',
        prestacionNombre: 'Cepillo dental',
        inventarioId: '33333333-4444-4555-8666-777777777777',
        cantidadInventario: 2,
        precioUnitarioInventario: 1000,
        ivaPorcentajeInventario: 19,
        valor: 2380
      }]
    })
    expect(presupuesto?.sincronizado).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('sincronizar_presupuesto_offline_bp12', expect.objectContaining({
      p_items: expect.arrayContaining([expect.objectContaining({ inventario_id: '33333333-4444-4555-8666-777777777777' })])
    }))

    const aprobacion = await presupuestosStorageService.aprobarPresupuestoConInventario(
      '11111111-2222-4333-8444-555555555555',
      '44444444-5555-4666-8777-888888888888'
    )
    expect(mockRpc).toHaveBeenCalledWith('aprobar_presupuesto_bp09', {
      p_presupuesto_id: '11111111-2222-4333-8444-555555555555',
      p_ubicacion_id: '44444444-5555-4666-8777-888888888888'
    })
    expect(aprobacion.estado).toBe('aprobado')
  })
})
