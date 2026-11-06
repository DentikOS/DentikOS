import React, { memo, useEffect, useMemo, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { Input } from '../../../../shared/ui/ui/Input'
import { notificationService } from '../../../../infrastructure/notification/notificationService'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useRBAC } from '../../../../shared/hooks/useRBAC'
import {
  inventarioCloudService,
  type LoteDisponible,
  type MovimientoInventarioCommand,
  type UbicacionInventario
} from '../services/inventarioCloudService'
import type { ItemInventario } from '../services/inventarioStorageService'

interface Props {
  items: ItemInventario[]
  ubicaciones: UbicacionInventario[]
  onClose: () => void
  onRegistrar: (command: MovimientoInventarioCommand) => Promise<void>
}

type TipoMovimiento = MovimientoInventarioCommand['type']

const nuevoUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

export const ModalMovimientoInventario: React.FC<Props> = memo(({ items, ubicaciones, onClose, onRegistrar }) => {
  const { esAdmin, es } = useRBAC()
  const esAsistente = es('asistente')
  const [tipo, setTipo] = useState<TipoMovimiento>(esAdmin ? 'ajuste' : 'entrada_devolucion')
  const [itemId, setItemId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [signo, setSigno] = useState<1 | -1>(1)
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [loteCodigo, setLoteCodigo] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [lotes, setLotes] = useState<LoteDisponible[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const itemSeleccionado = items.find((item) => String(item.id) === itemId)
  const opciones = useMemo(() => esAdmin
    ? [
        { value: 'ajuste' as const, label: 'Ajuste con justificación' },
        { value: 'transferencia' as const, label: 'Transferencia entre ubicaciones' },
        { value: 'entrada_devolucion' as const, label: 'Entrada por devolución' },
        { value: 'salida_perdida_vencimiento' as const, label: 'Salida por pérdida o vencimiento' }
      ]
    : esAsistente ? [
        { value: 'transferencia' as const, label: 'Transferencia entre ubicaciones' },
        { value: 'entrada_devolucion' as const, label: 'Entrada por devolución' },
        { value: 'salida_perdida_vencimiento' as const, label: 'Salida por pérdida o vencimiento' }
      ] : [{ value: 'entrada_devolucion' as const, label: 'Entrada por devolución' }], [esAdmin, esAsistente])

  useEffect(() => {
    if (items.length > 0 && !itemId) setItemId(String(items[0].id))
  }, [items, itemId])

  useEffect(() => {
    if (!USE_SUPABASE || tipo !== 'salida_perdida_vencimiento') return
    void inventarioCloudService.listarLotesDisponibles().then(setLotes).catch(() => {
      setError('No se pudieron cargar los lotes disponibles.')
    })
  }, [tipo])

  useEffect(() => {
    setLoteId('')
  }, [itemId, origenId, tipo])

  const lotesVencidos = lotes.filter((lot) =>
    lot.itemId === itemId && lot.ubicacionId === origenId && lot.fechaVencimiento && lot.fechaVencimiento < new Date().toISOString().slice(0, 10)
  )
  const usaOrigen = tipo === 'transferencia' || tipo === 'salida_perdida_vencimiento' || (tipo === 'ajuste' && signo === -1)
  const usaDestino = tipo === 'transferencia' || tipo === 'entrada_devolucion' || (tipo === 'ajuste' && signo === 1)

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError('')
    const qty = Number(cantidad)
    if (!itemId || !Number.isFinite(qty) || qty <= 0) {
      setError('Selecciona un artículo y una cantidad mayor que cero.')
      return
    }
    if (justificacion.trim().length < 5) {
      setError('Escribe una justificación de al menos cinco caracteres.')
      return
    }
    if (usaOrigen && !origenId) {
      setError('Selecciona la ubicación de origen.')
      return
    }
    if (usaDestino && !destinoId) {
      setError('Selecciona la ubicación de destino.')
      return
    }
    if (tipo === 'transferencia' && origenId === destinoId) {
      setError('Origen y destino deben ser distintos.')
      return
    }
    if (tipo === 'salida_perdida_vencimiento' && !loteId) {
      setError('Selecciona un lote vencido con saldo disponible.')
      return
    }

    const command: MovimientoInventarioCommand = {
      idempotencyKey: nuevoUuid(),
      type: tipo,
      itemId,
      quantity: qty,
      ...(usaOrigen ? { sourceLocationId: origenId } : {}),
      ...(usaDestino ? { destinationLocationId: destinoId } : {}),
      ...(tipo === 'salida_perdida_vencimiento' ? { lotId: loteId } : {}),
      ...(tipo === 'entrada_devolucion' || (tipo === 'ajuste' && signo === 1) ? {
        lotCode: loteCodigo.trim() || undefined,
        expiryDate: vencimiento || undefined
      } : {}),
      ...(tipo === 'ajuste' ? { sign: signo } : {}),
      reason: justificacion.trim()
    }

    setGuardando(true)
    try {
      await onRegistrar(command)
      onClose()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo registrar el movimiento.'
      setError(message)
      notificationService.mostrar(message, { tipo: 'error', titulo: 'Movimiento rechazado' })
    } finally {
      setGuardando(false)
    }
  }

  const localLocationOptions = ubicaciones.length > 0
    ? ubicaciones
    : USE_SUPABASE ? [] : [{
        id: 'local', tipo: 'bodega_central' as const, nombre: 'Bodega local', estado: 'activo' as const
      }]

  return (
    <Modal isOpen onClose={onClose} title="Registrar movimiento de stock" size="lg">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {opciones.length > 1 && <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
            Tipo de movimiento
            <select value={tipo} onChange={(event) => setTipo(event.target.value as TipoMovimiento)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
              {opciones.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>}
          <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
            Artículo
            <select value={itemId} onChange={(event) => setItemId(event.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
              <option value="">Selecciona un artículo</option>
              {items.map((item) => <option key={item.id} value={String(item.id)}>{item.codigo ? `${item.codigo} · ` : ''}{item.nombre}</option>)}
            </select>
          </label>
        </div>

        {tipo === 'ajuste' && <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
          Dirección del ajuste
          <select value={signo} onChange={(event) => setSigno(Number(event.target.value) as 1 | -1)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
            <option value={1}>Aumentar saldo</option><option value={-1}>Disminuir saldo</option>
          </select>
        </label>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label={`Cantidad${itemSeleccionado?.unidad ? ` (${itemSeleccionado.unidad})` : ''}`} type="number" required min="0.001" step="0.001" value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
          {usaOrigen && <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
            Ubicación de origen
            <select value={origenId} onChange={(event) => setOrigenId(event.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
              <option value="">Selecciona</option>{localLocationOptions.map((location) => <option key={location.id} value={location.id}>{location.nombre}</option>)}
            </select>
          </label>}
          {usaDestino && <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
            Ubicación de destino
            <select value={destinoId} onChange={(event) => setDestinoId(event.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
              <option value="">Selecciona</option>{localLocationOptions.map((location) => <option key={location.id} value={location.id}>{location.nombre}</option>)}
            </select>
          </label>}
        </div>

        {(tipo === 'entrada_devolucion' || (tipo === 'ajuste' && signo === 1)) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={`Código de lote${itemSeleccionado?.requiereLote ? ' (obligatorio)' : ''}`} type="text" required={itemSeleccionado?.requiereLote} value={loteCodigo} onChange={(event) => setLoteCodigo(event.target.value)} />
            <Input label={`Vencimiento${itemSeleccionado?.requiereVencimiento ? ' (obligatorio)' : ''}`} type="date" required={itemSeleccionado?.requiereVencimiento} value={vencimiento} onChange={(event) => setVencimiento(event.target.value)} />
          </div>
        )}

        {tipo === 'salida_perdida_vencimiento' && <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
          Lote vencido
          <select value={loteId} onChange={(event) => setLoteId(event.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
            <option value="">Selecciona lote</option>
            {lotesVencidos.map((lot) => <option key={lot.id} value={lot.id}>{lot.codigo} · vence {lot.fechaVencimiento} · saldo {lot.cantidad}</option>)}
          </select>
        </label>}

        <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
          Justificación
          <textarea required minLength={5} maxLength={1000} rows={3} value={justificacion} onChange={(event) => setJustificacion(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 dark:border-graphite-600 dark:bg-graphite-800" placeholder="Describe brevemente el motivo del movimiento." />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" onClick={onClose} variant="ghost" fullWidth disabled={guardando}>Cancelar</Button>
          <Button type="submit" variant="primary" fullWidth disabled={guardando || items.length === 0}>{guardando ? 'Guardando…' : 'Registrar movimiento'}</Button>
        </div>
      </form>
    </Modal>
  )
})

ModalMovimientoInventario.displayName = 'ModalMovimientoInventario'
