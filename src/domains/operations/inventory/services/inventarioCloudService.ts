import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { notificationService } from '../../../../infrastructure/notification/notificationService'
import { inventarioStorageService, type ItemInventario } from './inventarioStorageService'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'

const log = createLogger('inventarioCloudService')
const pendingRepo = createTenantRepository<PendingOperation[]>('studio_dental_inventario_pending_ops', [])
const legacyRepo = createTenantRepository<LegacyImportSnapshot | null>('studio_dental_inventario_bp09_backup', null)
const localMovementsRepo = createTenantRepository<Array<Record<string, unknown>>>('studio_dental_inventario_movimientos', [])

export type TipoItemInventario =
  | 'insumo_clinico'
  | 'instrumental'
  | 'producto_venta'
  | 'implante_protesis'
  | 'equipamiento'

export interface UbicacionInventario {
  id: string
  tipo: 'bodega_central' | 'box'
  sucursalId?: string | null
  boxId?: string | null
  nombre: string
  estado: 'activo' | 'inactivo'
}

export interface ProductoVentaPresupuesto {
  id: string
  nombre: string
  unidad: string
  precioVenta: number
  ivaPorcentaje: number
}

export interface MovimientoInventarioCommand {
  idempotencyKey: string
  type: 'entrada_compra' | 'entrada_devolucion' | 'salida_tratamiento' | 'salida_venta' | 'salida_perdida_vencimiento' | 'ajuste' | 'transferencia'
  itemId: string
  quantity: number
  sourceLocationId?: string
  destinationLocationId?: string
  patientId?: string
  prestacionId?: string
  kitId?: string
  purchaseOrderId?: string
  purchaseOrderItemId?: string
  saleId?: string
  lotId?: string
  lotCode?: string
  expiryDate?: string
  providerId?: string
  sign?: 1 | -1
  reason?: string
}

interface PendingOperation {
  id: string
  kind: 'catalogo' | 'movimiento'
  action: 'insert' | 'update' | 'archive' | 'movement'
  payload: Record<string, unknown>
  expectedUpdatedAt?: string
  createdAt: string
}

export interface LegacyImportSnapshot {
  items: ItemInventario[]
  createdAt: string
  state: 'pendiente' | 'preservado_remoto_existente' | 'completado'
}

export interface SyncInventarioResult {
  items: ItemInventario[]
  ubicaciones: UbicacionInventario[]
  importacionPendiente: number
  copiaLocalPreservada: number
}

export interface ResultadoMovimiento {
  queued: boolean
  result?: Record<string, unknown>
}

export interface LoteDisponible {
  id: string
  itemId: string
  ubicacionId: string
  codigo: string
  fechaVencimiento: string | null
  cantidad: number
}

export interface ProveedorInventario {
  id: string
  nombre: string
  rut?: string | null
  contactoPrincipal?: string | null
  telefono?: string | null
  email?: string | null
  estado: 'activo' | 'inactivo'
}

export interface KitInventario {
  id: string
  nombre: string
  prestacionId: string
  descripcion: string
  activo: boolean
  updatedAt: string
  items: Array<{ itemId: string; nombre: string; unidad: string; cantidad: number; tipoItem: TipoItemInventario; stockPorUbicacion?: Record<string, number> }>
}

export interface OrdenCompraInventario {
  id: string
  folio: string
  proveedorId: string
  proveedor: string
  estado: string
  fechaPedido: string
  fechaEstimadaEntrega: string | null
  nota: string
  items: Array<{ id: string; itemId: string; nombre: string; codigo: string; unidad: string; cantidadSolicitada: number; cantidadRecibida: number; precioUnitario: number }>
}

export interface VentaInventario {
  id: string
  folio: string
  subtotal: number
  iva: number
  total: number
  metodoPago: string
  createdAt: string
}

export interface MantencionInventario {
  id: string
  itemId: string
  tipo: 'mantencion' | 'reparacion' | 'instalacion'
  fecha: string
  descripcion: string
  costo: number | null
}

export interface PermisoAditivoInventario {
  id: string
  userId: string
  permiso: 'compras' | 'aprobar_compras' | 'ajustes' | 'transferencias' | 'proveedores'
  createdAt: string
}

const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

const esUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const valorNumero = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const mapearItem = (row: Record<string, unknown>, fechaLote?: string): ItemInventario => ({
  id: String(row.id),
  nombre: String(row.nombre || ''),
  categoria: String(row.categoria || 'General'),
  cantidad: valorNumero(row.cantidad_actual),
  stockActual: valorNumero(row.cantidad_actual),
  minimoCritico: valorNumero(row.cantidad_minima),
  stockMinimo: valorNumero(row.cantidad_minima),
  unidad: String(row.unidad_medida || 'Unidades'),
  fechaVencimiento: fechaLote || String(row.fecha_vencimiento || ''),
  precioUnitario: valorNumero(row.precio_compra),
  precio: valorNumero(row.precio_compra),
  proveedor: String(row.proveedor || ''),
  codigo: String(row.codigo || ''),
  tipoItem: String(row.tipo_item || 'insumo_clinico') as TipoItemInventario,
  proveedorId: typeof row.proveedor_id === 'string' ? row.proveedor_id : '',
  precioCompra: row.precio_compra === null ? '' : valorNumero(row.precio_compra),
  precioVenta: row.precio_venta === null ? '' : valorNumero(row.precio_venta),
  ivaPorcentaje: valorNumero(row.iva_porcentaje),
  cantidadMaxima: row.cantidad_maxima === null ? '' : valorNumero(row.cantidad_maxima),
  puntoReorden: row.punto_reorden === null ? '' : valorNumero(row.punto_reorden),
  requiereLote: row.requiere_lote === true,
  requiereVencimiento: row.requiere_vencimiento === true,
  estadoCatalogo: row.estado_catalogo === 'inactivo' ? 'inactivo' : 'activo',
  estadoInstrumental: String(row.estado_instrumental || ''),
  requiereEsterilizacion: row.requiere_esterilizacion === true,
  numeroSerie: String(row.numero_serie || ''),
  fechaInstalacion: String(row.fecha_instalacion || ''),
  vidaUtilHoras: row.vida_util_horas === null ? '' : valorNumero(row.vida_util_horas),
  ultimaMantencion: String(row.ultima_mantencion || ''),
  proximaMantencion: String(row.proxima_mantencion || ''),
  origenLocalKey: String(row.origen_local_key || ''),
  updatedAt: String(row.updated_at || '')
})

