import { useState, useMemo, useCallback, useEffect } from 'react'
import type React from 'react'
import { inventarioStorageService, type ItemInventario } from '../services/inventarioStorageService'
import {
  inventarioCloudService,
  type MovimientoInventarioCommand,
  type UbicacionInventario
} from '../services/inventarioCloudService'
import { calcularResumenInventario } from '../utils/inventarioCalculations'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { useRBAC } from '../../../../shared/hooks/useRBAC'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { notificationService } from '../../../../infrastructure/notification/notificationService'

export type { ItemInventario }

export interface ResumenInventario {
  totalInsumos: number
  stockCriticoCount: number
  stockBajoCount: number
  agotadosCount: number
  porVencerCount: number
  valorTotalInventario: number
}

export interface UseInventarioReturn {
  items: ItemInventario[]
  catalogoItems: ItemInventario[]
  resumen: ResumenInventario
  ubicaciones: UbicacionInventario[]
  movimientos: Array<Record<string, unknown>>
  cargando: boolean
  importacionPendiente: number
  copiaLocalPreservada: number
  progresoImportacion: number | null
  busqueda: string
  setBusqueda: React.Dispatch<React.SetStateAction<string>>
  categoriaFiltro: string
  setCategoriaFiltro: React.Dispatch<React.SetStateAction<string>>
  agregarOActualizarItem: (itemData: ItemInventario | (Partial<ItemInventario> & { nombre: string; categoria: string; cantidad: number; minimoCritico: number; unidad: string })) => void
  ajustarCantidadStock: (idItem: string | number, cambio: number) => void
  eliminarItem: (idItem: string | number) => Promise<void>
  registrarMovimiento: (command: MovimientoInventarioCommand) => Promise<void>
  importarDatosLocales: () => Promise<void>
  sincronizar: () => Promise<void>
}

const mensajeError = (error: unknown): string =>
  error instanceof Error ? error.message : 'No se pudo sincronizar el inventario.'

