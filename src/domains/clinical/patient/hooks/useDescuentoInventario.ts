/**
 * useDescuentoInventario — estado presupuestario y consumo BP09; no cierra la evolución clínica.
 * En nube consulta el kit asociado y confirma el descuento en un RPC atómico;
 * el modo local conserva las asociaciones históricas de F2-12.
 */
import { useRef, useState } from 'react'
import {
  prepararMaterialesParaDescuento,
  descontarMateriales,
  type MaterialEnriquecido,
} from '../../../../application/treatment'
import type { EvolucionClinicaLocal } from '../services/evolucionesStorageService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { ItemPresupuesto } from './usePresupuestoItems'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { inventarioCloudService, type UbicacionInventario } from '../../../operations/inventory/services/inventarioCloudService'
import { notificationService } from '../../../../infrastructure/notification/notificationService'

const log = createLogger('useDescuentoInventario')

export type { MaterialEnriquecido }

export interface UseDescuentoInventarioOptions {
  paciente: { id: string | number; [key: string]: unknown }
  userProfile?: { nombreCompleto?: string; [key: string]: unknown } | null
  itemsPresupuesto?: ItemPresupuesto[]
  setItemsPresupuesto?: (items: ItemPresupuesto[]) => void
  evolucionesNotas?: EvolucionClinicaLocal[]
  setEvolucionesNotas?: (notas: EvolucionClinicaLocal[]) => void
}

export interface UseDescuentoInventarioReturn {
  itemPendienteDescuento: ItemPresupuesto | null
  categoriaDetectada: string
  materialesDisponibles: MaterialEnriquecido[]
  handleCambiarEstadoItem: (id: string | number, nuevoEstado: string) => void
  handleConfirmarDescuento: (materialesSeleccionados: unknown[], ubicacionId?: string) => void | Promise<void>
  handleCancelarDescuento: () => void
  ubicacionesInventario: UbicacionInventario[]
  descuentoGuardando: boolean
  errorDescuento: string
  modoSincronizado: boolean
}

const generarUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

const esUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export const useDescuentoInventario = ({
  paciente,
  userProfile: _userProfile,
  itemsPresupuesto = [],
  setItemsPresupuesto = () => {},
}: UseDescuentoInventarioOptions): UseDescuentoInventarioReturn => {
  const [itemPendienteDescuento, setItemPendienteDescuento] = useState<ItemPresupuesto | null>(null)
  const [categoriaDetectada, setCategoriaDetectada] = useState<string>('')
  const [materialesDisponibles, setMaterialesDisponibles] = useState<MaterialEnriquecido[]>([])
  const [kitId, setKitId] = useState<string | null>(null)
  const [kitUpdatedAt, setKitUpdatedAt] = useState<string | null>(null)
  const [ubicacionesInventario, setUbicacionesInventario] = useState<UbicacionInventario[]>([])
  const [descuentoGuardando, setDescuentoGuardando] = useState(false)
  const [errorDescuento, setErrorDescuento] = useState('')
  const idempotencyKeyRef = useRef<string | null>(null)

  const limpiarModalDescuento = (): void => {
    setItemPendienteDescuento(null)
    setCategoriaDetectada('')
    setMaterialesDisponibles([])
    setKitId(null)
    setKitUpdatedAt(null)
    setUbicacionesInventario([])
    setErrorDescuento('')
    idempotencyKeyRef.current = null
  }

  const handleCambiarEstadoItem = (id: string | number, nuevoEstado: string): void => {
    const itemRealizado = nuevoEstado === 'Realizado'
      ? itemsPresupuesto.find((item) => String(item.id) === String(id) && item.estado !== 'Realizado') || null
      : null

    const actualizados = itemsPresupuesto.map((item) => {
      if (String(item.id) === String(id)) {
        return { ...item, estado: nuevoEstado }
      }
      return item
    })
    setItemsPresupuesto(actualizados)

    if (!itemRealizado) return
    const itemFinal = itemRealizado

    idempotencyKeyRef.current = generarUuid()
    setErrorDescuento('')
    setItemPendienteDescuento(itemFinal)
    if (!USE_SUPABASE) {
      try {
        const { categoria, materiales } = prepararMaterialesParaDescuento(itemFinal.prestacion || '')
        setCategoriaDetectada(categoria)
        setMaterialesDisponibles(materiales)
      } catch (error) {
        log.error('Error al preparar modal de descuento:', error)
      }
      return
    }

    const prestacionId = String(itemFinal.prestacionId || '')
    if (!esUuid(paciente.id) || !esUuid(prestacionId)) {
      setCategoriaDetectada('Asociación de inventario')
      setMaterialesDisponibles([])
      setErrorDescuento('Esta línea no conserva un ID de paciente o prestación sincronizado. No se descontó stock. Revisa el catálogo BP08 y vuelve a asociar la prestación.')
      return
    }

    void Promise.all([
      inventarioCloudService.listarKits(prestacionId),
      inventarioCloudService.listarUbicaciones()
    ]).then(async ([kits, ubicaciones]) => {
      const kit = kits.find((candidate) => candidate.activo)
      setUbicacionesInventario(ubicaciones)
      setKitId(kit?.id || null)
      setKitUpdatedAt(kit?.updatedAt || null)
      setCategoriaDetectada(kit?.nombre || 'Kits de tratamiento')
      if (!kit) {
        setMaterialesDisponibles([])
        setErrorDescuento('No hay un kit activo sincronizado para esta prestación. El tratamiento quedó realizado y el stock no se modificó.')
        return
      }
      const saldos = await inventarioCloudService.listarSaldosPorUbicacion(kit.items.map((material) => material.itemId))
      const stockMap = new Map<string, Record<string, number>>()
      for (const balance of saldos) {
        const porUbicacion = stockMap.get(balance.itemId) || {}
        porUbicacion[balance.ubicacionId] = (porUbicacion[balance.ubicacionId] || 0) + balance.cantidad
        stockMap.set(balance.itemId, porUbicacion)
      }
      setMaterialesDisponibles(kit.items.map((material) => ({
        itemId: material.itemId,
        nombreInsumo: material.nombre,
        unidad: material.unidad,
        cantidad: material.cantidad,
        stockActual: Object.values(stockMap.get(material.itemId) || {}).reduce((sum, count) => sum + count, 0),
        stockPorUbicacion: stockMap.get(material.itemId) || {}
      })))
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el kit de tratamiento.'
      setErrorDescuento(message)
      log.warn('Error al cargar el kit sincronizado:', error)
    })
  }

  const handleConfirmarDescuento = async (materialesSeleccionados: unknown[], ubicacionId?: string): Promise<void> => {
    if (USE_SUPABASE) {
      const prestacionId = String(itemPendienteDescuento?.prestacionId || '')
      if (!itemPendienteDescuento || !kitId || !kitUpdatedAt || !esUuid(paciente.id) || !esUuid(prestacionId) || !esUuid(ubicacionId)) {
        setErrorDescuento('Falta el kit o una ubicación válida. No se modificó el stock.')
        return
      }
      if (!Array.isArray(materialesSeleccionados) || materialesSeleccionados.length !== materialesDisponibles.length) {
        setErrorDescuento('La selección del kit cambió. Cierra y vuelve a abrir el registro para revisar el stock.')
        return
      }
      setDescuentoGuardando(true)
      setErrorDescuento('')
      try {
        await inventarioCloudService.consumirKitTratamiento({
          kitId,
          kitUpdatedAt,
          pacienteId: String(paciente.id),
          prestacionId,
          ubicacionId,
          idempotencyKey: idempotencyKeyRef.current || (idempotencyKeyRef.current = generarUuid())
        })
        notificationService.mostrar('El kit se descontó de forma sincronizada y quedó en el historial de movimientos.', { tipo: 'success' })
        limpiarModalDescuento()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo descontar el kit del inventario.'
        setErrorDescuento(message)
        notificationService.mostrar(message, { tipo: 'error', titulo: 'No se descontó el kit' })
        log.warn('Error al descontar kit desde tratamiento:', error)
      } finally {
        setDescuentoGuardando(false)
      }
      return
    }

    try {
      if (Array.isArray(materialesSeleccionados) && materialesSeleccionados.length > 0) descontarMateriales(materialesSeleccionados)
    } catch (error) {
      log.error('Error al descontar inventario:', error)
    } finally {
      limpiarModalDescuento()
    }
  }

  const handleCancelarDescuento = (): void => limpiarModalDescuento()

  return {
    itemPendienteDescuento,
    categoriaDetectada,
    materialesDisponibles,
    handleCambiarEstadoItem,
    handleConfirmarDescuento,
    handleCancelarDescuento,
    ubicacionesInventario,
    descuentoGuardando,
    errorDescuento,
    modoSincronizado: USE_SUPABASE
  }
}