const rowCatalogo = (item: Partial<ItemInventario>, userId?: string): Record<string, unknown> => {
  const id = esUuid(item.id) ? item.id : uuid()
  const code = String(item.codigo || '').trim() || `INV-${id.replace(/-/g, '').slice(0, 10).toUpperCase()}`
  return {
  id,
  ...(userId ? { user_id: userId } : {}),
  nombre: String(item.nombre || '').trim(),
  categoria: String(item.categoria || 'General').trim(),
  cantidad_minima: valorNumero(item.minimoCritico ?? item.stockMinimo),
  unidad_medida: String(item.unidad || 'Unidades'),
  proveedor: String(item.proveedor || '').trim() || null,
  codigo: code,
  tipo_item: item.tipoItem || 'insumo_clinico',
  proveedor_id: esUuid(item.proveedorId) ? item.proveedorId : null,
  precio_compra: item.precioCompra === '' || item.precioCompra == null ? null : valorNumero(item.precioCompra),
  precio_venta: item.precioVenta === '' || item.precioVenta == null ? null : valorNumero(item.precioVenta),
  iva_porcentaje: valorNumero(item.ivaPorcentaje),
  cantidad_maxima: item.cantidadMaxima === '' || item.cantidadMaxima == null ? null : valorNumero(item.cantidadMaxima),
  punto_reorden: item.puntoReorden === '' || item.puntoReorden == null ? null : valorNumero(item.puntoReorden),
  requiere_lote: item.requiereLote === true,
  requiere_vencimiento: item.requiereVencimiento === true,
  estado_catalogo: item.estadoCatalogo === 'inactivo' ? 'inactivo' : 'activo',
  estado_instrumental: item.estadoInstrumental || null,
  requiere_esterilizacion: item.requiereEsterilizacion === true,
  numero_serie: String(item.numeroSerie || '').trim() || null,
  fecha_instalacion: String(item.fechaInstalacion || '').trim() || null,
  vida_util_horas: item.vidaUtilHoras === '' || item.vidaUtilHoras == null ? null : valorNumero(item.vidaUtilHoras),
  ultima_mantencion: String(item.ultimaMantencion || '').trim() || null,
  proxima_mantencion: String(item.proximaMantencion || '').trim() || null,
  ...(typeof item.origenLocalKey === 'string' && item.origenLocalKey ? { origen_local_key: item.origenLocalKey } : {})
  }
}

const notificarCambio = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('inventario_actualizado'))
}

const estaSinConexion = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false

const guardarPendiente = (operation: PendingOperation): void => {
  const current = pendingRepo.obtener([])
  pendingRepo.guardar([...current, operation])
  notificarCambio()
  notificationService.mostrar('El cambio quedó guardado en este dispositivo y se sincronizará al recuperar conexión.', {
    tipo: 'warning', titulo: 'Sin conexión'
  })
}

const comprobarCliente = (): void => {
  if (!USE_SUPABASE || !supabase) throw new Error('La sincronización con Supabase no está disponible.')
}

const upsertRemoto = async (row: Record<string, unknown>, action: 'insert' | 'update', expectedUpdatedAt?: string): Promise<ItemInventario> => {
  comprobarCliente()
  if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
  if (action === 'insert') {
    const { data, error } = await supabase.from('inventario').insert(row).select('*').single()
    if (!error && data) return mapearItem(data as Record<string, unknown>)
    // Una respuesta de red puede perderse después del COMMIT. Reconocer el
    // mismo UUID evita duplicar el alta sin sobreescribir un registro distinto.
    const rowId = String(row.id || '')
    const { data: existing } = await supabase.from('inventario').select('*').eq('id', rowId).maybeSingle()
    if (existing) {
      const saved = existing as Record<string, unknown>
      if (saved.nombre === row.nombre && saved.codigo === row.codigo && saved.user_id === row.user_id) return mapearItem(saved)
    }
    throw error || new Error('No se pudo confirmar el guardado del artículo.')
  }

  const id = String(row.id || '')
  const changes = { ...row }
  delete changes.id
  delete changes.user_id
  let query = supabase.from('inventario').update(changes).eq('id', id)
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await query.select('*').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('El artículo cambió o dejó de estar disponible en la clínica. Actualiza la vista y vuelve a intentarlo.')
  return mapearItem(data as Record<string, unknown>)
}

