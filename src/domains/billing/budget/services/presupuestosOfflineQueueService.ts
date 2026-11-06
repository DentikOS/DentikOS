/**
 * Servicio de cola offline para presupuestos e items (P1-3).
 *
 * Sigue el patrón transaccional padre-hijo (presupuestos + presupuesto_items)
 * con 4 colas tenant-aware:
 * 1. pendingPresupuestos (presupuestos padre pendientes)
 * 2. pendingPresupuestoItems (items pendientes con presupuestoId)
 * 3. pendingDeletesPresupuestos (IDs de presupuestos a eliminar)
 * 4. pendingDeletesPresupuestoItems (IDs de items a eliminar)
 *
 * Arquitectura:
 * Extraído de presupuestosStorageService.js para respetar el límite
 * arquitectónico constitucional de 462 líneas congeladas.
 */
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { Presupuesto } from '../schemas/presupuestoSchema'
import { resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'

const log = createLogger('presupuestosOfflineQueue')

// ──────────────────────────────────────────────────────────────────
// TIPOS E INTERFACES DE PRESUPUESTOS Y COLAS
// ──────────────────────────────────────────────────────────────────

export interface PresupuestoItemLocal {
  id?: string | number
  presupuestoId?: string | number
  pacienteId?: string | number | null
  prestacionId?: string | number | null
  prestacionNombre?: string
  nombrePrestacion?: string
  precioUnitario?: number
  subtotal?: number
  nombre?: string
  prestacion?: string
  valor?: number | string
  precio?: number | string
  convenio?: string
  inventarioId?: string | null
  cantidadInventario?: number | null
  inventarioUnidad?: string
  precioUnitarioInventario?: number | null
  ivaPorcentajeInventario?: number | null
  esLaboratorio?: boolean
  laboratorioId?: string | null
  tipoTrabajoLaboratorioId?: string | null
  piezaDentaria?: string | null
  colorGuia?: string | null
  indicacionesTecnicas?: string | null
  ordenLaboratorioId?: string | null
  estado?: string
  clinicaId?: string | null
  sincronizado?: boolean
  timestamp?: number
  [key: string]: unknown
}

export interface PresupuestoLocal extends Omit<Partial<Presupuesto>, 'pacienteId'> {
  id: string | number
  folio?: string
  pacienteId?: string | number | null
  pacienteNombre?: string
  pacienteRut?: string | null
  fechaEmision?: string
  convenio?: string
  moneda?: 'CLP' | 'ARS' | 'MXN' | 'COP' | 'PEN' | 'USD' | 'EUR'
  montoTotal?: number
  total?: number
  montoAbonado?: number
  estado?: string
  observacion?: string
  createdAt?: string
  updatedAt?: string
  sincronizado?: boolean
  clinicaId?: string | null
  items?: PresupuestoItemLocal[]
  origenPlan?: boolean
  planRevision?: string
  versionGrupoId?: string
  requiereRevision?: boolean
  descuentoGlobalPct?: number
  version?: number
  [key: string]: unknown
}

export interface PendingPresupuestoEntry {
  id: string | number
  folio?: string
  clinicaId?: string | null
  padreSubido?: boolean
  idOriginal?: string | number
  timestamp?: number
  [key: string]: unknown
}

export type PendingPresupuesto = PendingPresupuestoEntry | string | number

export interface PendingPresupuestoItemEntry extends PresupuestoItemLocal {
  id: string | number
  presupuestoId?: string | number
  clinicaId?: string | null
  timestamp?: number
}

export type PendingPresupuestoItem = PendingPresupuestoItemEntry | string | number

export interface PresupuestoSupabaseRow {
  id?: string
  user_id: string
  clinica_id?: string | null
  paciente_id?: string | null
  folio: string
  paciente_nombre: string
  paciente_rut?: string | null
  fecha_emision: string
  convenio: string
  moneda?: string
  monto_total: number
  monto_abonado?: number
  estado: string
  observacion: string
  detalle_items?: PresupuestoItemLocal[]
  total_bruto?: number
  total_descuentos?: number
  fecha_vencimiento?: string | null
  descuentos?: unknown[]
  plan_pago?: unknown
  version?: number
  origen_plan?: boolean
  plan_revision?: string | null
  version_grupo_id?: string | null
  requiere_revision?: boolean
  descuento_global_pct?: number | null
  archivado_at?: string | null
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface PresupuestoItemSupabaseRow {
  id?: string
  presupuesto_id?: string | null
  paciente_id?: string | null
  prestacion_id?: string | number | null
  prestacion_nombre: string
  valor: number
  convenio: string
  estado: string
  clinica_id?: string | null
  inventario_id?: string | null
  cantidad_inventario?: number | null
  precio_unitario_inventario?: number | null
  iva_porcentaje_inventario?: number | null
  es_laboratorio?: boolean
  laboratorio_id?: string | null
  tipo_trabajo_laboratorio_id?: string | null
  pieza_dentaria?: string | null
  color_guia?: string | null
  indicaciones_tecnicas?: string | null
  [key: string]: unknown
}

export interface PresupuestoHelpersContext {
  obtenerPresupuestos: () => PresupuestoLocal[]
  actualizarPresupuestosLocal: (presupuestos: PresupuestoLocal[]) => void
  presupuestosRepo?: unknown
}

// Repositorios aislados por clínica/tenant
export const pendingPresupuestosRepo = createTenantRepository<PendingPresupuesto[]>('studio_dental_presupuestos_pending', [])
export const pendingPresupuestoItemsRepo = createTenantRepository<PendingPresupuestoItem[]>('studio_dental_presupuesto_items_pending', [])
export const pendingDeletesPresupuestosRepo = createTenantRepository<(string | number)[]>('studio_dental_presupuestos_pending_deletes', [])
export const pendingDeletesPresupuestoItemsRepo = createTenantRepository<(string | number)[]>('studio_dental_presupuesto_items_pending_deletes', [])

export const obtenerClinicaId = (): string | null => {
  try {
    return getClinicaActivaSync()
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────────────────
// GETTERS Y SETTERS DE COLAS
// ──────────────────────────────────────────────────────────────────

export const obtenerPendingPresupuestos = (): PendingPresupuesto[] => {
  return pendingPresupuestosRepo.obtener([]) || []
}

export const guardarPendingPresupuestos = (pending?: PendingPresupuesto[] | null): void => {
  if (!pending || pending.length === 0) {
    pendingPresupuestosRepo.eliminar()
  } else {
    pendingPresupuestosRepo.guardar(pending)
  }
}

export const obtenerPendingPresupuestoItems = (): PendingPresupuestoItem[] => {
  return pendingPresupuestoItemsRepo.obtener([]) || []
}

export const guardarPendingPresupuestoItems = (pending?: PendingPresupuestoItem[] | null): void => {
  if (!pending || pending.length === 0) {
    pendingPresupuestoItemsRepo.eliminar()
  } else {
    pendingPresupuestoItemsRepo.guardar(pending)
  }
}

export const obtenerPendingDeletesPresupuestos = (): (string | number)[] => {
  return pendingDeletesPresupuestosRepo.obtener([]) || []
}

export const guardarPendingDeletesPresupuestos = (ids?: (string | number)[] | null): void => {
  if (!ids || ids.length === 0) {
    pendingDeletesPresupuestosRepo.eliminar()
  } else {
    pendingDeletesPresupuestosRepo.guardar(ids)
  }
}

export const obtenerPendingDeletesPresupuestoItems = (): (string | number)[] => {
  return pendingDeletesPresupuestoItemsRepo.obtener([]) || []
}

export const guardarPendingDeletesPresupuestoItems = (ids?: (string | number)[] | null): void => {
  if (!ids || ids.length === 0) {
    pendingDeletesPresupuestoItemsRepo.eliminar()
  } else {
    pendingDeletesPresupuestoItemsRepo.guardar(ids)
  }
}

// ──────────────────────────────────────────────────────────────────
// TRANSFORMACIONES PARA SUPABASE
// ──────────────────────────────────────────────────────────────────

export const transformarPresupuestoParaSupabase = (
  p: PresupuestoLocal,
  userId: string,
  clinicaId?: string | null
): PresupuestoSupabaseRow => {
  const out: PresupuestoSupabaseRow = {
    user_id: userId,
    folio: p.folio || `PRES-${Date.now()}`,
    paciente_nombre: p.pacienteNombre || 'Sin nombre',
    paciente_rut: p.pacienteRut || null,
    fecha_emision: p.fechaEmision || new Date().toISOString().split('T')[0],
    convenio: p.convenio || String(p.prevision || 'Particular'),
    moneda: p.moneda || 'CLP',
    monto_total: Number(p.totalAPagar ?? p.total ?? p.montoTotal ?? 0),
    estado: p.estado || 'Emitido',
    observacion: p.observacion || '',
    detalle_items: p.items || [],
    total_bruto: Number(p.totalBruto ?? 0),
    total_descuentos: Number(p.totalDescuentos ?? 0),
    fecha_vencimiento: typeof p.fechaVencimiento === 'string' ? p.fechaVencimiento : null,
    descuentos: Array.isArray(p.descuentos) ? p.descuentos : [],
    plan_pago: p.planPago || p.planCuotas || null,
    version: Number(p.version ?? 1),
    origen_plan: p.origenPlan === true,
    plan_revision: p.planRevision || null,
    version_grupo_id: p.versionGrupoId || null,
    requiere_revision: p.requiereRevision === true,
    descuento_global_pct: p.descuentoGlobalPct ?? null,
    archivado_at: typeof p.archivadoAt === 'string' ? p.archivadoAt : null,
  }

  if (p.pacienteId) {
    if (esUuidValido(p.pacienteId)) {
      out.paciente_id = String(p.pacienteId)
    } else {
      const pacienteUuid = migrationStorageService.obtenerSupabaseId(p.pacienteId)
      out.paciente_id = pacienteUuid || null
    }
  } else {
    out.paciente_id = null
  }

  if (clinicaId) out.clinica_id = clinicaId
  if (esUuidValido(p.id)) out.id = String(p.id)

  return out
}

export const transformarItemParaSupabase = (
  item: PresupuestoItemLocal,
  presupuestoUuid?: string | null,
  pacienteUuid?: string | null,
  clinicaId?: string | null
): PresupuestoItemSupabaseRow => {
  const itemOut: PresupuestoItemSupabaseRow = {
    presupuesto_id: presupuestoUuid || null,
    paciente_id: pacienteUuid || null,
    prestacion_id: esUuidValido(item.prestacionId) ? item.prestacionId! : null,
    prestacion_nombre: item.prestacionNombre || item.nombrePrestacion || item.nombre || item.prestacion || 'Sin nombre',
    valor: Number(item.subtotal ?? item.valor ?? item.precio ?? item.precioUnitario ?? 0),
    convenio: item.convenio || 'Particular',
    estado: item.estado || 'Pendiente'
  }
  if (clinicaId) itemOut.clinica_id = clinicaId
  if (esUuidValido(item.id)) itemOut.id = String(item.id)
  if (item.inventarioId) {
    itemOut.inventario_id = String(item.inventarioId)
    itemOut.cantidad_inventario = Number(item.cantidadInventario)
    itemOut.precio_unitario_inventario = Number(item.precioUnitarioInventario)
    itemOut.iva_porcentaje_inventario = Number(item.ivaPorcentajeInventario)
  }
  itemOut.es_laboratorio = item.esLaboratorio === true
  itemOut.laboratorio_id = item.esLaboratorio === true ? item.laboratorioId || null : null
  itemOut.tipo_trabajo_laboratorio_id = item.esLaboratorio === true ? item.tipoTrabajoLaboratorioId || null : null
  itemOut.pieza_dentaria = item.esLaboratorio === true ? item.piezaDentaria || null : null
  itemOut.color_guia = item.esLaboratorio === true ? item.colorGuia || null : null
  itemOut.indicaciones_tecnicas = item.esLaboratorio === true ? item.indicacionesTecnicas || null : null
  return itemOut
}

const sincronizarPresupuestoAtomico = async (
  presupuesto: PresupuestoLocal | null,
  presupuestoId: string | null,
  items: PresupuestoItemLocal[],
  userId: string,
  clinicaId: string
): Promise<string> => {
  if (!supabase) throw new Error('Supabase no disponible')

  const presupuestoPayload = presupuesto
    ? transformarPresupuestoParaSupabase(presupuesto, userId, clinicaId)
    : null
  if (presupuestoPayload && presupuesto) presupuestoPayload.id = String(presupuesto.id)

  const itemsPayload = items.map((item) => {
    if (item.id === undefined || item.id === null) {
      throw new Error('El ítem del presupuesto no tiene un ID estable')
    }
    const payload = transformarItemParaSupabase(
      item,
      presupuestoPayload?.id || presupuestoId,
      presupuestoPayload?.paciente_id || null,
      clinicaId
    )
    payload.id = String(item.id)
    return payload
  })

  const { data, error } = await supabase.rpc('sincronizar_presupuesto_offline_bp12', {
    p_presupuesto: presupuestoPayload,
    p_items: itemsPayload,
    p_presupuesto_id: presupuestoPayload ? null : presupuestoId
  })
  if (error) throw error
  if (typeof data !== 'string' || !esUuidValido(data)) {
    throw new Error('Supabase no devolvió el UUID del presupuesto sincronizado')
  }
  return data
}

// ──────────────────────────────────────────────────────────────────
// ENCOLADO DE OPERACIONES
// ──────────────────────────────────────────────────────────────────

export const encolarPresupuesto = ({
  id,
  folio,
  clinicaId,
  padreSubido = false,
  idOriginal
}: {
  id: string | number
  folio?: string
  clinicaId?: string | null
  padreSubido?: boolean
  idOriginal?: string | number
}): void => {
  try {
    const clinicaIdEfectivo = clinicaId || obtenerClinicaId()
    const pending = obtenerPendingPresupuestos()
    const yaEncolado = pending.some((item) =>
      typeof item === 'object' && item !== null ? item.id === id : item === id
    )
    if (yaEncolado) {
      // Una nueva edición exige volver a subir la cabecera antes de los ítems.
      const actualizado = pending.map((item) =>
        typeof item === 'object' && item !== null && item.id === id
          ? { ...item, padreSubido, idOriginal: idOriginal ?? item.idOriginal, folio: folio || item.folio }
          : item
      )
      guardarPendingPresupuestos(actualizado)
    } else {
      pending.push({
        id,
        folio,
        clinicaId: clinicaIdEfectivo,
        padreSubido,
        idOriginal,
        timestamp: Date.now()
      })
      guardarPendingPresupuestos(pending)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('Error al encolar en pendingPresupuestos:', msg)
  }
}

export const encolarPresupuestoItem = ({
  id,
  presupuestoId,
  clinicaId,
  ...itemData
}: PresupuestoItemLocal & { id: string | number; presupuestoId?: string | number; clinicaId?: string | null }): void => {
  try {
    const clinicaIdEfectivo = clinicaId || obtenerClinicaId()
    const pending = obtenerPendingPresupuestoItems()
    const idx = pending.findIndex((item) =>
      typeof item === 'object' && item !== null ? item.id === id : item === id
    )
    const entry: PendingPresupuestoItemEntry = {
      id,
      presupuestoId,
      clinicaId: clinicaIdEfectivo,
      ...itemData,
      timestamp: Date.now()
    }
    if (idx >= 0) {
      pending[idx] = entry
    } else {
      pending.push(entry)
    }
    guardarPendingPresupuestoItems(pending)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('Error al encolar en pendingPresupuestoItems:', msg)
  }
}

// ──────────────────────────────────────────────────────────────────
// HELPERS PRINCIPALES DE PERSISTENCIA Y COLA
// ──────────────────────────────────────────────────────────────────

/**
 * Guarda o actualiza un presupuesto padre con sus items (offline-first).
 */
export const guardarPresupuestoHelper = async (
  presupuesto: PresupuestoLocal,
  { obtenerPresupuestos, actualizarPresupuestosLocal }: PresupuestoHelpersContext
): Promise<PresupuestoLocal | null> => {
  if (!presupuesto) return null

  const id = presupuesto.id || Date.now()
  const clinicaIdActual = obtenerClinicaId()
  if (!clinicaIdActual || !esUuidValido(clinicaIdActual) || !presupuesto.pacienteId) return null
  const pacienteUuid = esUuidValido(presupuesto.pacienteId)
    ? String(presupuesto.pacienteId)
    : migrationStorageService.obtenerSupabaseId(presupuesto.pacienteId)
  if (!pacienteUuid || !esUuidValido(pacienteUuid)) return null

  const presupuestoLocal: PresupuestoLocal = {
    ...presupuesto,
    id,
    sincronizado: false,
    items: Array.isArray(presupuesto.items)
      ? presupuesto.items.map((item) => ({ ...item, id: item.id || crypto.randomUUID() }))
      : []
  }

  // 1. Actualizar caché y localStorage de inmediato
  const listado = Array.isArray(obtenerPresupuestos()) ? [...obtenerPresupuestos()] : []
  const idx = listado.findIndex((p) => p.id === id || (presupuesto.folio && p.folio === presupuesto.folio))
  if (idx >= 0) {
    listado[idx] = presupuestoLocal
  } else {
    listado.unshift(presupuestoLocal)
  }
  actualizarPresupuestosLocal(listado)

  // 2. Encolar padre e items
  encolarPresupuesto({
    id,
    folio: presupuestoLocal.folio,
    clinicaId: clinicaIdActual
  })

  if (presupuestoLocal.items && presupuestoLocal.items.length > 0) {
    for (const item of presupuestoLocal.items) {
      encolarPresupuestoItem({
        id: item.id!,
        presupuestoId: id,
        clinicaId: clinicaIdActual,
        ...item
      })
    }
  }

  // 3. Si hay conexión, subir cabecera e ítems en una sola transacción remota.
  if (USE_SUPABASE && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const itemsSincronizados = presupuestoLocal.items || []
        const uuidPadre = await sincronizarPresupuestoAtomico(
          presupuestoLocal,
          null,
          itemsSincronizados,
          user.id,
          clinicaIdActual
        )
        if (!esUuidValido(id)) migrationStorageService.registrarMapeo(id, uuidPadre)

        presupuestoLocal.id = uuidPadre
        const idsItemsSincronizados = new Set(itemsSincronizados.map((item) => String(item.id)))
        const idsPresupuesto = new Set([String(id), uuidPadre])
        const pendingP = obtenerPendingPresupuestos().filter((entry) => {
          const pendingId = typeof entry === 'object' && entry !== null ? entry.id : entry
          return !idsPresupuesto.has(String(pendingId))
        })
        const pendingI = obtenerPendingPresupuestoItems().filter((entry) => {
          if (typeof entry !== 'object' || entry === null) return true
          return !(idsPresupuesto.has(String(entry.presupuestoId)) && idsItemsSincronizados.has(String(entry.id)))
        })
        guardarPendingPresupuestos(pendingP)
        guardarPendingPresupuestoItems(pendingI)

        presupuestoLocal.sincronizado = !pendingI.some((entry) =>
          typeof entry === 'object' && entry !== null && idsPresupuesto.has(String(entry.presupuestoId))
        )
        const idxFinal = listado.findIndex((p) => p.id === id || String(p.id) === uuidPadre)
        if (idxFinal >= 0) {
          listado[idxFinal] = presupuestoLocal
          actualizarPresupuestosLocal(listado)
        }
      }
    } catch (errSync: unknown) {
      const msg = errSync instanceof Error ? errSync.message : String(errSync)
      log.warn('Fallo al sincronizar presupuesto con Supabase, queda en cola offline:', msg)
    }
  }

  return presupuestoLocal
}

/**
 * Guarda o edita un item individual dentro de un presupuesto existente.
 */
export const guardarItemPresupuestoHelper = async (
  item: PresupuestoItemLocal,
  { obtenerPresupuestos, actualizarPresupuestosLocal }: PresupuestoHelpersContext
): Promise<PresupuestoItemLocal | null> => {
  if (!item || !item.presupuestoId) return null
  const presupuestoIdLocal = item.presupuestoId
  const itemIdLocal = item.id ?? crypto.randomUUID()
  item = { ...item, id: itemIdLocal, presupuestoId: presupuestoIdLocal }

  const clinicaIdActual = obtenerClinicaId()
  const listado = Array.isArray(obtenerPresupuestos()) ? [...obtenerPresupuestos()] : []
  const pIndex = listado.findIndex((p) => p.id === presupuestoIdLocal)
  const padreYaSubido = (pIndex >= 0 && listado[pIndex].sincronizado === true) || obtenerPendingPresupuestos().some((pending) =>
    typeof pending === 'object' && pending !== null && pending.id === item.presupuestoId && pending.padreSubido === true
  )

  if (pIndex >= 0) {
    const padre = { ...listado[pIndex], sincronizado: false }
    const itemsPadre = Array.isArray(padre.items) ? [...padre.items] : []
    const iIndex = itemsPadre.findIndex((i) => i.id === item.id)

    if (iIndex >= 0) {
      itemsPadre[iIndex] = { ...itemsPadre[iIndex], ...item, sincronizado: false }
    } else {
      itemsPadre.push({ ...item, sincronizado: false })
    }
    padre.items = itemsPadre
    listado[pIndex] = padre
    actualizarPresupuestosLocal(listado)
  }

  // Encolar item y marcar padre como pendiente
  encolarPresupuestoItem({
    ...item,
    id: itemIdLocal,
    clinicaId: clinicaIdActual
  })
  encolarPresupuesto({
    id: presupuestoIdLocal,
    clinicaId: clinicaIdActual,
    padreSubido: esUuidValido(presupuestoIdLocal) && padreYaSubido
  })

  // Si el padre aún no existe en Supabase, subirlo junto con sus ítems.
  // Si ya existe, el ítem se envía solo, pero la RPC mantiene su escritura atómica.
  if (USE_SUPABASE && supabase && clinicaIdActual && esUuidValido(clinicaIdActual)) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const presupuestoLocalActual = pIndex >= 0 ? listado[pIndex] : null
      const incluirPadre = Boolean(presupuestoLocalActual && !padreYaSubido)
      const presupuestoUuid = esUuidValido(presupuestoIdLocal)
        ? String(presupuestoIdLocal)
        : migrationStorageService.obtenerSupabaseId(presupuestoIdLocal)

      if (user && (incluirPadre || (presupuestoUuid && esUuidValido(presupuestoUuid)))) {
        const itemsAEnviar = incluirPadre && presupuestoLocalActual
          ? presupuestoLocalActual.items || []
          : [item]
        const uuidPadre = await sincronizarPresupuestoAtomico(
          incluirPadre ? presupuestoLocalActual : null,
          incluirPadre ? null : presupuestoUuid,
          itemsAEnviar,
          user.id,
          clinicaIdActual
        )

        if (incluirPadre && presupuestoLocalActual && !esUuidValido(presupuestoLocalActual.id)) {
          migrationStorageService.registrarMapeo(presupuestoLocalActual.id, uuidPadre)
          presupuestoLocalActual.id = uuidPadre
        }

        const idsPresupuesto = new Set([String(presupuestoIdLocal), uuidPadre])
        const idsItemsSincronizados = new Set(itemsAEnviar.map((sincronizado) => String(sincronizado.id)))
        const pendingI = obtenerPendingPresupuestoItems().filter((entry) => {
          if (typeof entry !== 'object' || entry === null) return true
          return !(idsPresupuesto.has(String(entry.presupuestoId)) && idsItemsSincronizados.has(String(entry.id)))
        })
        guardarPendingPresupuestoItems(pendingI)

        const quedanItemsPendientes = pendingI.some((entry) =>
          typeof entry === 'object' && entry !== null && idsPresupuesto.has(String(entry.presupuestoId))
        )
        if (pIndex >= 0) {
          listado[pIndex] = { ...listado[pIndex], sincronizado: !quedanItemsPendientes }
          actualizarPresupuestosLocal(listado)
        }
        if (!quedanItemsPendientes) {
          guardarPendingPresupuestos(obtenerPendingPresupuestos().filter((entry) => {
            const pendingId = typeof entry === 'object' && entry !== null ? entry.id : entry
            return !idsPresupuesto.has(String(pendingId))
          }))
        }
      }
    } catch (e: unknown) {
      log.warn('Error al sincronizar item individual, queda en cola:', e)
    }
  }

  return item
}

/**
 * Elimina un presupuesto completo y sus items asociados.
 */
export const eliminarPresupuestoHelper = async (
  presupuestoId: string | number,
  { obtenerPresupuestos, actualizarPresupuestosLocal }: PresupuestoHelpersContext
): Promise<boolean> => {
  const actuales = obtenerPresupuestos() || []
  const target = actuales.find((p) => String(p.id) === String(presupuestoId))
  const actualizados = actuales.filter((p) => String(p.id) !== String(presupuestoId))
  actualizarPresupuestosLocal(actualizados)

  // Encolar en pendingDeletesPresupuestos
  const pendingDelP = obtenerPendingDeletesPresupuestos()
  if (!pendingDelP.includes(presupuestoId)) {
    guardarPendingDeletesPresupuestos([...pendingDelP, presupuestoId])
  }

  // Encolar items asociados en pendingDeletesPresupuestoItems
  if (target?.items && Array.isArray(target.items)) {
    const pendingDelI = obtenerPendingDeletesPresupuestoItems()
    const itemIds = target.items.map((i) => i.id).filter((id): id is string | number => id !== undefined && id !== null)
    const nuevos = itemIds.filter((id) => !pendingDelI.includes(id))
    if (nuevos.length > 0) {
      guardarPendingDeletesPresupuestoItems([...pendingDelI, ...nuevos])
    }
  }

  // Si Supabase está disponible y es UUID, intentar borrado físico inmediato
  if (USE_SUPABASE && supabase && esUuidValido(presupuestoId)) {
    try {
      const { error } = await supabase
        .from('presupuestos')
        .delete()
        .eq('id', presupuestoId)

      if (!error) {
        const restantesP = obtenerPendingDeletesPresupuestos().filter((id) => id !== presupuestoId)
        guardarPendingDeletesPresupuestos(restantesP)
      }
    } catch (err: unknown) {
      log.warn('Error al eliminar presupuesto remoto, queda en cola de deletes:', err)
    }
  }

  return true
}

/**
 * Elimina un item individual de un presupuesto.
 */
export const eliminarItemPresupuestoHelper = async (
  itemId: string | number,
  presupuestoId: string | number,
  { obtenerPresupuestos, actualizarPresupuestosLocal }: PresupuestoHelpersContext
): Promise<boolean> => {
  const actuales = obtenerPresupuestos() || []
  const pIndex = actuales.findIndex((p) => String(p.id) === String(presupuestoId))

  if (pIndex >= 0) {
    const padre = { ...actuales[pIndex] }
    if (Array.isArray(padre.items)) {
      padre.items = padre.items.filter((i) => String(i.id) !== String(itemId))
    }
    actuales[pIndex] = padre
    actualizarPresupuestosLocal(actuales)
  }

  // Encolar en pendingDeletesPresupuestoItems
  const pendingDelI = obtenerPendingDeletesPresupuestoItems()
  if (!pendingDelI.includes(itemId)) {
    guardarPendingDeletesPresupuestoItems([...pendingDelI, itemId])
  }

  // Si Supabase disponible, intentar borrar
  if (USE_SUPABASE && supabase && esUuidValido(itemId)) {
    try {
      const { error } = await supabase
        .from('presupuesto_items')
        .delete()
        .eq('id', itemId)

      if (!error) {
        const restantes = obtenerPendingDeletesPresupuestoItems().filter((id) => id !== itemId)
        guardarPendingDeletesPresupuestoItems(restantes)
      }
    } catch (err: unknown) {
      log.warn('Error al eliminar item en Supabase, queda en cola:', err)
    }
  }

  return true
}

/**
 * Procesa eliminaciones pendientes en Supabase (DELETE físico).
 */
export const procesarPendingDeletesPresupuestosHelper = async (): Promise<void> => {
  if (!USE_SUPABASE || !supabase) return

  // 1. Eliminar presupuestos padre
  const pendingDelP = obtenerPendingDeletesPresupuestos()
  if (Array.isArray(pendingDelP) && pendingDelP.length > 0) {
    const exitososP: (string | number)[] = []
    for (const id of pendingDelP) {
      if (!esUuidValido(id)) {
        exitososP.push(id)
        continue
      }
      try {
        const { error } = await supabase.from('presupuestos').delete().eq('id', id)
        if (!error) exitososP.push(id)
      } catch (err: unknown) {
        log.warn(`Error al ejecutar delete de presupuesto ${id}:`, err)
      }
    }
    if (exitososP.length > 0) {
      const setExitosos = new Set(exitososP)
      guardarPendingDeletesPresupuestos(pendingDelP.filter((id) => !setExitosos.has(id)))
    }
  }

  // 2. Eliminar items individuales
  const pendingDelI = obtenerPendingDeletesPresupuestoItems()
  if (Array.isArray(pendingDelI) && pendingDelI.length > 0) {
    const exitososI: (string | number)[] = []
    for (const id of pendingDelI) {
      if (!esUuidValido(id)) {
        exitososI.push(id)
        continue
      }
      try {
        const { error } = await supabase.from('presupuesto_items').delete().eq('id', id)
        if (!error) exitososI.push(id)
      } catch (err: unknown) {
        log.warn(`Error al ejecutar delete de item ${id}:`, err)
      }
    }
    if (exitososI.length > 0) {
      const setExitosos = new Set(exitososI)
      guardarPendingDeletesPresupuestoItems(pendingDelI.filter((id) => !setExitosos.has(id)))
    }
  }
}

/**
 * Procesa cada presupuesto y sus ítems pendientes en una sola transacción remota.
 */
export const procesarColaPresupuestosHelper = async ({
  obtenerPresupuestos,
  actualizarPresupuestosLocal
}: PresupuestoHelpersContext): Promise<{
  procesados: number
  fallidos: number
  razon?: string
  offline?: boolean
}> => {
  const clinicaIdActual = obtenerClinicaId()
  if (!clinicaIdActual) {
    return { procesados: 0, fallidos: 0, razon: 'sin-clinica' }
  }

  // Recuperar ítems huérfanos de versiones anteriores que drenaron la cabecera
  // aunque un hijo hubiese fallado. Esa cabecera ya existe en Supabase.
  const locales = obtenerPresupuestos() || []
  for (const child of obtenerPendingPresupuestoItems()) {
    if (typeof child !== 'object' || child === null || !child.presupuestoId) continue
    if (child.clinicaId && child.clinicaId !== clinicaIdActual) continue
    const padreUuid = esUuidValido(child.presupuestoId)
      ? String(child.presupuestoId)
      : migrationStorageService.obtenerSupabaseId(child.presupuestoId)
    if (!padreUuid || !esUuidValido(padreUuid)) continue
    const padreLocal = locales.find((p) => p.id === padreUuid)
    if (!padreLocal) continue
    if (obtenerPendingPresupuestos().some((entry) => {
      const id = typeof entry === 'object' && entry !== null ? entry.id : entry
      return id === padreUuid || id === child.presupuestoId
    })) continue
    encolarPresupuesto({
      id: padreUuid,
      idOriginal: child.presupuestoId,
      folio: padreLocal.folio,
      clinicaId: clinicaIdActual,
      padreSubido: true
    })
  }

  const pending = obtenerPendingPresupuestos()
  if (!pending || pending.length === 0) {
    await procesarPendingDeletesPresupuestosHelper()
    return { procesados: 0, fallidos: 0 }
  }

  if (!USE_SUPABASE || !supabase) {
    return { procesados: 0, fallidos: 0, offline: true }
  }

  let procesados = 0
  let fallidos = 0
  const procesadosExitososIds: (string | number)[] = []
  const listado = Array.isArray(obtenerPresupuestos()) ? [...obtenerPresupuestos()] : []
  const pendingItems = obtenerPendingPresupuestoItems()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { procesados: 0, fallidos: 0, razon: 'sin-usuario' }
    }

    for (const item of pending) {
      const id = typeof item === 'object' && item !== null ? item.id : item
      const itemClinicaId: string | null = (typeof item === 'object' && item !== null ? item.clinicaId : null) || clinicaIdActual

      // Aislamiento multi-tenant: procesar solo clínica activa
      if (itemClinicaId !== clinicaIdActual) {
        continue
      }

      let idx = -1
      try {
        const itemFolio = typeof item === 'object' && item !== null ? item.folio : undefined
        idx = listado.findIndex((p) => p.id === id || (itemFolio && p.folio === itemFolio))
        if (idx < 0) {
          // Ya no existe localmente, retirar de la cola
          procesadosExitososIds.push(id)
          continue
        }

        const pLocal = listado[idx]
        const padreYaSubido = typeof item === 'object' && item !== null && item.padreSubido === true
        const idOriginal = typeof item === 'object' && item !== null ? item.idOriginal : undefined
        const uuidLocal = esUuidValido(pLocal.id)
          ? String(pLocal.id)
          : migrationStorageService.obtenerSupabaseId(pLocal.id)
        const padreEstaRemoto = padreYaSubido && uuidLocal && esUuidValido(uuidLocal)
        const itemsDeEstePadre = pendingItems.filter((i) => {
          if (typeof i === 'object' && i !== null) {
            return [id, idOriginal, uuidLocal].some((idRelacionado) =>
              idRelacionado !== undefined && String(i.presupuestoId) === String(idRelacionado)
            ) && (!i.clinicaId || i.clinicaId === clinicaIdActual)
          }
          return false
        }) as PendingPresupuestoItemEntry[]
        const uuidPadre = await sincronizarPresupuestoAtomico(
          padreEstaRemoto ? null : pLocal,
          padreEstaRemoto ? uuidLocal : null,
          itemsDeEstePadre,
          user.id,
          clinicaIdActual
        )
        if (!esUuidValido(pLocal.id)) migrationStorageService.registrarMapeo(pLocal.id, uuidPadre)
        pLocal.id = uuidPadre

        const idsPresupuesto = new Set([String(id), String(idOriginal), uuidPadre])
        const idsItemsSincronizados = new Set(itemsDeEstePadre.map((child) => String(child.id)))
        const pendingRestantes = obtenerPendingPresupuestoItems().filter((child) => {
          if (typeof child !== 'object' || child === null) return true
          return !(idsPresupuesto.has(String(child.presupuestoId)) && idsItemsSincronizados.has(String(child.id)))
        })
        guardarPendingPresupuestoItems(pendingRestantes)
        pLocal.sincronizado = !pendingRestantes.some((child) =>
          typeof child === 'object' && child !== null && idsPresupuesto.has(String(child.presupuestoId))
        )
        listado[idx] = pLocal
        procesadosExitososIds.push(id)
        if (idOriginal !== undefined) procesadosExitososIds.push(idOriginal)
        procesadosExitososIds.push(uuidPadre)
        procesados++
      } catch (errPadre: unknown) {
        const msg = errPadre instanceof Error ? errPadre.message : String(errPadre)
        log.warn(`Fallo al sincronizar presupuesto ${id}; cabecera e ítems quedan en cola:`, msg)
        if (idx >= 0) {
          listado[idx] = { ...listado[idx], sincronizado: false }
          actualizarPresupuestosLocal(listado)
        }
        fallidos++
      }
    }

    if (procesados > 0 || fallidos > 0) {
      actualizarPresupuestosLocal(listado)
    }

    // Drenaje atómico: retirar solo exitosos
    if (procesadosExitososIds.length > 0) {
      const colaRestante = obtenerPendingPresupuestos().filter((item) =>
        !procesadosExitososIds.includes(typeof item === 'object' && item !== null ? item.id : item)
      )
      guardarPendingPresupuestos(colaRestante)
    }

    // Procesar eliminaciones pendientes
    await procesarPendingDeletesPresupuestosHelper()
  } catch (errGlobal: unknown) {
    log.error('Error global al procesar cola de presupuestos:', errGlobal)
    return { procesados, fallidos: fallidos + 1 }
  }

  return { procesados, fallidos }
}

