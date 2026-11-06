import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../../shared/ui/ui/Button'
import { Input } from '../../../../shared/ui/ui/Input'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { useRBAC } from '../../../../shared/hooks/useRBAC'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { notificationService } from '../../../../infrastructure/notification/notificationService'
import {
  inventarioCloudService,
  type KitInventario,
  type MantencionInventario,
  type MovimientoInventarioCommand,
  type OrdenCompraInventario,
  type PermisoAditivoInventario,
  type ProveedorInventario,
  type UbicacionInventario,
  type VentaInventario
} from '../services/inventarioCloudService'
import type { ItemInventario } from '../services/inventarioStorageService'

type PanelId = 'stock' | 'movimientos' | 'compras' | 'proveedores' | 'ventas' | 'kits' | 'reportes' | 'mantenciones' | 'permisos'
type PermisoOperacion = 'catalogo.ver' | 'catalogo.gestionar' | 'stock.ver' | 'movimientos.ver' | 'movimientos.registrar' | 'ajustes.gestionar' | 'transferencias.gestionar' | 'compras.ver' | 'compras.gestionar' | 'compras.aprobar' | 'proveedores.ver' | 'proveedores.gestionar' | 'ventas.ver' | 'ventas.registrar' | 'kits.ver' | 'kits.gestionar' | 'alertas.ver'

interface Props {
  items: ItemInventario[]
  ubicaciones: UbicacionInventario[]
  movimientos: Array<Record<string, unknown>>
  onRegistrarMovimiento: (command: MovimientoInventarioCommand) => Promise<void>
  onRefresh: () => Promise<void>
}

const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

const formatoDinero = (value: number): string => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)
const mensajeError = (error: unknown): string => error instanceof Error ? error.message : 'No se pudo sincronizar la información de inventario.'
const fechaCorta = (value: string): string => value ? new Date(value).toLocaleString('es-CL') : '—'
const abreviarId = (value: string): string => `${value.slice(0, 8)}…${value.slice(-4)}`