export const useInventario = (): UseInventarioReturn => {
  const { confirm } = useAppDialog()
  const { esAdmin, es } = useRBAC()
  const puedeVerMovimientos = esAdmin || es('asistente')
  const [items, setItems] = useState<ItemInventario[]>(() => inventarioStorageService.obtenerItems([]))
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([])
  const [movimientos, setMovimientos] = useState<Array<Record<string, unknown>>>([])
  const [cargando, setCargando] = useState<boolean>(USE_SUPABASE)
  const [importacionPendiente, setImportacionPendiente] = useState(0)
  const [copiaLocalPreservada, setCopiaLocalPreservada] = useState(0)
  const [progresoImportacion, setProgresoImportacion] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState<string>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todas')

  const sincronizar = useCallback(async (): Promise<void> => {
    if (!USE_SUPABASE) return
    setCargando(true)
    try {
      const resultado = await inventarioCloudService.sincronizar()
      setItems(resultado.items)
      setUbicaciones(resultado.ubicaciones)
      setImportacionPendiente(resultado.importacionPendiente)
      setCopiaLocalPreservada(resultado.copiaLocalPreservada)
      if (puedeVerMovimientos) setMovimientos(await inventarioCloudService.listarMovimientos())
    } catch (error) {
      notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se pudo sincronizar inventario' })
    } finally {
      setCargando(false)
    }
  }, [puedeVerMovimientos])

  useEffect(() => {
    if (USE_SUPABASE) void sincronizar()
    else if (puedeVerMovimientos) void inventarioCloudService.listarMovimientos().then(setMovimientos)
  }, [sincronizar, puedeVerMovimientos])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refrescarCacheYRemoto = (): void => {
      setItems(inventarioStorageService.obtenerItems([]))
      if (!USE_SUPABASE) {
        if (puedeVerMovimientos) void inventarioCloudService.listarMovimientos().then(setMovimientos)
        return
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void sincronizar(), 120)
    }
    window.addEventListener('inventario_actualizado', refrescarCacheYRemoto)
    window.addEventListener('realtime:inventario_changed', refrescarCacheYRemoto)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('inventario_actualizado', refrescarCacheYRemoto)
      window.removeEventListener('realtime:inventario_changed', refrescarCacheYRemoto)
    }
  }, [sincronizar])

  useEffect(() => {
    if (!USE_SUPABASE) return
    const procesarPendientes = (): void => {
      void inventarioCloudService.procesarColaPendiente().then(() => sincronizar())
    }
    window.addEventListener('online', procesarPendientes)
    return () => window.removeEventListener('online', procesarPendientes)
  }, [sincronizar])

  const resumen = useMemo(() => calcularResumenInventario(items) as ResumenInventario, [items])
  const itemsFiltrados = useMemo(() => items.filter(item => {
    const coincideCat = categoriaFiltro === 'Todas' || item.categoria === categoriaFiltro
    const consulta = busqueda.toLowerCase()
    const coincideBusqueda = !consulta ||
      (item.nombre || '').toLowerCase().includes(consulta) ||
      String(item.proveedor || '').toLowerCase().includes(consulta) ||
      String(item.codigo || '').toLowerCase().includes(consulta)
    return coincideCat && coincideBusqueda
  }), [items, busqueda, categoriaFiltro])

  const agregarOActualizarItem = useCallback((itemData: ItemInventario | (Partial<ItemInventario> & { nombre: string; categoria: string; cantidad: number; minimoCritico: number; unidad: string })): void => {
    const guardar = { ...(itemData as ItemInventario), id: itemData.id || Date.now() }
    setItems(prev => {
      const existe = prev.some(i => String(i.id) === String(guardar.id))
      const actualizados = existe
        ? prev.map(i => String(i.id) === String(guardar.id) ? guardar : i)
        : [guardar, ...prev]
      inventarioStorageService.guardarItems(actualizados)
      return actualizados
    })
    if (USE_SUPABASE) {
      void inventarioCloudService.guardarItem(guardar).then(({ item: remoto }) => {
        setItems(prev => {
          const actualizados = prev.map(current =>
            String(current.id) === String(guardar.id) || String(current.id) === String(remoto.id) ? remoto : current
          )
          inventarioStorageService.guardarItems(actualizados)
          return actualizados
        })
      }).catch((error: unknown) => {
        notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se guardó el artículo' })
        void sincronizar()
      })
    }
  }, [sincronizar])

  const ajustarCantidadStock = useCallback((idItem: string | number, cambio: number): void => {
    if (USE_SUPABASE) return
    setItems(prev => {
      const actualizados = prev.map(i => {
        if (String(i.id) !== String(idItem)) return i
        const nuevaCant = Math.max(0, (parseFloat(String(i.cantidad)) || 0) + cambio)
        return { ...i, cantidad: nuevaCant, stockActual: nuevaCant }
      })
      inventarioStorageService.guardarItems(actualizados)
      return actualizados
    })
  }, [])

  const eliminarItem = useCallback(async (idItem: string | number): Promise<void> => {
    const ok = await confirm({
      title: 'Archivar artículo',
      description: 'El artículo dejará de aparecer en el catálogo activo. Su historial y movimientos se conservarán.',
      variant: 'danger',
      confirmText: 'Archivar'
    })
    if (!ok) return
    try {
      const item = items.find(candidate => String(candidate.id) === String(idItem))
      await inventarioCloudService.archivarItem(idItem, item?.updatedAt)
      setItems(prev => {
        const actualizados = prev.filter(i => String(i.id) !== String(idItem))
        inventarioStorageService.guardarItems(actualizados)
        return actualizados
      })
    } catch (error) {
      notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se pudo archivar' })
    }
  }, [confirm, items])

  const registrarMovimiento = useCallback(async (command: MovimientoInventarioCommand): Promise<void> => {
    const result = await inventarioCloudService.registrarMovimiento(command)
    if (!result.queued) {
      if (USE_SUPABASE) await sincronizar()
      notificationService.mostrar('El movimiento quedó registrado en el inventario.', { tipo: 'success' })
    }
  }, [sincronizar])

  const importarDatosLocales = useCallback(async (): Promise<void> => {
    const total = inventarioCloudService.obtenerImportacionPendiente()?.items.length || 0
    if (total === 0) return
    setProgresoImportacion(0)
    try {
      await inventarioCloudService.importarDatosLocales((done, count) => {
        setProgresoImportacion(count > 0 ? Math.round((done / count) * 100) : 100)
      })
      await sincronizar()
      setImportacionPendiente(0)
      notificationService.mostrar('Los artículos y saldos locales quedaron importados con movimientos de apertura.', { tipo: 'success' })
    } catch (error) {
      notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'Importación incompleta' })
      await sincronizar()
    } finally {
      setProgresoImportacion(null)
    }
  }, [sincronizar])

  return {
    items: itemsFiltrados,
    catalogoItems: items,
    resumen,
    ubicaciones,
    movimientos,
    cargando,
    importacionPendiente,
    copiaLocalPreservada,
    progresoImportacion,
    busqueda,
    setBusqueda,
    categoriaFiltro,
    setCategoriaFiltro,
    agregarOActualizarItem,
    ajustarCantidadStock,
    eliminarItem,
    registrarMovimiento,
    importarDatosLocales,
    sincronizar
  }
}