const aplicarMovimientoLocal = (command: MovimientoInventarioCommand): void => {
  if (!Number.isFinite(command.quantity) || command.quantity <= 0) throw new Error('La cantidad debe ser mayor que cero.')
  const items = inventarioStorageService.obtenerItems([])
  const item = items.find((candidate) => String(candidate.id) === String(command.itemId))
  if (!item) throw new Error('El artículo ya no está disponible en este dispositivo.')
  if (command.type === 'transferencia') {
    if (!command.sourceLocationId || !command.destinationLocationId || command.sourceLocationId === command.destinationLocationId) {
      throw new Error('La transferencia necesita dos ubicaciones distintas.')
    }
  }
  const esEntrada = command.type === 'entrada_compra' || command.type === 'entrada_devolucion' || (command.type === 'ajuste' && command.sign === 1)
  const esSalida = command.type === 'salida_tratamiento' || command.type === 'salida_venta' || command.type === 'salida_perdida_vencimiento' || (command.type === 'ajuste' && command.sign === -1)
  if (!esEntrada && !esSalida && command.type !== 'transferencia') throw new Error('El movimiento necesita una dirección válida.')
  const stockActual = valorNumero(item.cantidad)
  if (esSalida && stockActual < command.quantity) throw new Error('Stock insuficiente para registrar este movimiento.')
  const updated = items.map((item) => {
    if (String(item.id) !== String(command.itemId)) return item
    if (command.type === 'transferencia') return item
    const delta = esEntrada ? command.quantity : -command.quantity
    return { ...item, cantidad: stockActual + delta, stockActual: stockActual + delta }
  })
  inventarioStorageService.guardarItems(updated)
  const registros = localMovementsRepo.obtener([])
  localMovementsRepo.guardar([{
    id: command.idempotencyKey,
    inventario_id: command.itemId,
    tipo: command.type,
    cantidad: command.quantity,
    signo: esEntrada ? 1 : esSalida ? -1 : 0,
    ubicacion_origen_id: command.sourceLocationId || null,
    ubicacion_destino_id: command.destinationLocationId || null,
    justificacion: command.reason || null,
    created_at: new Date().toISOString(),
    local: true
  }, ...registros.filter((movement) => movement.id !== command.idempotencyKey)])
  notificarCambio()
}