/**
 * Refresca presupuestos desde Supabase protegiendo presupuestos locales pendientes.
 */
export const sincronizarPresupuestosDesdeSupabaseHelper = async ({
  obtenerPresupuestos,
  actualizarPresupuestosLocal
}: PresupuestoHelpersContext): Promise<PresupuestoLocal[]> => {
  log.info('Iniciando sincronización de presupuestos desde Supabase...')

  if (!USE_SUPABASE || !supabase) {
    log.info('Supabase no configurado, retornando caché')
    return obtenerPresupuestos()
  }

  try {
    const clinicaIdActual = obtenerClinicaId()
    const localesActuales = obtenerPresupuestos() || []
    const pending = obtenerPendingPresupuestos()
    const pendingItems = obtenerPendingPresupuestoItems().filter((item) =>
      typeof item === 'object' && item !== null && (!item.clinicaId || item.clinicaId === clinicaIdActual)
    ) as PendingPresupuestoItemEntry[]
    const pendingDelTenant = pending.filter((p) => {
      if (typeof p === 'object' && p !== null) {
        return !p.clinicaId || p.clinicaId === clinicaIdActual
      }
      return true
    })

    const idsPendientes = new Set(
      pendingDelTenant.map((p) => (typeof p === 'object' && p !== null ? p.id : p))
    )
    const foliosPendientes = new Set(
      pendingDelTenant
        .map((p) => (typeof p === 'object' && p !== null ? p.folio : null))
        .filter((f): f is string => Boolean(f))
    )

    const protegidosLocales = localesActuales.filter(
      (p) => idsPendientes.has(p.id) || (p.folio && foliosPendientes.has(p.folio)) || p.sincronizado === false
    )

    const { data, error } = await supabase
      .from('presupuestos')
      .select('*')
      .order('fecha_emision', { ascending: false })

    if (error) {
      log.warn('Error al sincronizar presupuestos desde Supabase:', error.message)
      return localesActuales
    }

    if (!Array.isArray(data)) return localesActuales

    // Mapeo básico snake_case -> camelCase
    const desdeSupabase: PresupuestoLocal[] = data.map((p: Record<string, unknown>) => ({
      id: (p.id as string | number) || '',
      folio: String(p.folio || ''),
      pacienteId: p.paciente_id as string | number | null,
      pacienteNombre: String(p.paciente_nombre || ''),
      pacienteRut: p.paciente_rut as string | null,
      fechaEmision: String(p.fecha_emision || ''),
      convenio: String(p.convenio || ''),
      moneda: resolverMonedaDocumento(p.moneda),
      montoTotal: Number(p.monto_total || 0),
      totalAPagar: Number(p.monto_total || 0),
      totalBruto: Number(p.total_bruto || 0),
      totalDescuentos: Number(p.total_descuentos || 0),
      montoAbonado: Number(p.monto_abonado || 0),
      fechaVencimiento: typeof p.fecha_vencimiento === 'string' ? p.fecha_vencimiento : undefined,
      items: Array.isArray(p.detalle_items) ? p.detalle_items as PresupuestoItemLocal[] : [],
      descuentos: Array.isArray(p.descuentos) ? p.descuentos as Presupuesto['descuentos'] : [],
      planPago: p.plan_pago as Presupuesto['planPago'],
      version: Number(p.version || 1),
      origenPlan: p.origen_plan === true,
      planRevision: typeof p.plan_revision === 'string' ? p.plan_revision : undefined,
      versionGrupoId: typeof p.version_grupo_id === 'string' ? p.version_grupo_id : undefined,
      requiereRevision: p.requiere_revision === true,
      descuentoGlobalPct: typeof p.descuento_global_pct === 'number' ? p.descuento_global_pct : undefined,
      archivadoAt: typeof p.archivado_at === 'string' ? p.archivado_at : undefined,
      estado: String(p.estado || ''),
      observacion: String(p.observacion || ''),
      createdAt: p.created_at as string | undefined,
      updatedAt: p.updated_at as string | undefined,
      sincronizado: !pendingDelTenant.some((entry) => {
        if (typeof entry !== 'object' || entry === null) return entry === p.id
        return entry.id === p.id || (entry.folio && entry.folio === p.folio)
      }) && !pendingItems.some((item) => item.presupuestoId === p.id)
    }))

    // Preservar presupuestos locales que aún no están en Supabase
    const idsRemotos = new Set(desdeSupabase.map((p) => p.id))
    const foliosRemotos = new Set(desdeSupabase.map((p) => p.folio).filter(Boolean))

    const protegidosNoPresentes = protegidosLocales.filter(
      (p) => !idsRemotos.has(p.id) && (!p.folio || !foliosRemotos.has(p.folio))
    )

    const listaFinal = [...protegidosNoPresentes, ...desdeSupabase]
    actualizarPresupuestosLocal(listaFinal)
    return listaFinal
  } catch (error: unknown) {
    log.error('Excepción al sincronizar presupuestos desde Supabase:', error)
    return obtenerPresupuestos()
  }
}
