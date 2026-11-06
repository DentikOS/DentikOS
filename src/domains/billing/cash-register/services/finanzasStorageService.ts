/**
 * Persistencia de Finanzas (F4-02c-5 — migración a Supabase).
 *
 * Estrategia:
 * - Movimientos financieros (Ingresos/Egresos) → migrados a Supabase
 * - Convenios e Isapres → se mantienen en localStorage (no hay tabla en Supabase)
 * - Cierres y Arqueos de Caja → se mantienen en localStorage (no hay tabla en Supabase)
 *
 * API pública:
 * - obtenerMovimientos()              → SÍNCRONO, retorna de caché en memoria
 * - guardarMovimientos()              → ASYNC, escribe en Supabase + actualiza caché
 * - sincronizarDesdeSupabase()        → ASYNC, refresca caché desde Supabase
 * - resetCache()                      → limpia caché (para tests)
 *
 * Convenios y cierres de caja siguen el patrón legacy (localStorage directo)
 * porque no hay tablas correspondientes en Supabase en esta fase.
 * Se migrarán en F4-02d si es necesario.
 */
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { validarListaMovimientos, type MovimientoFinanciero } from '../schemas/movimientoFinancieroSchema'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { ConvenioConfig } from '../constants/finanzasConstants'

const log = createLogger('finanzasStorageService')

export type { MovimientoFinanciero } from '../schemas/movimientoFinancieroSchema'
export type { ConvenioConfig } from '../constants/finanzasConstants'

export interface CierreCaja {
  id: string | number
  fecha: string
  user_id?: string
  apertura?: number
  ingresos?: number
  egresos?: number
  cierre?: number
  diferencias?: number
  [key: string]: unknown
}

const STORAGE_KEY_MOVIMIENTOS = 'studio_dental_finanzas_movimientos'
const STORAGE_KEY_CONVENIOS = 'studio_dental_finanzas_convenios'
const STORAGE_KEY_CIERRES = 'studio_dental_finanzas_cierres_caja'

// F7-36 FASE 1 (Commit 1.5c): migrados a createTenantRepository para aislamiento multi-tenant.
// Las claves legacy ahora se almacenan como sd_<clinicaId>_<baseKey>.
// Fail-safe: si no hay clínica activa, los repos retornan defaultValue ([]).
const movimientosRepo = createTenantRepository<MovimientoFinanciero[]>(STORAGE_KEY_MOVIMIENTOS, [])
const conveniosRepo = createTenantRepository<ConvenioConfig[]>(STORAGE_KEY_CONVENIOS, [])
const cierresRepo = createTenantRepository<CierreCaja[]>(STORAGE_KEY_CIERRES, [])

// Caché en memoria solo para movimientos
let movimientosCache: MovimientoFinanciero[] | null = null
let cacheInicializado = false

// MAPEO DE CAMPOS (camelCase JS ↔ snake_case SQL)

const SNAKE_TO_CAMEL_MAP: Record<string, string> = {
  metodo_pago: 'metodoPago',
  user_id: 'userId',
  orden_laboratorio_id: 'ordenLaboratorioId',
  created_at: 'createdAt',
  updated_at: 'updatedAt'
}

const CAMEL_TO_SNAKE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SNAKE_TO_CAMEL_MAP).map(([snake, camel]) => [camel, snake])
)

const transformarDesdeSupabase = (movimientoDb: Record<string, unknown> | null): MovimientoFinanciero | null => {
  if (!movimientoDb) return null
  const resultado: Record<string, unknown> = {}
  for (const [claveDb, valor] of Object.entries(movimientoDb)) {
    const claveJs = SNAKE_TO_CAMEL_MAP[claveDb] || claveDb
    resultado[claveJs] = valor
  }
  return resultado as unknown as MovimientoFinanciero
}