const exportarCsv = (filename: string, rows: Array<Array<string | number>>): void => {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const PERMISOS: PermisoOperacion[] = [
  'catalogo.ver', 'catalogo.gestionar', 'stock.ver', 'movimientos.ver', 'movimientos.registrar', 'ajustes.gestionar', 'transferencias.gestionar',
  'compras.ver', 'compras.gestionar', 'compras.aprobar', 'proveedores.ver', 'proveedores.gestionar',
  'ventas.ver', 'ventas.registrar', 'kits.ver', 'kits.gestionar', 'alertas.ver'
]

const nombresPermiso: Record<PermisoAditivoInventario['permiso'], string> = {
  compras: 'Generar órdenes de compra',
  aprobar_compras: 'Aprobar órdenes de compra',
  ajustes: 'Ajustar stock',
  transferencias: 'Transferir stock',
  proveedores: 'Gestionar proveedores'
}

export const InventarioPanelesBP09: React.FC<Props> = memo(({ items, ubicaciones, movimientos, onRegistrarMovimiento, onRefresh }) => {
  const { esAdmin, rol } = useRBAC()
  const [permisos, setPermisos] = useState<Partial<Record<PermisoOperacion, boolean>>>({})
  const [panel, setPanel] = useState<PanelId>('stock')
  const [datosCargando, setDatosCargando] = useState(false)
  const [errorPanel, setErrorPanel] = useState('')
  const [proveedores, setProveedores] = useState<ProveedorInventario[]>([])
  const [ordenes, setOrdenes] = useState<OrdenCompraInventario[]>([])
  const [ventas, setVentas] = useState<VentaInventario[]>([])
  const [kits, setKits] = useState<KitInventario[]>([])
  const [prestaciones, setPrestaciones] = useState<Array<{ id: string; nombre: string }>>([])
  const [saldos, setSaldos] = useState<Array<{ itemId: string; ubicacionId: string; cantidad: number }>>([])
  const [lotes, setLotes] = useState<Array<{ id: string; itemId: string; ubicacionId: string; codigo: string; fechaVencimiento: string | null; cantidad: number }>>([])
  const [mantenciones, setMantenciones] = useState<MantencionInventario[]>([])
  const [miembros, setMiembros] = useState<Array<{ userId: string; rol: string; activo: boolean }>>([])
  const [permisosAditivos, setPermisosAditivos] = useState<PermisoAditivoInventario[]>([])

  const [proveedorEditando, setProveedorEditando] = useState<ProveedorInventario | null>(null)
  const [proveedorForm, setProveedorForm] = useState({ nombre: '', rut: '', contactoPrincipal: '', telefono: '', email: '' })
  const [ordenProveedorId, setOrdenProveedorId] = useState('')
  const [ordenItemId, setOrdenItemId] = useState('')
  const [ordenCantidad, setOrdenCantidad] = useState('')
  const [ordenEntrega, setOrdenEntrega] = useState('')
  const [ordenLineas, setOrdenLineas] = useState<Array<{ itemId: string; quantity: number; unitPrice?: number }>>([])
  const [recibir, setRecibir] = useState<{ orden: OrdenCompraInventario; linea: OrdenCompraInventario['items'][number] } | null>(null)
  const [recepcionCantidad, setRecepcionCantidad] = useState('')
  const [recepcionLote, setRecepcionLote] = useState('')
  const [recepcionVencimiento, setRecepcionVencimiento] = useState('')
  const [recepcionUbicacion, setRecepcionUbicacion] = useState('')
  const [ventaUbicacion, setVentaUbicacion] = useState('')
  const [ventaItemId, setVentaItemId] = useState('')
  const [ventaCantidad, setVentaCantidad] = useState('1')
  const [ventaMedio, setVentaMedio] = useState<'efectivo' | 'debito' | 'credito' | 'transferencia'>('efectivo')
  const [carrito, setCarrito] = useState<Array<{ itemId: string; quantity: number }>>([])
  const [kitForm, setKitForm] = useState({ id: '', nombre: '', prestacionId: '', descripcion: '', activo: true })
  const [kitItemId, setKitItemId] = useState('')
  const [kitCantidad, setKitCantidad] = useState('1')
  const [kitLineas, setKitLineas] = useState<Array<{ itemId: string; cantidad: number }>>([])
  const [mantencionForm, setMantencionForm] = useState({ itemId: '', tipo: 'mantencion' as 'mantencion' | 'reparacion' | 'instalacion', fecha: new Date().toISOString().slice(0, 10), descripcion: '', costo: '' })
  const [permisoUsuarioId, setPermisoUsuarioId] = useState('')
  const [permisoTipo, setPermisoTipo] = useState<PermisoAditivoInventario['permiso']>('compras')

  useEffect(() => {
    if (!USE_SUPABASE) {
      const defaults: Partial<Record<PermisoOperacion, boolean>> = {
        'catalogo.ver': esAdmin || rol === 'asistente' || rol === 'dentista',
        'catalogo.gestionar': esAdmin,
        'stock.ver': true,
        'movimientos.ver': esAdmin || rol === 'asistente',
        'movimientos.registrar': esAdmin || rol === 'asistente',
        'ajustes.gestionar': esAdmin,
        'transferencias.gestionar': esAdmin || rol === 'asistente',
        'compras.ver': esAdmin,
        'compras.gestionar': esAdmin,
        'compras.aprobar': esAdmin,
        'proveedores.ver': esAdmin,
        'proveedores.gestionar': esAdmin,
        'ventas.ver': esAdmin || rol === 'recepcion',
        'ventas.registrar': esAdmin || rol === 'recepcion',
        'kits.ver': esAdmin || rol === 'asistente' || rol === 'dentista',
        'kits.gestionar': esAdmin,
        'alertas.ver': esAdmin || rol === 'asistente' || rol === 'dentista'
      }
      setPermisos(defaults)
      return
    }
    let vigente = true
    void Promise.all(PERMISOS.map(async (accion) => [accion, await inventarioCloudService.puedeOperar(accion)] as const))
      .then((entries) => { if (vigente) setPermisos(Object.fromEntries(entries)) })
      .catch((error) => { if (vigente) setErrorPanel(mensajeError(error)) })
    return () => { vigente = false }
  }, [esAdmin, rol])

  const puede = useCallback((accion: PermisoOperacion): boolean => permisos[accion] === true, [permisos])

  const refrescarPaneles = useCallback(async (): Promise<void> => {
    if (!USE_SUPABASE) return
    setDatosCargando(true)
    setErrorPanel('')
    const tareas: Array<Promise<void>> = []
    const safe = async <T,>(request: () => Promise<T>, save: (data: T) => void): Promise<void> => {
      try { save(await request()) } catch (error) { setErrorPanel(mensajeError(error)) }
    }
    if (puede('proveedores.ver') || puede('proveedores.gestionar') || puede('compras.ver')) tareas.push(safe(() => inventarioCloudService.listarProveedores(), setProveedores))
    if (puede('compras.ver')) tareas.push(safe(() => inventarioCloudService.listarOrdenesCompra(), setOrdenes))
    if (puede('ventas.ver')) tareas.push(safe(() => inventarioCloudService.listarVentas(), setVentas))
    if (puede('kits.ver')) tareas.push(safe(() => inventarioCloudService.listarKits(), setKits))
    if (puede('kits.gestionar')) tareas.push(safe(() => inventarioCloudService.listarPrestaciones(), setPrestaciones))
    if (puede('stock.ver') || puede('alertas.ver')) {
      tareas.push(safe(() => inventarioCloudService.listarSaldosPorUbicacion(), setSaldos))
      tareas.push(safe(() => inventarioCloudService.listarLotesDisponibles(), setLotes))
    }
    if (puede('catalogo.gestionar')) tareas.push(safe(() => inventarioCloudService.listarMantenciones(), setMantenciones))
    if (esAdmin) {
      tareas.push(safe(() => inventarioCloudService.listarMiembrosPermisos(), setMiembros))
      tareas.push(safe(() => inventarioCloudService.listarPermisosAditivos(), setPermisosAditivos))
    }
    await Promise.all(tareas)
    setDatosCargando(false)
  }, [esAdmin, puede])

  useEffect(() => { void refrescarPaneles() }, [refrescarPaneles])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const changed = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void Promise.all([onRefresh(), refrescarPaneles()]) }, 180)
    }
    window.addEventListener('realtime:inventario_changed', changed)
    return () => { if (timer) clearTimeout(timer); window.removeEventListener('realtime:inventario_changed', changed) }
  }, [onRefresh, refrescarPaneles])

  useEffect(() => {
    if (!ordenProveedorId && proveedores.length) setOrdenProveedorId(proveedores[0].id)
    if (ventaUbicacion && !ubicaciones.some((location) => location.id === ventaUbicacion)) setVentaUbicacion('')
    if (!recepcionUbicacion && ubicaciones.length) setRecepcionUbicacion(ubicaciones.find((location) => location.tipo === 'bodega_central')?.id || ubicaciones[0].id)
  }, [proveedores, ubicaciones, ordenProveedorId, ventaUbicacion, recepcionUbicacion])

  const tabs = useMemo(() => {
    const available: Array<{ id: PanelId; label: string }> = []
    if (puede('stock.ver')) available.push({ id: 'stock', label: 'Stock y alertas' })
    if (puede('movimientos.ver')) available.push({ id: 'movimientos', label: 'Movimientos' })
    if (USE_SUPABASE) {
      if (puede('compras.ver') || puede('compras.gestionar')) available.push({ id: 'compras', label: 'Órdenes de compra' })
      if (puede('proveedores.ver') || puede('proveedores.gestionar')) available.push({ id: 'proveedores', label: 'Proveedores' })
      if (puede('ventas.ver') || puede('ventas.registrar')) available.push({ id: 'ventas', label: 'Ventas' })
      if (puede('kits.ver')) available.push({ id: 'kits', label: 'Kits de tratamiento' })
      if (puede('alertas.ver')) available.push({ id: 'reportes', label: 'Reportes' })
      if (puede('catalogo.gestionar')) available.push({ id: 'mantenciones', label: 'Mantenciones' })
      if (esAdmin) available.push({ id: 'permisos', label: 'Permisos' })
    }
    return available
  }, [esAdmin, puede])

  useEffect(() => {
    if (tabs.length && !tabs.some((tab) => tab.id === panel)) setPanel(tabs[0].id)
  }, [tabs, panel])

  const alertasStock = items.filter((item) => {
    const current = Number(item.cantidad) || 0
    const minimum = Number(item.minimoCritico) || 0
    return current === 0 || (minimum > 0 && current <= minimum)
  })
  const lotesConItem = lotes.map((lote) => ({ ...lote, item: items.find((item) => String(item.id) === lote.itemId) })).filter((row) => row.item)
  const saldoPorItem = new Map<string, number>()
  for (const balance of saldos) saldoPorItem.set(balance.itemId, (saldoPorItem.get(balance.itemId) || 0) + balance.cantidad)
  const alertasVencimiento = lotesConItem.filter(({ fechaVencimiento, cantidad }) => {
    if (!fechaVencimiento || cantidad <= 0) return false
    const days = Math.ceil((new Date(`${fechaVencimiento}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
    return days <= 90
  })

  const guardarProveedor = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    try {
      await inventarioCloudService.guardarProveedor({ ...proveedorForm, id: proveedorEditando?.id, estado: proveedorEditando?.estado || 'activo' })
      setProveedorForm({ nombre: '', rut: '', contactoPrincipal: '', telefono: '', email: '' })
      setProveedorEditando(null)
      await refrescarPaneles()
      notificationService.mostrar('Proveedor guardado en la clínica.', { tipo: 'success' })
    } catch (error) { notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se guardó el proveedor' }) }
  }

  const agregarLineaOrden = (): void => {
    const item = items.find((candidate) => String(candidate.id) === ordenItemId)
    const quantity = Number(ordenCantidad)
    if (!item || !Number.isFinite(quantity) || quantity <= 0) return
    setOrdenLineas((lines) => lines.some((line) => line.itemId === String(item.id))
      ? lines.map((line) => line.itemId === String(item.id) ? { ...line, quantity: line.quantity + quantity } : line)
      : [...lines, { itemId: String(item.id), quantity, unitPrice: Number(item.precioCompra ?? item.precioUnitario) || undefined }])
    setOrdenItemId('')
    setOrdenCantidad('')
  }

  const crearOrden = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!ordenProveedorId || ordenLineas.length === 0) return
    try {
      await inventarioCloudService.crearOrdenCompra({
        idempotencyKey: uuid(), providerId: ordenProveedorId,
        expectedDeliveryDate: ordenEntrega || undefined,
        items: ordenLineas
      })
      setOrdenLineas([])
      setOrdenEntrega('')
      await refrescarPaneles()
      notificationService.mostrar('Orden creada como borrador. Debe aprobarse antes de recibir mercadería.', { tipo: 'success' })
    } catch (error) { notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se creó la orden' }) }
  }

  const recibirLineaOrden = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!recibir) return
    const quantity = Number(recepcionCantidad)
    const remaining = recibir.linea.cantidadSolicitada - recibir.linea.cantidadRecibida
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remaining) return
    const item = items.find((candidate) => String(candidate.id) === recibir.linea.itemId)
    if (!item || !recepcionUbicacion) return
    try {
      await onRegistrarMovimiento({
        idempotencyKey: uuid(), type: 'entrada_compra', itemId: recibir.linea.itemId, quantity,
        destinationLocationId: recepcionUbicacion, purchaseOrderId: recibir.orden.id,
        purchaseOrderItemId: recibir.linea.id, providerId: recibir.orden.proveedorId,
        lotCode: recepcionLote.trim() || undefined, expiryDate: recepcionVencimiento || undefined,
        reason: `Recepción ${recibir.orden.folio}`
      })
      setRecibir(null)
      setRecepcionCantidad('')
      setRecepcionLote('')
      setRecepcionVencimiento('')
      await refrescarPaneles()
    } catch (error) { notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se recibió la línea' }) }
  }

  const crearVenta = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!ventaUbicacion || carrito.length === 0) return
    try {
      const result = await inventarioCloudService.registrarVenta({
        idempotencyKey: uuid(), locationId: ventaUbicacion, paymentMethod: ventaMedio, items: carrito
      })
      setCarrito([])
      await refrescarPaneles()
      await onRefresh()
      notificationService.mostrar(`Venta ${String(result.folio || '')} registrada por ${formatoDinero(Number(result.total) || 0)}.`, { tipo: 'success' })
    } catch (error) { notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se registró la venta' }) }
  }

  const guardarKit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!kitForm.nombre.trim() || !kitForm.prestacionId || kitLineas.length === 0) return
    try {
      await inventarioCloudService.guardarKit({ ...kitForm, items: kitLineas })
      setKitForm({ id: '', nombre: '', prestacionId: '', descripcion: '', activo: true })
      setKitLineas([])
      await refrescarPaneles()
      notificationService.mostrar('Kit guardado y sincronizado.', { tipo: 'success' })
    } catch (error) { notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se guardó el kit' }) }
  }

  const guardarMantencion = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!mantencionForm.itemId || mantencionForm.descripcion.trim().length < 3) return
    try {
      await inventarioCloudService.registrarMantencion({
        itemId: mantencionForm.itemId, tipo: mantencionForm.tipo, fecha: mantencionForm.fecha,
        descripcion: mantencionForm.descripcion, costo: mantencionForm.costo ? Number(mantencionForm.costo) : undefined
      })
      setMantencionForm((form) => ({ ...form, descripcion: '', costo: '' }))
      await refrescarPaneles()
      await onRefresh()
      notificationService.mostrar('Mantención registrada en el historial del artículo.', { tipo: 'success' })
    } catch (error) { notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se registró la mantención' }) }
  }

  const guardarPermiso = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!permisoUsuarioId) return
    try {
      await inventarioCloudService.guardarPermisoAditivo(permisoUsuarioId, permisoTipo)
      await refrescarPaneles()
      notificationService.mostrar('Permiso aditivo concedido.', { tipo: 'success' })
    } catch (error) { notificationService.mostrar(mensajeError(error), { tipo: 'error', titulo: 'No se concedió el permiso' }) }
  }

  const productosVenta = items.filter((item) => item.tipoItem === 'producto_venta')
  const consumibles = items.filter((item) => item.tipoItem === 'insumo_clinico' || item.tipoItem === 'implante_protesis')
  const instrumentalEquipamiento = items.filter((item) => item.tipoItem === 'instrumental' || item.tipoItem === 'equipamiento')
  const carritoTotal = carrito.reduce((sum, line) => {
    const item = productosVenta.find((candidate) => String(candidate.id) === line.itemId)
    const subtotal = line.quantity * (Number(item?.precioVenta) || 0)
    return sum + subtotal + subtotal * (Number(item?.ivaPorcentaje) || 0) / 100
  }, 0)

  return (
    <section className="space-y-4">
      {errorPanel && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">{errorPanel}</div>}
      {USE_SUPABASE && datosCargando && <p className="text-xs text-gray-500" aria-live="polite">Sincronizando módulos de inventario…</p>}
      {!USE_SUPABASE && <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">Modo local. Los flujos de compras, ventas, proveedores, kits y permisos se habilitan al conectar la clínica con Supabase.</div>}

      <nav aria-label="Secciones de inventario" className="flex gap-2 overflow-x-auto border-b border-surface pb-2">
        {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setPanel(tab.id)} aria-current={panel === tab.id ? 'page' : undefined} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${panel === tab.id ? 'bg-graphite-900 text-white dark:bg-champagne-300 dark:text-graphite-950' : 'bg-surface-muted text-graphite-600 dark:text-graphite-300'}`}>{tab.label}</button>)}
      </nav>

      {panel === 'stock' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-surface bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-bold">Stock por ubicación</h3><p className="text-[11px] text-gray-500">Saldos compartidos por clínica, bodega y box.</p></div>
              {USE_SUPABASE && <Button variant="outline" size="sm" onClick={() => exportarCsv('inventario-stock.csv', [['Código', 'Artículo', 'Tipo', 'Stock total', 'Unidad', 'Mínimo', 'Máximo'], ...items.map((item) => [item.codigo || '', item.nombre, item.tipoItem || '', saldoPorItem.get(String(item.id)) ?? item.cantidad, item.unidad, item.minimoCritico, item.cantidadMaxima ?? ''])])}>Exportar CSV</Button>}
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b text-[10px] uppercase text-gray-500"><th className="p-2">Artículo</th><th className="p-2">Ubicación</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">Mínimo / máximo</th><th className="p-2">Alerta</th></tr></thead><tbody className="divide-y divide-surface">{items.map((item) => {
              const stock = saldoPorItem.get(String(item.id)) ?? (Number(item.cantidad) || 0)
              const minimum = Number(item.minimoCritico) || 0
              const critical = stock === 0 || (minimum > 0 && stock <= minimum * 0.25)
              const low = !critical && minimum > 0 && stock <= minimum
              const locationsForItem = saldos.filter((balance) => balance.itemId === String(item.id))
              return <React.Fragment key={item.id}>{(locationsForItem.length ? locationsForItem : [{ itemId: String(item.id), ubicacionId: '', cantidad: stock }]).map((balance, index) => <tr key={`${item.id}-${balance.ubicacionId || index}`}><td className="p-2 font-semibold">{item.codigo ? `${item.codigo} · ` : ''}{item.nombre}</td><td className="p-2">{ubicaciones.find((location) => location.id === balance.ubicacionId)?.nombre || 'Sin saldo por ubicación'}</td><td className="p-2 text-right tabular-nums">{balance.cantidad} {item.unidad}</td><td className="p-2 text-right tabular-nums">{item.minimoCritico} / {item.cantidadMaxima || '—'}</td><td className="p-2">{critical ? <span className="rounded bg-red-100 px-2 py-1 text-red-800">Crítico / agotado</span> : low ? <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Bajo mínimo</span> : item.cantidadMaxima && stock > Number(item.cantidadMaxima) ? <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Sobre máximo</span> : <span className="text-emerald-700">Normal</span>}</td></tr>)}</React.Fragment>
            })}</tbody></table></div>
          </div>
          {alertasStock.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs"><h3 className="mb-2 font-bold text-amber-950">Alertas de reabastecimiento</h3><ul className="space-y-1">{alertasStock.map((item) => <li key={item.id}>{item.nombre}: {Number(item.cantidad) || 0} {item.unidad} · mínimo {item.minimoCritico} {item.unidad}{item.proveedor ? ` · proveedor ${item.proveedor}` : ''}</li>)}</ul></div>}
        </div>
      )}

      {panel === 'movimientos' && <div className="overflow-x-auto rounded-2xl border border-surface bg-surface"><div className="flex items-center justify-between p-4"><div><h3 className="text-sm font-bold">Historial de movimientos</h3><p className="text-[11px] text-gray-500">Registro de solo anexado; cada modificación de saldo conserva actor y motivo.</p></div><Button variant="outline" size="sm" onClick={() => exportarCsv('inventario-movimientos.csv', [['Fecha', 'Artículo', 'Tipo', 'Cantidad', 'Signo', 'Origen', 'Destino', 'Justificación'], ...movimientos.map((row) => [String(row.created_at || ''), items.find((item) => String(item.id) === String(row.inventario_id))?.nombre || row.inventario_id as string, String(row.tipo || ''), String(row.cantidad || ''), String(row.signo || ''), String(row.ubicacion_origen_id || ''), String(row.ubicacion_destino_id || ''), String(row.justificacion || '')])])}>Exportar CSV</Button></div><table className="w-full min-w-[750px] text-left text-xs"><thead><tr className="border-y text-[10px] uppercase text-gray-500"><th className="p-3">Fecha</th><th className="p-3">Artículo</th><th className="p-3">Tipo</th><th className="p-3 text-right">Cantidad</th><th className="p-3">Ubicación</th><th className="p-3">Justificación</th></tr></thead><tbody className="divide-y divide-surface">{movimientos.map((row) => <tr key={String(row.id)}><td className="p-3">{fechaCorta(String(row.created_at || ''))}</td><td className="p-3">{items.find((item) => String(item.id) === String(row.inventario_id))?.nombre || abreviarId(String(row.inventario_id || ''))}</td><td className="p-3">{String(row.tipo || '').replaceAll('_', ' ')}</td><td className="p-3 text-right tabular-nums">{row.signo === -1 ? '−' : '+'}{row.cantidad as string}</td><td className="p-3">{ubicaciones.find((location) => location.id === String(row.ubicacion_origen_id || row.ubicacion_destino_id || ''))?.nombre || '—'}</td><td className="p-3">{String(row.justificacion || '—')}</td></tr>)}</tbody></table>{movimientos.length === 0 && <p className="p-6 text-center text-xs text-gray-500">No hay movimientos registrados.</p>}</div>}

      {panel === 'compras' && <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
        {puede('compras.gestionar') && <form onSubmit={(event) => void crearOrden(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4"><h3 className="text-sm font-bold">Nueva orden de compra</h3><label className="block text-xs font-semibold">Proveedor<select value={ordenProveedorId} onChange={(event) => setOrdenProveedorId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800" required><option value="">Selecciona</option>{proveedores.filter((provider) => provider.estado === 'activo').map((provider) => <option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label><div className="grid grid-cols-[1fr_92px] gap-2"><label className="block text-xs font-semibold">Artículo<select value={ordenItemId} onChange={(event) => setOrdenItemId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800"><option value="">Selecciona</option>{items.filter((item) => item.estadoCatalogo !== 'inactivo').map((item) => <option key={item.id} value={String(item.id)}>{item.codigo} · {item.nombre}</option>)}</select></label><Input label="Cantidad" type="number" min="0.001" step="0.001" value={ordenCantidad} onChange={(event) => setOrdenCantidad(event.target.value)} /></div><Button type="button" variant="outline" size="sm" disabled={!ordenItemId || !ordenCantidad} onClick={agregarLineaOrden}>Agregar línea</Button>{ordenLineas.map((line) => { const item = items.find((row) => String(row.id) === line.itemId); return <div key={line.itemId} className="flex justify-between rounded-lg bg-surface-muted p-2 text-xs"><span>{item?.nombre} · {line.quantity} {item?.unidad}</span><Button variant="ghost" size="sm" onClick={() => setOrdenLineas((rows) => rows.filter((row) => row.itemId !== line.itemId))}>Quitar</Button></div> })}<Input label="Entrega estimada" type="date" value={ordenEntrega} onChange={(event) => setOrdenEntrega(event.target.value)} /><Button type="submit" disabled={!ordenProveedorId || ordenLineas.length === 0}>Crear borrador</Button><p className="text-[10px] text-gray-500">Las cantidades y precios de compra se vuelven a validar en el servidor.</p></form>}
        <div className="space-y-3">{ordenes.map((order) => <article key={order.id} className="rounded-2xl border border-surface bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold">{order.folio} · {order.proveedor}</h3><p className="text-[11px] text-gray-500">{fechaCorta(order.fechaPedido)} · {order.fechaEstimadaEntrega ? `Entrega estimada ${order.fechaEstimadaEntrega}` : 'Sin fecha estimada'}</p><p className="mt-1 text-[11px]">Estado: <strong>{order.estado.replaceAll('_', ' ')}</strong></p></div><div className="flex gap-2">{order.estado === 'borrador' && puede('compras.aprobar') && <Button size="sm" onClick={() => void inventarioCloudService.aprobarOrdenCompra(order.id).then(refrescarPaneles).catch((error) => notificationService.mostrar(mensajeError(error), { tipo: 'error' }))}>Aprobar y enviar</Button>}{['borrador', 'pendiente', 'enviada'].includes(order.estado) && puede('compras.gestionar') && <Button size="sm" variant="danger" onClick={() => { const reason = window.prompt('Justificación para cancelar (mínimo 5 caracteres)'); if (reason?.trim()) void inventarioCloudService.cancelarOrdenCompra(order.id, reason).then(refrescarPaneles).catch((error) => notificationService.mostrar(mensajeError(error), { tipo: 'error' })) }}>Cancelar</Button>}</div></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-xs"><thead><tr className="border-b text-left text-[10px] uppercase text-gray-500"><th className="p-2">Artículo</th><th className="p-2 text-right">Solicitado</th><th className="p-2 text-right">Recibido</th><th className="p-2 text-right">Precio</th><th className="p-2">Acción</th></tr></thead><tbody className="divide-y divide-surface">{order.items.map((line) => <tr key={line.id}><td className="p-2">{line.codigo} · {line.nombre}</td><td className="p-2 text-right">{line.cantidadSolicitada} {line.unidad}</td><td className="p-2 text-right">{line.cantidadRecibida} {line.unidad}</td><td className="p-2 text-right">{formatoDinero(line.precioUnitario)}</td><td className="p-2">{['enviada', 'recibida_parcial'].includes(order.estado) && line.cantidadRecibida < line.cantidadSolicitada && puede('compras.gestionar') && <Button size="sm" variant="outline" onClick={() => { setRecibir({ orden: order, linea: line }); setRecepcionCantidad(String(line.cantidadSolicitada - line.cantidadRecibida)) }}>Recibir</Button>}</td></tr>)}</tbody></table></div>{order.nota && <p className="mt-2 text-[11px] text-gray-600">{order.nota}</p>}</article>)}{ordenes.length === 0 && <div className="rounded-2xl border border-dashed border-surface p-8 text-center text-xs text-gray-500">No hay órdenes de compra.</div>}</div>
      </div>}

      {panel === 'proveedores' && <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
        {puede('proveedores.gestionar') && <form onSubmit={(event) => void guardarProveedor(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4"><h3 className="text-sm font-bold">{proveedorEditando ? 'Editar proveedor' : 'Nuevo proveedor'}</h3><Input label="Nombre" required minLength={2} maxLength={160} value={proveedorForm.nombre} onChange={(event) => setProveedorForm((form) => ({ ...form, nombre: event.target.value }))} /><Input label="RUT" maxLength={20} value={proveedorForm.rut} onChange={(event) => setProveedorForm((form) => ({ ...form, rut: event.target.value }))} /><Input label="Contacto" maxLength={160} value={proveedorForm.contactoPrincipal} onChange={(event) => setProveedorForm((form) => ({ ...form, contactoPrincipal: event.target.value }))} /><Input label="Teléfono" maxLength={40} value={proveedorForm.telefono} onChange={(event) => setProveedorForm((form) => ({ ...form, telefono: event.target.value }))} /><Input label="Email" type="email" maxLength={254} value={proveedorForm.email} onChange={(event) => setProveedorForm((form) => ({ ...form, email: event.target.value }))} /><div className="flex gap-2"><Button type="submit">Guardar proveedor</Button>{proveedorEditando && <Button type="button" variant="ghost" onClick={() => { setProveedorEditando(null); setProveedorForm({ nombre: '', rut: '', contactoPrincipal: '', telefono: '', email: '' }) }}>Cancelar edición</Button>}</div></form>}
        <div className="grid gap-3 md:grid-cols-2">{proveedores.map((provider) => <article key={provider.id} className="rounded-2xl border border-surface bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{provider.nombre}</h3><p className="text-[11px] text-gray-500">{provider.rut || 'Sin RUT'} · {provider.estado === 'activo' ? 'Activo' : 'Inactivo'}</p></div>{puede('proveedores.gestionar') && <Button size="sm" variant="outline" onClick={() => { setProveedorEditando(provider); setProveedorForm({ nombre: provider.nombre, rut: provider.rut || '', contactoPrincipal: provider.contactoPrincipal || '', telefono: provider.telefono || '', email: provider.email || '' }) }}>Editar</Button>}</div><p className="mt-3 text-xs">{provider.contactoPrincipal || 'Sin contacto'}{provider.telefono ? ` · ${provider.telefono}` : ''}</p>{provider.email && <p className="text-xs">{provider.email}</p>}<div className="mt-3 border-t border-surface pt-2 text-[11px] text-gray-500">{ordenes.filter((order) => order.proveedorId === provider.id).length} órdenes registradas</div></article>)}{proveedores.length === 0 && <div className="rounded-2xl border border-dashed border-surface p-8 text-center text-xs text-gray-500">No hay proveedores registrados en esta clínica.</div>}</div>
      </div>}

      {panel === 'ventas' && <div className="grid gap-4 xl:grid-cols-[minmax(280px,380px)_1fr]">
        {puede('ventas.registrar') && <form onSubmit={(event) => void crearVenta(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4"><h3 className="text-sm font-bold">Nueva venta</h3><label className="block text-xs font-semibold">Ubicación de salida<select value={ventaUbicacion} onChange={(event) => setVentaUbicacion(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800" required><option value="">Selecciona</option>{ubicaciones.map((location) => <option key={location.id} value={location.id}>{location.nombre}</option>)}</select></label><div className="grid grid-cols-[1fr_86px] gap-2"><label className="block text-xs font-semibold">Producto<select value={ventaItemId} onChange={(event) => setVentaItemId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800"><option value="">Selecciona</option>{productosVenta.map((item) => <option key={item.id} value={String(item.id)}>{item.nombre} · {formatoDinero(Number(item.precioVenta) || 0)}</option>)}</select></label><Input label="Cantidad" type="number" min="0.001" step="0.001" value={ventaCantidad} onChange={(event) => setVentaCantidad(event.target.value)} /></div><Button type="button" variant="outline" size="sm" disabled={!ventaItemId || Number(ventaCantidad) <= 0} onClick={() => { const quantity = Number(ventaCantidad); setCarrito((cart) => cart.some((line) => line.itemId === ventaItemId) ? cart.map((line) => line.itemId === ventaItemId ? { ...line, quantity: line.quantity + quantity } : line) : [...cart, { itemId: ventaItemId, quantity }]); setVentaItemId('') }}>Agregar al carrito</Button>{carrito.map((line) => { const item = productosVenta.find((row) => String(row.id) === line.itemId); return <div key={line.itemId} className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted p-2 text-xs"><span>{item?.nombre} · {line.quantity} × {formatoDinero(Number(item?.precioVenta) || 0)}</span><Button size="sm" variant="ghost" onClick={() => setCarrito((cart) => cart.filter((row) => row.itemId !== line.itemId))}>Quitar</Button></div> })}<label className="block text-xs font-semibold">Medio de pago<select value={ventaMedio} onChange={(event) => setVentaMedio(event.target.value as typeof ventaMedio)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800"><option value="efectivo">Efectivo</option><option value="debito">Débito</option><option value="credito">Crédito</option><option value="transferencia">Transferencia</option></select></label><div className="rounded-xl bg-surface-muted p-3 text-right text-sm font-bold">Total estimado con IVA: {formatoDinero(carritoTotal)}</div><Button type="submit" disabled={!ventaUbicacion || carrito.length === 0}>Registrar venta y descontar stock</Button><p className="text-[10px] text-gray-500">El servidor toma precio e IVA del catálogo y registra la salida de stock junto con la venta.</p></form>}
        <div className="overflow-x-auto rounded-2xl border border-surface bg-surface"><div className="p-4"><h3 className="text-sm font-bold">Ventas recientes</h3><p className="text-[11px] text-gray-500">Cada venta aparece también en Pagos y Caja. La boleta tributaria electrónica se emite desde su flujo correspondiente.</p></div><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-y text-[10px] uppercase text-gray-500"><th className="p-3">Folio</th><th className="p-3">Fecha</th><th className="p-3">Subtotal</th><th className="p-3">IVA</th><th className="p-3">Total</th><th className="p-3">Pago</th></tr></thead><tbody className="divide-y divide-surface">{ventas.map((sale) => <tr key={sale.id}><td className="p-3 font-semibold">{sale.folio}</td><td className="p-3">{fechaCorta(sale.createdAt)}</td><td className="p-3">{formatoDinero(sale.subtotal)}</td><td className="p-3">{formatoDinero(sale.iva)}</td><td className="p-3 font-semibold">{formatoDinero(sale.total)}</td><td className="p-3">{sale.metodoPago}</td></tr>)}</tbody></table>{ventas.length === 0 && <p className="p-6 text-center text-xs text-gray-500">No hay ventas registradas.</p>}</div>
      </div>}

      {panel === 'kits' && <div className="grid gap-4 xl:grid-cols-[minmax(300px,440px)_1fr]">
        {puede('kits.gestionar') && <form onSubmit={(event) => void guardarKit(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4"><h3 className="text-sm font-bold">{kitForm.id ? 'Editar kit' : 'Kit de tratamiento'}</h3><Input label="Nombre del kit" required minLength={2} maxLength={140} value={kitForm.nombre} onChange={(event) => setKitForm((form) => ({ ...form, nombre: event.target.value }))} /><label className="block text-xs font-semibold">Prestación BP08<select value={kitForm.prestacionId} onChange={(event) => setKitForm((form) => ({ ...form, prestacionId: event.target.value }))} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800" required><option value="">Selecciona una prestación</option>{prestaciones.map((prestacion) => <option key={prestacion.id} value={prestacion.id}>{prestacion.nombre}</option>)}</select></label><Input label="Descripción" maxLength={1000} value={kitForm.descripcion} onChange={(event) => setKitForm((form) => ({ ...form, descripcion: event.target.value }))} /><div className="grid grid-cols-[1fr_90px] gap-2"><label className="block text-xs font-semibold">Insumo<select value={kitItemId} onChange={(event) => setKitItemId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800"><option value="">Selecciona</option>{consumibles.map((item) => <option key={item.id} value={String(item.id)}>{item.nombre}</option>)}</select></label><Input label="Cantidad" type="number" min="0.001" step="0.001" value={kitCantidad} onChange={(event) => setKitCantidad(event.target.value)} /></div><Button type="button" variant="outline" size="sm" disabled={!kitItemId || Number(kitCantidad) <= 0} onClick={() => { const quantity = Number(kitCantidad); setKitLineas((lines) => lines.some((line) => line.itemId === kitItemId) ? lines.map((line) => line.itemId === kitItemId ? { ...line, cantidad: quantity } : line) : [...lines, { itemId: kitItemId, cantidad: quantity }]); setKitItemId('') }}>Agregar insumo</Button>{kitLineas.map((line) => <div key={line.itemId} className="flex justify-between rounded-lg bg-surface-muted p-2 text-xs"><span>{items.find((item) => String(item.id) === line.itemId)?.nombre} · {line.cantidad}</span><Button size="sm" variant="ghost" onClick={() => setKitLineas((lines) => lines.filter((row) => row.itemId !== line.itemId))}>Quitar</Button></div>)}<label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={kitForm.activo} onChange={(event) => setKitForm((form) => ({ ...form, activo: event.target.checked }))} /> Kit activo</label><div className="flex gap-2"><Button type="submit" disabled={!kitForm.prestacionId || !kitLineas.length}>Guardar kit</Button>{kitForm.id && <Button type="button" variant="ghost" onClick={() => { setKitForm({ id: '', nombre: '', prestacionId: '', descripcion: '', activo: true }); setKitLineas([]) }}>Cancelar</Button>}</div></form>}
        <div className="space-y-3">{kits.map((kit) => <article key={kit.id} className="rounded-2xl border border-surface bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold">{kit.nombre}</h3><p className="text-[11px] text-gray-500">{prestaciones.find((p) => p.id === kit.prestacionId)?.nombre || abreviarId(kit.prestacionId)} · {kit.activo ? 'Activo' : 'Inactivo'}</p></div>{puede('kits.gestionar') && <Button size="sm" variant="outline" onClick={() => { setKitForm({ id: kit.id, nombre: kit.nombre, prestacionId: kit.prestacionId, descripcion: kit.descripcion, activo: kit.activo }); setKitLineas(kit.items.map((line) => ({ itemId: line.itemId, cantidad: line.cantidad }))) }}>Editar</Button>}</div>{kit.descripcion && <p className="mt-2 text-xs text-gray-600">{kit.descripcion}</p>}<ul className="mt-3 space-y-1 text-xs">{kit.items.map((line) => <li key={line.itemId}>{line.nombre} · {line.cantidad} {line.unidad}</li>)}</ul></article>)}{kits.length === 0 && <div className="rounded-2xl border border-dashed border-surface p-8 text-center text-xs text-gray-500">No hay kits configurados para tratamientos.</div>}</div>
      </div>}

      {panel === 'reportes' && <div className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Reportes CORE</h3><p className="text-[11px] text-gray-500">Stock, lotes vigentes y vencimientos con saldo disponible.</p></div><Button variant="outline" size="sm" onClick={() => exportarCsv('inventario-vencimientos.csv', [['Artículo', 'Código', 'Lote', 'Ubicación', 'Cantidad', 'Vencimiento'], ...alertasVencimiento.map(({ item, codigo, fechaVencimiento, ubicacionId, cantidad }) => [item?.nombre || '', item?.codigo || '', codigo, ubicaciones.find((location) => location.id === ubicacionId)?.nombre || '', cantidad, fechaVencimiento || ''])])}>Exportar vencimientos</Button></div><div className="overflow-x-auto rounded-2xl border border-surface bg-surface"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b text-[10px] uppercase text-gray-500"><th className="p-3">Artículo</th><th className="p-3">Lote</th><th className="p-3">Ubicación</th><th className="p-3 text-right">Saldo</th><th className="p-3">Vencimiento</th><th className="p-3">Alerta</th></tr></thead><tbody className="divide-y divide-surface">{alertasVencimiento.map(({ id, item, codigo, fechaVencimiento, ubicacionId, cantidad }) => { const days = fechaVencimiento ? Math.ceil((new Date(`${fechaVencimiento}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : 999; return <tr key={`${id}-${ubicacionId}`}><td className="p-3">{item?.nombre}</td><td className="p-3">{codigo}</td><td className="p-3">{ubicaciones.find((location) => location.id === ubicacionId)?.nombre || '—'}</td><td className="p-3 text-right">{cantidad} {item?.unidad}</td><td className="p-3">{fechaVencimiento}</td><td className="p-3"><span className={`rounded px-2 py-1 ${days < 0 || days <= 30 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{days < 0 ? 'Vencido' : days <= 30 ? `Vence en ${days} días` : `Vence en ${days} días`}</span></td></tr> })}</tbody></table>{alertasVencimiento.length === 0 && <p className="p-6 text-center text-xs text-gray-500">No hay lotes con vencimiento dentro de 90 días.</p>}</div><p className="text-[10px] text-gray-500">Las alertas por stock crítico y vencimiento se muestran en la aplicación. El envío de correo requiere configurar el servicio de notificaciones.</p></div>}

      {panel === 'mantenciones' && <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]"><form onSubmit={(event) => void guardarMantencion(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4"><h3 className="text-sm font-bold">Registrar mantención</h3><label className="block text-xs font-semibold">Instrumental / equipamiento<select value={mantencionForm.itemId} onChange={(event) => setMantencionForm((form) => ({ ...form, itemId: event.target.value }))} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800" required><option value="">Selecciona un artículo</option>{instrumentalEquipamiento.map((item) => <option key={item.id} value={String(item.id)}>{item.codigo} · {item.nombre}</option>)}</select></label><label className="block text-xs font-semibold">Tipo<select value={mantencionForm.tipo} onChange={(event) => setMantencionForm((form) => ({ ...form, tipo: event.target.value as typeof form.tipo }))} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800"><option value="mantencion">Mantención</option><option value="reparacion">Reparación</option><option value="instalacion">Instalación</option></select></label><Input label="Fecha" type="date" required value={mantencionForm.fecha} onChange={(event) => setMantencionForm((form) => ({ ...form, fecha: event.target.value }))} /><Input label="Descripción" required minLength={3} maxLength={1000} value={mantencionForm.descripcion} onChange={(event) => setMantencionForm((form) => ({ ...form, descripcion: event.target.value }))} /><Input label="Costo (CLP)" type="number" min="0" step="0.01" value={mantencionForm.costo} onChange={(event) => setMantencionForm((form) => ({ ...form, costo: event.target.value }))} /><Button type="submit">Guardar mantención</Button></form><div className="overflow-x-auto rounded-2xl border border-surface bg-surface"><div className="p-4"><h3 className="text-sm font-bold">Historial de mantenciones</h3></div><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-y text-[10px] uppercase text-gray-500"><th className="p-3">Fecha</th><th className="p-3">Artículo</th><th className="p-3">Tipo</th><th className="p-3">Descripción</th><th className="p-3 text-right">Costo</th></tr></thead><tbody className="divide-y divide-surface">{mantenciones.map((row) => <tr key={row.id}><td className="p-3">{row.fecha}</td><td className="p-3">{items.find((item) => String(item.id) === row.itemId)?.nombre || abreviarId(row.itemId)}</td><td className="p-3">{row.tipo}</td><td className="p-3">{row.descripcion}</td><td className="p-3 text-right">{row.costo === null ? '—' : formatoDinero(row.costo)}</td></tr>)}</tbody></table>{mantenciones.length === 0 && <p className="p-6 text-center text-xs text-gray-500">No hay mantenciones registradas.</p>}</div></div>}

      {panel === 'permisos' && esAdmin && <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]"><form onSubmit={(event) => void guardarPermiso(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4"><h3 className="text-sm font-bold">Conceder permiso aditivo</h3><label className="block text-xs font-semibold">Miembro<select value={permisoUsuarioId} onChange={(event) => setPermisoUsuarioId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800" required><option value="">Selecciona</option>{miembros.filter((member) => member.activo && member.rol !== 'admin').map((member) => <option key={member.userId} value={member.userId}>{member.rol} · {abreviarId(member.userId)}</option>)}</select></label><label className="block text-xs font-semibold">Permiso<select value={permisoTipo} onChange={(event) => setPermisoTipo(event.target.value as typeof permisoTipo)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800">{Object.entries(nombresPermiso).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Button type="submit" disabled={!permisoUsuarioId}>Guardar permiso</Button><p className="text-[10px] text-gray-500">El permiso se valida en PostgreSQL y solo se aplica dentro de esta clínica.</p></form><div className="space-y-2 rounded-2xl border border-surface bg-surface p-4"><h3 className="text-sm font-bold">Permisos concedidos</h3>{permisosAditivos.map((grant) => <div key={grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted p-3 text-xs"><span>{miembros.find((member) => member.userId === grant.userId)?.rol || 'Miembro'} · {abreviarId(grant.userId)} · {nombresPermiso[grant.permiso]}</span><Button size="sm" variant="danger" onClick={() => void inventarioCloudService.quitarPermisoAditivo(grant.id).then(refrescarPaneles).catch((error) => notificationService.mostrar(mensajeError(error), { tipo: 'error' }))}>Revocar</Button></div>)}{permisosAditivos.length === 0 && <p className="py-6 text-center text-xs text-gray-500">No hay permisos aditivos de inventario.</p>}</div></div>}

      {panel === 'compras' && recibir && <Modal isOpen onClose={() => setRecibir(null)} title={`Recibir ${recibir.orden.folio}`} size="md"><form onSubmit={(event) => void recibirLineaOrden(event)} className="space-y-3"><p className="text-xs">{recibir.linea.nombre} · pendiente {recibir.linea.cantidadSolicitada - recibir.linea.cantidadRecibida} {recibir.linea.unidad}</p><Input label="Cantidad recibida" type="number" min="0.001" max={recibir.linea.cantidadSolicitada - recibir.linea.cantidadRecibida} step="0.001" required value={recepcionCantidad} onChange={(event) => setRecepcionCantidad(event.target.value)} /><label className="block text-xs font-semibold">Ubicación destino<select value={recepcionUbicacion} onChange={(event) => setRecepcionUbicacion(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-white p-2.5 dark:bg-graphite-800" required><option value="">Selecciona</option>{ubicaciones.map((location) => <option key={location.id} value={location.id}>{location.nombre}</option>)}</select></label><Input label={`Código de lote${items.find((item) => String(item.id) === recibir.linea.itemId)?.requiereLote ? ' (obligatorio)' : ''}`} type="text" required={items.find((item) => String(item.id) === recibir.linea.itemId)?.requiereLote} value={recepcionLote} onChange={(event) => setRecepcionLote(event.target.value)} /><Input label={`Vencimiento${items.find((item) => String(item.id) === recibir.linea.itemId)?.requiereVencimiento ? ' (obligatorio)' : ''}`} type="date" required={items.find((item) => String(item.id) === recibir.linea.itemId)?.requiereVencimiento} value={recepcionVencimiento} onChange={(event) => setRecepcionVencimiento(event.target.value)} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRecibir(null)}>Cerrar</Button><Button type="submit">Registrar entrada y lote</Button></div></form></Modal>}
    </section>
  )
})

InventarioPanelesBP09.displayName = 'InventarioPanelesBP09'