export const inventarioCloudService = {
  sincronizar: async (): Promise<SyncInventarioResult> => {
    const localItems = inventarioStorageService.obtenerItems([])
    if (!USE_SUPABASE || !supabase) {
      return {
        items: localItems,
        ubicaciones: [],
        importacionPendiente: 0,
        copiaLocalPreservada: 0
      }
    }

    const { data, error } = await supabase
      .from('inventario')
      .select('id,nombre,categoria,cantidad_actual,cantidad_minima,unidad_medida,fecha_vencimiento,proveedor,codigo,tipo_item,proveedor_id,precio_compra,precio_venta,iva_porcentaje,cantidad_maxima,punto_reorden,requiere_lote,requiere_vencimiento,estado_catalogo,estado_instrumental,requiere_esterilizacion,numero_serie,fecha_instalacion,vida_util_horas,ultima_mantencion,proxima_mantencion,origen_local_key,updated_at')
      .eq('estado_catalogo', 'activo')
      .order('nombre')
    if (error) throw error

    let legacySnapshot = legacyRepo.obtener(null)
    if (!legacySnapshot && localItems.length > 0) {
      legacySnapshot = {
        items: localItems.map((item) => ({ ...item })),
        createdAt: new Date().toISOString(),
        state: (data || []).length === 0 ? 'pendiente' : 'preservado_remoto_existente'
      }
      legacyRepo.guardar(legacySnapshot)
    }

    const remoto = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
    let expiries = new Map<string, string>()
    if (remoto.length > 0) {
      const [stockResult, lotsResult] = await Promise.all([
        supabase.from('inventario_stock_por_ubicacion').select('inventario_id,lote_id,cantidad').gt('cantidad', 0),
        supabase.from('inventario_lotes').select('id,fecha_vencimiento')
      ])
      if (stockResult.error) log.warn('No se pudieron cargar saldos por lote:', stockResult.error)
      if (lotsResult.error) log.warn('No se pudieron cargar vencimientos por lote:', lotsResult.error)
      const lotExpiry = new Map<string, string>()
      for (const lot of (lotsResult.data || []) as Array<Record<string, unknown>>) {
        if (typeof lot.id === 'string' && typeof lot.fecha_vencimiento === 'string') lotExpiry.set(lot.id, lot.fecha_vencimiento)
      }
      for (const balance of (stockResult.data || []) as Array<Record<string, unknown>>) {
        const itemId = String(balance.inventario_id || '')
        const lotId = String(balance.lote_id || '')
        const expiry = lotExpiry.get(lotId)
        if (itemId && expiry && (!expiries.has(itemId) || expiry < (expiries.get(itemId) || '9999-12-31'))) expiries.set(itemId, expiry)
      }
    }

    const items = remoto.map((row) => mapearItem(row, expiries.get(String(row.id))))
    inventarioStorageService.guardarItems(items)
    const { data: locationsData, error: locationsError } = await supabase
      .from('inventario_ubicaciones')
      .select('id,tipo,sucursal_id,box_id,nombre,estado')
      .eq('estado', 'activo')
      .order('tipo')
    if (locationsError) throw locationsError
    const ubicaciones = ((locationsData || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      tipo: String(row.tipo) as UbicacionInventario['tipo'],
      sucursalId: typeof row.sucursal_id === 'string' ? row.sucursal_id : null,
      boxId: typeof row.box_id === 'string' ? row.box_id : null,
      nombre: String(row.nombre || ''),
      estado: 'activo' as const
    }))
    return {
      items,
      ubicaciones,
      importacionPendiente: legacySnapshot?.state === 'pendiente' ? legacySnapshot.items.length : 0,
      copiaLocalPreservada: legacySnapshot?.state === 'preservado_remoto_existente' ? legacySnapshot.items.length : 0
    }
  },

  guardarItem: async (item: ItemInventario): Promise<{ item: ItemInventario; queued: boolean }> => {
    if (!USE_SUPABASE || !supabase) return { item, queued: false }
    // getSession usa la sesión local y permite encolar el alta sin requerir una
    // conexión de red para resolver la identidad autenticada.
    const { data: { session }, error: userError } = await supabase.auth.getSession()
    const user = session?.user
    if (userError || !user) throw new Error('Inicia sesión para guardar el artículo en la clínica.')
    const isRemoteId = esUuid(item.id)
    const row = rowCatalogo({
      ...item,
      id: isRemoteId ? item.id : uuid(),
      origenLocalKey: !isRemoteId ? `local:${String(item.id)}` : item.origenLocalKey
    }, user.id)
    if (estaSinConexion()) {
      guardarPendiente({
        id: uuid(), kind: 'catalogo', action: isRemoteId ? 'update' : 'insert',
        payload: row, expectedUpdatedAt: isRemoteId ? String(item.updatedAt || '') : undefined,
        createdAt: new Date().toISOString()
      })
      return { item: mapearItem({ ...row, id: row.id, cantidad_actual: item.cantidad, updated_at: item.updatedAt }), queued: true }
    }
    const saved = await upsertRemoto(row, isRemoteId ? 'update' : 'insert', String(item.updatedAt || '') || undefined)
    return { item: saved, queued: false }
  },

  archivarItem: async (id: string | number, updatedAt?: string): Promise<boolean> => {
    if (!USE_SUPABASE || !supabase) return true
    if (!esUuid(id)) return false
    if (estaSinConexion()) {
      guardarPendiente({
        id: uuid(), kind: 'catalogo', action: 'archive',
        payload: { id, estado_catalogo: 'inactivo' }, expectedUpdatedAt: updatedAt,
        createdAt: new Date().toISOString()
      })
      return true
    }
    let query = supabase.from('inventario').update({ estado_catalogo: 'inactivo' }).eq('id', id)
    if (updatedAt) query = query.eq('updated_at', updatedAt)
    const { data, error } = await query.select('id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('El artículo cambió o dejó de estar disponible. Actualiza la vista y vuelve a intentarlo.')
    return true
  },

  registrarMovimiento: async (command: MovimientoInventarioCommand): Promise<ResultadoMovimiento> => {
    if (!USE_SUPABASE || !supabase) {
      aplicarMovimientoLocal(command)
      return { queued: false, result: { ok: true, local: true } }
    }
    if (estaSinConexion()) {
      guardarPendiente({
        id: command.idempotencyKey, kind: 'movimiento', action: 'movement',
        payload: command as unknown as Record<string, unknown>, createdAt: new Date().toISOString()
      })
      return { queued: true }
    }
    const { data, error } = await supabase.rpc('registrar_movimiento_inventario', {
      p_payload: command as unknown as Record<string, unknown>
    })
    if (error) {
      if (estaSinConexion()) {
        guardarPendiente({
          id: command.idempotencyKey, kind: 'movimiento', action: 'movement',
          payload: command as unknown as Record<string, unknown>, createdAt: new Date().toISOString()
        })
        return { queued: true }
      }
      throw error
    }
    notificarCambio()
    return { queued: false, result: data as Record<string, unknown> }
  },

  listarMovimientos: async (limit = 40): Promise<Array<Record<string, unknown>>> => {
    if (!USE_SUPABASE || !supabase) return localMovementsRepo.obtener([]).slice(0, limit)
    const { data, error } = await supabase
      .from('inventario_movimientos')
      .select('id,inventario_id,tipo,cantidad,signo,ubicacion_origen_id,ubicacion_destino_id,justificacion,actor_user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data || []) as Array<Record<string, unknown>>
  },

  listarLotesDisponibles: async (): Promise<LoteDisponible[]> => {
    if (!USE_SUPABASE || !supabase) return []
    const [stockResult, lotsResult] = await Promise.all([
      supabase.from('inventario_stock_por_ubicacion').select('inventario_id,ubicacion_id,lote_id,cantidad').gt('cantidad', 0),
      supabase.from('inventario_lotes').select('id,inventario_id,codigo_lote,fecha_vencimiento')
    ])
    if (stockResult.error) throw stockResult.error
    if (lotsResult.error) throw lotsResult.error
    const lots = new Map<string, Record<string, unknown>>()
    for (const row of (lotsResult.data || []) as Array<Record<string, unknown>>) lots.set(String(row.id), row)
    return ((stockResult.data || []) as Array<Record<string, unknown>>).flatMap((balance) => {
      const lotId = String(balance.lote_id || '')
      const lot = lots.get(lotId)
      if (!lot || !lotId) return []
      return [{
        id: lotId,
        itemId: String(balance.inventario_id),
        ubicacionId: String(balance.ubicacion_id),
        codigo: String(lot.codigo_lote || ''),
        fechaVencimiento: typeof lot.fecha_vencimiento === 'string' ? lot.fecha_vencimiento : null,
        cantidad: valorNumero(balance.cantidad)
      }]
    })
  },

  listarUbicaciones: async (): Promise<UbicacionInventario[]> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('inventario_ubicaciones')
      .select('id,tipo,sucursal_id,box_id,nombre,estado').eq('estado', 'activo').order('tipo')
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), tipo: String(row.tipo) as UbicacionInventario['tipo'],
      sucursalId: typeof row.sucursal_id === 'string' ? row.sucursal_id : null,
      boxId: typeof row.box_id === 'string' ? row.box_id : null,
      nombre: String(row.nombre || ''), estado: 'activo'
    }))
  },

  listarProductosVenta: async (): Promise<ProductoVentaPresupuesto[]> => {
    const desdeCache = (): ProductoVentaPresupuesto[] => inventarioStorageService.obtenerItems([])
      .filter((item) => item.tipoItem === 'producto_venta' && item.estadoCatalogo !== 'inactivo')
      .filter((item) => esUuid(item.id) && Number.isFinite(Number(item.precioVenta)))
      .map((item) => ({
        id: String(item.id), nombre: item.nombre, unidad: item.unidad || 'Unidades',
        precioVenta: valorNumero(item.precioVenta), ivaPorcentaje: valorNumero(item.ivaPorcentaje)
      }))

    if (!USE_SUPABASE || !supabase || estaSinConexion()) return desdeCache()
    const { data, error } = await supabase.from('inventario')
      .select('id,nombre,unidad_medida,precio_venta,iva_porcentaje')
      .eq('tipo_item', 'producto_venta')
      .eq('estado_catalogo', 'activo')
      .not('precio_venta', 'is', null)
      .order('nombre')
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), nombre: String(row.nombre || ''), unidad: String(row.unidad_medida || 'Unidades'),
      precioVenta: valorNumero(row.precio_venta), ivaPorcentaje: valorNumero(row.iva_porcentaje)
    }))
  },

  listarSaldosPorUbicacion: async (itemIds?: string[]): Promise<Array<{ itemId: string; ubicacionId: string; cantidad: number }>> => {
    if (!USE_SUPABASE || !supabase) return []
    let query = supabase.from('inventario_stock_por_ubicacion').select('inventario_id,ubicacion_id,cantidad').gt('cantidad', 0)
    if (itemIds?.length) query = query.in('inventario_id', itemIds)
    const { data, error } = await query
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      itemId: String(row.inventario_id), ubicacionId: String(row.ubicacion_id), cantidad: valorNumero(row.cantidad)
    }))
  },

  listarProveedores: async (): Promise<ProveedorInventario[]> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('inventario_proveedores')
      .select('id,nombre,rut,contacto_principal,telefono,email,estado')
      .order('nombre')
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), nombre: String(row.nombre), rut: String(row.rut || ''),
      contactoPrincipal: String(row.contacto_principal || ''), telefono: String(row.telefono || ''),
      email: String(row.email || ''), estado: row.estado === 'inactivo' ? 'inactivo' : 'activo'
    }))
  },

  guardarProveedor: async (provider: Partial<ProveedorInventario> & { nombre: string }): Promise<ProveedorInventario> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Inicia sesión para guardar el proveedor.')
    const clinicId = useSesionStore.getState().clinicaActual
    if (!clinicId) throw new Error('No hay una clínica activa para guardar el proveedor.')
    const row = {
      nombre: provider.nombre.trim(), rut: String(provider.rut || '').trim() || null,
      contacto_principal: String(provider.contactoPrincipal || '').trim() || null,
      telefono: String(provider.telefono || '').trim() || null,
      email: String(provider.email || '').trim() || null,
      estado: provider.estado === 'inactivo' ? 'inactivo' : 'activo',
      ...(!provider.id ? { clinica_id: clinicId, created_by: user.id } : {})
    }
    if (provider.id) {
      const { data, error } = await supabase.from('inventario_proveedores').update(row).eq('id', provider.id)
        .select('id,nombre,rut,contacto_principal,telefono,email,estado').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('El proveedor ya no está disponible en la clínica activa.')
      const saved = data as Record<string, unknown>
      return { id: String(saved.id), nombre: String(saved.nombre), rut: String(saved.rut || ''), contactoPrincipal: String(saved.contacto_principal || ''), telefono: String(saved.telefono || ''), email: String(saved.email || ''), estado: saved.estado === 'inactivo' ? 'inactivo' : 'activo' }
    }
    const { data, error } = await supabase.from('inventario_proveedores').insert({ ...row, created_by: user.id })
      .select('id,nombre,rut,contacto_principal,telefono,email,estado').single()
    if (error) throw error
    const saved = data as Record<string, unknown>
    return { id: String(saved.id), nombre: String(saved.nombre), rut: String(saved.rut || ''), contactoPrincipal: String(saved.contacto_principal || ''), telefono: String(saved.telefono || ''), email: String(saved.email || ''), estado: saved.estado === 'inactivo' ? 'inactivo' : 'activo' }
  },

  listarPrestaciones: async (): Promise<Array<{ id: string; nombre: string }>> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('prestaciones').select('id,nombre').order('nombre')
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), nombre: String(row.nombre || '') }))
  },

  listarKits: async (prestacionId?: string): Promise<KitInventario[]> => {
    if (!USE_SUPABASE || !supabase) return []
    let kitQuery = supabase.from('inventario_kits')
      .select('id,nombre,prestacion_id,descripcion,activo,updated_at')
      .order('nombre')
    if (prestacionId) kitQuery = kitQuery.eq('prestacion_id', prestacionId)
    const { data: kitData, error: kitError } = await kitQuery
    if (kitError) throw kitError
    const kits = (kitData || []) as Array<Record<string, unknown>>
    if (kits.length === 0) return []
    const kitIds = kits.map((kit) => String(kit.id))
    const { data: linesData, error: linesError } = await supabase.from('inventario_kit_items')
      .select('kit_id,inventario_id,cantidad').in('kit_id', kitIds)
    if (linesError) throw linesError
    const lines = (linesData || []) as Array<Record<string, unknown>>
    const itemIds = [...new Set(lines.map((line) => String(line.inventario_id)))]
    const { data: itemData, error: itemError } = itemIds.length
      ? await supabase.from('inventario').select('id,nombre,unidad_medida,tipo_item').in('id', itemIds)
      : { data: [], error: null }
    if (itemError) throw itemError
    const itemMap = new Map(((itemData || []) as Array<Record<string, unknown>>).map((item) => [String(item.id), item]))
    return kits.map((kit) => ({
      id: String(kit.id), nombre: String(kit.nombre || ''), prestacionId: String(kit.prestacion_id || ''),
      descripcion: String(kit.descripcion || ''), activo: kit.activo === true, updatedAt: String(kit.updated_at || ''),
      items: lines.filter((line) => String(line.kit_id) === String(kit.id)).flatMap((line) => {
        const item = itemMap.get(String(line.inventario_id))
        if (!item) return []
        return [{
          itemId: String(item.id), nombre: String(item.nombre || ''), unidad: String(item.unidad_medida || 'Unidades'),
          cantidad: valorNumero(line.cantidad), tipoItem: String(item.tipo_item || 'insumo_clinico') as TipoItemInventario
        }]
      })
    }))
  },

  guardarKit: async (kit: Omit<KitInventario, 'id' | 'items' | 'updatedAt'> & { id?: string; items: Array<{ itemId: string; cantidad: number }> }): Promise<string> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { data, error } = await supabase.rpc('guardar_kit_inventario', {
      p_payload: {
        id: kit.id || undefined, nombre: kit.nombre, prestacionId: kit.prestacionId,
        descripcion: kit.descripcion, activo: kit.activo, items: kit.items.map((item) => ({ itemId: item.itemId, quantity: item.cantidad }))
      }
    })
    if (error) throw error
    return String(data)
  },

  consumirKitTratamiento: async (params: { kitId: string; kitUpdatedAt: string; pacienteId: string; prestacionId: string; ubicacionId: string; idempotencyKey: string }): Promise<Record<string, unknown>> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { data, error } = await supabase.rpc('consumir_kit_tratamiento_inventario', {
      p_kit_id: params.kitId, p_paciente_id: params.pacienteId,
      p_prestacion_id: params.prestacionId, p_ubicacion_id: params.ubicacionId,
      p_idempotency_key: params.idempotencyKey, p_kit_updated_at: params.kitUpdatedAt
    })
    if (error) throw error
    notificarCambio()
    return data as Record<string, unknown>
  },

  crearOrdenCompra: async (input: { idempotencyKey: string; providerId: string; branchId?: string; expectedDeliveryDate?: string; note?: string; items: Array<{ itemId: string; quantity: number; unitPrice?: number }> }): Promise<string> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { data, error } = await supabase.rpc('crear_orden_compra_inventario', {
      p_payload: { ...input, items: input.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity, unitPrice: item.unitPrice })) }
    })
    if (error) throw error
    notificarCambio()
    return String(data)
  },

  aprobarOrdenCompra: async (orderId: string): Promise<void> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { error } = await supabase.rpc('aprobar_orden_compra_inventario', { p_orden_id: orderId })
    if (error) throw error
    notificarCambio()
  },

  cancelarOrdenCompra: async (orderId: string, reason: string): Promise<void> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { error } = await supabase.rpc('cancelar_orden_compra_inventario', { p_orden_id: orderId, p_justificacion: reason })
    if (error) throw error
    notificarCambio()
  },

  listarOrdenesCompra: async (limit = 50): Promise<OrdenCompraInventario[]> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data: orderData, error: orderError } = await supabase.from('inventario_ordenes_compra')
      .select('id,folio,proveedor_id,estado,fecha_pedido,fecha_estimada_entrega,nota').order('fecha_pedido', { ascending: false }).limit(limit)
    if (orderError) throw orderError
    const orders = (orderData || []) as Array<Record<string, unknown>>
    if (orders.length === 0) return []
    const orderIds = orders.map((order) => String(order.id))
    const providerIds = [...new Set(orders.map((order) => String(order.proveedor_id)))]
    const [linesResult, providerResult] = await Promise.all([
      supabase.from('inventario_orden_compra_items').select('id,orden_compra_id,inventario_id,cantidad_solicitada,cantidad_recibida,precio_unitario').in('orden_compra_id', orderIds),
      supabase.from('inventario_proveedores').select('id,nombre').in('id', providerIds)
    ])
    if (linesResult.error) throw linesResult.error
    if (providerResult.error) throw providerResult.error
    const lines = (linesResult.data || []) as Array<Record<string, unknown>>
    const inventoryIds = [...new Set(lines.map((line) => String(line.inventario_id)))]
    const { data: inventoryData, error: inventoryError } = inventoryIds.length
      ? await supabase.from('inventario').select('id,nombre,codigo,unidad_medida').in('id', inventoryIds)
      : { data: [], error: null }
    if (inventoryError) throw inventoryError
    const providers = new Map(((providerResult.data || []) as Array<Record<string, unknown>>).map((row) => [String(row.id), String(row.nombre || '')]))
    const inventory = new Map(((inventoryData || []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]))
    return orders.map((order) => ({
      id: String(order.id), folio: String(order.folio), proveedorId: String(order.proveedor_id),
      proveedor: providers.get(String(order.proveedor_id)) || '', estado: String(order.estado),
      fechaPedido: String(order.fecha_pedido), fechaEstimadaEntrega: typeof order.fecha_estimada_entrega === 'string' ? order.fecha_estimada_entrega : null,
      nota: String(order.nota || ''),
      items: lines.filter((line) => String(line.orden_compra_id) === String(order.id)).flatMap((line) => {
        const item = inventory.get(String(line.inventario_id))
        if (!item) return []
        return [{
          id: String(line.id), itemId: String(line.inventario_id), nombre: String(item.nombre || ''),
          codigo: String(item.codigo || ''), unidad: String(item.unidad_medida || 'Unidades'),
          cantidadSolicitada: valorNumero(line.cantidad_solicitada), cantidadRecibida: valorNumero(line.cantidad_recibida),
          precioUnitario: valorNumero(line.precio_unitario)
        }]
      })
    }))
  },

  registrarVenta: async (input: { idempotencyKey: string; locationId: string; paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia'; patientId?: string; items: Array<{ itemId: string; quantity: number }> }): Promise<Record<string, unknown>> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { data, error } = await supabase.rpc('registrar_venta_inventario', { p_payload: input })
    if (error) throw error
    notificarCambio()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.PAGOS_CHANGED, { detail: { source: 'inventario' } }))
    }
    return data as Record<string, unknown>
  },

  listarVentas: async (limit = 50): Promise<VentaInventario[]> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('inventario_ventas')
      .select('id,folio,subtotal,iva_total,total,metodo_pago,created_at').order('created_at', { ascending: false }).limit(limit)
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), folio: String(row.folio), subtotal: valorNumero(row.subtotal), iva: valorNumero(row.iva_total),
      total: valorNumero(row.total), metodoPago: String(row.metodo_pago), createdAt: String(row.created_at)
    }))
  },

  puedeOperar: async (accion: string): Promise<boolean> => {
    if (!USE_SUPABASE || !supabase) return false
    const { data, error } = await supabase.rpc('puede_operar_inventario', { p_accion: accion })
    if (error) throw error
    return data === true
  },

  listarMiembrosPermisos: async (): Promise<Array<{ userId: string; rol: string; activo: boolean }>> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('miembros_clinica').select('user_id,rol,activo').order('rol')
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      userId: String(row.user_id), rol: String(row.rol || ''), activo: row.activo === true
    }))
  },

  listarPermisosAditivos: async (): Promise<PermisoAditivoInventario[]> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('inventario_permisos_aditivos').select('id,user_id,permiso,created_at').order('created_at', { ascending: false })
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), userId: String(row.user_id), permiso: String(row.permiso) as PermisoAditivoInventario['permiso'],
      createdAt: String(row.created_at)
    }))
  },

  guardarPermisoAditivo: async (userId: string, permiso: PermisoAditivoInventario['permiso']): Promise<void> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const clinicId = useSesionStore.getState().clinicaActual
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!clinicId || authError || !user) throw new Error('No hay una sesión y clínica activas para guardar el permiso.')
    const { error } = await supabase.from('inventario_permisos_aditivos').insert({
      clinica_id: clinicId, user_id: userId, permiso, granted_by: user.id
    })
    if (error) throw error
    notificarCambio()
  },

  quitarPermisoAditivo: async (id: string): Promise<void> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { error } = await supabase.from('inventario_permisos_aditivos').delete().eq('id', id)
    if (error) throw error
    notificarCambio()
  },

  registrarMantencion: async (input: { itemId: string; tipo: 'mantencion' | 'reparacion' | 'instalacion'; fecha: string; descripcion: string; costo?: number }): Promise<void> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const { error } = await supabase.rpc('registrar_mantencion_inventario', {
      p_inventario_id: input.itemId, p_tipo: input.tipo, p_fecha: input.fecha,
      p_descripcion: input.descripcion.trim(), p_costo: input.costo ?? null
    })
    if (error) throw error
    notificarCambio()
  },

  listarMantenciones: async (limit = 100): Promise<MantencionInventario[]> => {
    if (!USE_SUPABASE || !supabase) return []
    const { data, error } = await supabase.from('inventario_mantenciones')
      .select('id,inventario_id,tipo,fecha,descripcion,costo').order('fecha', { ascending: false }).limit(limit)
    if (error) throw error
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), itemId: String(row.inventario_id),
      tipo: String(row.tipo) as MantencionInventario['tipo'], fecha: String(row.fecha),
      descripcion: String(row.descripcion || ''), costo: row.costo == null ? null : valorNumero(row.costo)
    }))
  },

  obtenerImportacionPendiente: (): LegacyImportSnapshot | null => legacyRepo.obtener(null),

  importarDatosLocales: async (onProgress?: (done: number, total: number) => void): Promise<void> => {
    comprobarCliente()
    if (!supabase) throw new Error('La sincronización con Supabase no está disponible.')
    const snapshot = legacyRepo.obtener(null)
    if (!snapshot || snapshot.state !== 'pendiente') throw new Error('No hay datos locales disponibles para importar.')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Inicia sesión para importar el inventario local.')
    const { data: locations, error: locationError } = await supabase
      .from('inventario_ubicaciones')
      .select('id')
      .eq('tipo', 'bodega_central')
      .eq('estado', 'activo')
      .limit(1)
    if (locationError) throw locationError
    const locationId = (locations?.[0] as Record<string, unknown> | undefined)?.id
    if (typeof locationId !== 'string') throw new Error('La clínica no tiene una bodega central activa.')

    for (const [index, source] of snapshot.items.entries()) {
      const originKey = `local:${String(source.id)}`
      const { data: existing, error: findError } = await supabase
        .from('inventario')
        .select('id')
        .eq('origen_local_key', originKey)
        .maybeSingle()
      if (findError) throw findError
      let remoteId = (existing as Record<string, unknown> | null)?.id
      if (typeof remoteId !== 'string') {
        const row = rowCatalogo({
          ...source,
          id: uuid(),
          tipoItem: (source.tipoItem as TipoItemInventario) || 'insumo_clinico',
          origenLocalKey: originKey,
          cantidad: 0
        }, user.id)
        const { data, error } = await supabase.from('inventario').insert(row).select('id').single()
        if (error) {
          const { data: repeated } = await supabase.from('inventario').select('id').eq('origen_local_key', originKey).maybeSingle()
          if (!repeated) throw error
          remoteId = String((repeated as Record<string, unknown>).id)
        } else {
          remoteId = String((data as Record<string, unknown>).id)
        }
      }
      if (typeof remoteId !== 'string') throw new Error('No se pudo identificar el artículo importado.')
      const stockItemId = remoteId
      const quantity = valorNumero(source.cantidad)
      if (quantity > 0) {
        await inventarioCloudService.registrarMovimiento({
          idempotencyKey: stockItemId,
          type: 'ajuste',
          itemId: stockItemId,
          quantity,
          sign: 1,
          destinationLocationId: locationId,
          lotCode: `LOCAL-${String(source.id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) || 'IMPORT'}`,
          expiryDate: source.fechaVencimiento || undefined,
          reason: 'Importación revisada del inventario local previo a BP09'
        })
      }
      onProgress?.(index + 1, snapshot.items.length)
    }
    legacyRepo.guardar({ ...snapshot, state: 'completado' })
    await inventarioCloudService.sincronizar()
  },

  procesarColaPendiente: async (): Promise<number> => {
    if (!USE_SUPABASE || !supabase || estaSinConexion()) return 0
    let queue = pendingRepo.obtener([])
    let processed = 0
    for (const operation of queue) {
      try {
        if (operation.kind === 'movimiento') {
          const { error } = await supabase.rpc('registrar_movimiento_inventario', { p_payload: operation.payload })
          if (error) throw error
        } else if (operation.action === 'archive') {
          const { id, estado_catalogo: estadoCatalogo } = operation.payload
          let query = supabase.from('inventario').update({ estado_catalogo: estadoCatalogo }).eq('id', String(id))
          if (operation.expectedUpdatedAt) query = query.eq('updated_at', operation.expectedUpdatedAt)
          const { data, error } = await query.select('id').maybeSingle()
          if (error) throw error
          if (!data) throw new Error('El artículo cambió antes de sincronizarse.')
        } else if (operation.action === 'insert') {
          const { error } = await supabase.from('inventario').insert(operation.payload)
          if (error) {
            const { data: existing } = await supabase.from('inventario').select('id,nombre,codigo,user_id')
              .eq('id', String(operation.payload.id || '')).maybeSingle()
            if (!existing || existing.nombre !== operation.payload.nombre || existing.codigo !== operation.payload.codigo || existing.user_id !== operation.payload.user_id) throw error
          }
        } else {
          const id = String(operation.payload.id || '')
          const changes = { ...operation.payload }
          delete changes.id
          delete changes.user_id
          let query = supabase.from('inventario').update(changes).eq('id', id)
          if (operation.expectedUpdatedAt) query = query.eq('updated_at', operation.expectedUpdatedAt)
          const { data, error } = await query.select('id').maybeSingle()
          if (error) throw error
          if (!data) throw new Error('El artículo cambió antes de sincronizarse.')
        }
        queue = queue.filter((entry) => entry.id !== operation.id)
        pendingRepo.guardar(queue)
        processed += 1
      } catch (error) {
        log.warn('La sincronización BP09 quedó pendiente:', error)
        break
      }
    }
    if (processed > 0) {
      notificarCambio()
      await inventarioCloudService.sincronizar()
    }
    return processed
  }
}