const transformarParaSupabase = (movimientoJs: MovimientoFinanciero | null): Record<string, unknown> | null => {
  if (!movimientoJs) return null
  const resultado: Record<string, unknown> = {}
  for (const [claveJs, valor] of Object.entries(movimientoJs as Record<string, unknown>)) {
    if (claveJs === 'createdAt' || claveJs === 'updatedAt' || claveJs === 'userId') {
      continue
    }
    const claveDb = CAMEL_TO_SNAKE_MAP[claveJs] || claveJs
    if (valor === '' || valor === null || valor === undefined) {
      resultado[claveDb] = null
    } else {
      resultado[claveDb] = valor
    }
  }
  return resultado
}

const esMovimientoGestionadoPorLaboratorio = (movimiento: MovimientoFinanciero): boolean =>
  Boolean(movimiento.ordenLaboratorioId) || movimiento.categoria === 'Laboratorio Dental'

// ═══════════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE CACHÉ
// ═══════════════════════════════════════════════════════════════════

const inicializarCache = (defaults: MovimientoFinanciero[]): void => {
  if (cacheInicializado) return
  const datos = movimientosRepo.obtener(defaults)
  movimientosCache = Array.isArray(datos) ? datos : defaults
  cacheInicializado = true
}

// ═══════════════════════════════════════════════════════════════════
// OBTENER MOVIMIENTOS (SÍNCRONO)
// ═══════════════════════════════════════════════════════════════════

const obtenerMovimientos = (defaults: MovimientoFinanciero[] = []): MovimientoFinanciero[] | null => {
  if (!cacheInicializado) {
    inicializarCache(defaults)
  }
  return movimientosCache
}

// ═══════════════════════════════════════════════════════════════════
// SINCRONIZAR DESDE SUPABASE (ASYNC)
// ═══════════════════════════════════════════════════════════════════

const sincronizarDesdeSupabase = async (): Promise<MovimientoFinanciero[] | null> => {
  if (!USE_SUPABASE || !supabase) {
    return movimientosCache
  }

  try {
    const { data, error } = await supabase
      .from('movimientos_financieros')
      .select('*')
      .order('fecha', { ascending: false })

    if (error) {
      log.warn('Error al sincronizar desde Supabase:', error.message)
      return movimientosCache
    }

    if (!Array.isArray(data)) return movimientosCache

    // F7-36: Supabase vacío = clínica sin datos (no confundir con error de red). Error de red ya retornó cache arriba.
    if (data.length === 0) {
      log.info('Supabase retornó []: clínica sin movimientos, cache limpiada')
    }

    const nuevos = data.map(m => transformarDesdeSupabase(m as Record<string, unknown>)).filter((m): m is MovimientoFinanciero => Boolean(m))
    movimientosCache = nuevos
    movimientosRepo.guardar(nuevos)

    return nuevos
  } catch (error: unknown) {
    log.error('Excepción al sincronizar desde Supabase:', error)
    return movimientosCache
  }
}

// ═══════════════════════════════════════════════════════════════════
// GUARDAR MOVIMIENTOS (ASYNC)
// ═══════════════════════════════════════════════════════════════════

const guardarMovimientos = async (movs: unknown): Promise<boolean> => {
  // (F2-04c) — validación Zod antes de persistir
  const validacion = validarListaMovimientos(movs)
  if (!validacion.valido || !validacion.datos) {
    log.error(
      'Error de validación al guardar movimientos financieros (F2-04c):',
      validacion.error
    )
    return false
  }
  const datos = validacion.datos

  // 1. Actualizar caché en memoria inmediatamente
  movimientosCache = datos
  cacheInicializado = true

  // 2. Persistir en localStorage como caché
  movimientosRepo.guardar(datos)

  if (!USE_SUPABASE || !supabase) {
    return true
  }

  // 3. Sincronizar con Supabase en background
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return true
    }

    const aInsertar: MovimientoFinanciero[] = []
    const aActualizar: MovimientoFinanciero[] = []
    const idsEnMemoria = new Set<string | number>()

    for (const movimiento of datos) {
      if (esUuidValido(movimiento.id)) {
        idsEnMemoria.add(movimiento.id)
        if (!esMovimientoGestionadoPorLaboratorio(movimiento)) aActualizar.push(movimiento)
      } else if (!esMovimientoGestionadoPorLaboratorio(movimiento)) {
        aInsertar.push(movimiento)
      }
    }

    // UPDATE en batch
    if (aActualizar.length > 0) {
      const paraUpdate = aActualizar.map(m => ({
        ...transformarParaSupabase(m),
        user_id: user.id
      }))

      const { error: updateError } = await supabase
        .from('movimientos_financieros')
        .upsert(paraUpdate, { onConflict: 'id' })

      if (updateError) {
        log.error('Error al actualizar en Supabase:', updateError.message)
      }
    }

    // INSERT uno por uno
    for (const movimiento of aInsertar) {
      const paraInsert: Record<string, unknown> = {
        ...transformarParaSupabase(movimiento),
        user_id: user.id
      }
      delete paraInsert.id

      const { data: insertado, error: insertError } = await supabase
        .from('movimientos_financieros')
        .insert(paraInsert)
        .select('id')
        .single()

      if (insertError) {
        log.error(`Error al insertar movimiento:`, insertError.message)
        continue
      }

      // Actualizar el movimiento en caché con el nuevo UUID
      if (movimientosCache) {
        const index = movimientosCache.findIndex(m => !esUuidValido(m.id) &&
          m.fecha === movimiento.fecha && m.tipo === movimiento.tipo && m.monto === movimiento.monto)
        if (index >= 0) {
          const legacyId = movimientosCache[index].id
          movimientosCache[index] = { ...movimientosCache[index], id: insertado.id }
          migrationStorageService.registrarMapeo(legacyId, insertado.id)
        }
      }
    }

    // DELETE movimientos eliminados
    const { data: movimientosSupabase } = await supabase
      .from('movimientos_financieros')
      .select('id,categoria,orden_laboratorio_id')

    if (Array.isArray(movimientosSupabase)) {
      const idsAEliminar = movimientosSupabase
        .filter(m => {
          const row = m as { categoria?: string | null; orden_laboratorio_id?: string | null }
          return !row.orden_laboratorio_id && row.categoria !== 'Laboratorio Dental'
        })
        .map(m => (m as { id: string }).id)
        .filter(id => !idsEnMemoria.has(id))

      if (idsAEliminar.length > 0) {
        const { error: deleteError } = await supabase
          .from('movimientos_financieros')
          .delete()
          .in('id', idsAEliminar)

        if (deleteError) {
          log.error('Error al eliminar en Supabase:', deleteError.message)
        }
      }
    }

    // Persistir la caché actualizada
    if (movimientosCache) {
      movimientosRepo.guardar(movimientosCache)
    }

    return true
  } catch (error: unknown) {
    log.error('Excepción al guardar en Supabase:', error)
    return true
  }
}

// ═══════════════════════════════════════════════════════════════════
// RESET CACHE (para tests)
// ═══════════════════════════════════════════════════════════════════

const resetCache = (): void => {
  movimientosCache = null
  cacheInicializado = false
}

// ═══════════════════════════════════════════════════════════════════
// API PÚBLICA (preserva métodos legacy de convenios y cierres)
// ═══════════════════════════════════════════════════════════════════

export const finanzasStorageService = {
  // Movimientos (Ingresos / Egresos) — con migración a Supabase
  obtenerMovimientos,
  guardarMovimientos,
  sincronizarDesdeSupabase,
  resetCache,

  // Convenios e Isapres — siguen en localStorage (no hay tabla en Supabase)
  obtenerConvenios: (defaults: ConvenioConfig[] = []): ConvenioConfig[] => conveniosRepo.obtener(defaults),
  guardarConvenios: (convenios: ConvenioConfig[]): boolean => conveniosRepo.guardar(convenios),

  // Cierres y Arqueos de Caja — siguen en localStorage (no hay tabla en Supabase)
  obtenerCierresCaja: (): CierreCaja[] => cierresRepo.obtener([]),
  guardarCierresCaja: (cierres: CierreCaja[]): boolean => cierresRepo.guardar(cierres)
}
