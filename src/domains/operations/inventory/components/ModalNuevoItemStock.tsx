import React, { memo, useEffect, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { CATEGORIAS_INSUMOS, UNIDADES_MEDIDA } from '../constants/inventarioConstants'
import type { ItemInventario } from '../services/inventarioStorageService'

const TIPOS_ITEM: Array<{ value: NonNullable<ItemInventario['tipoItem']>; label: string }> = [
  { value: 'insumo_clinico', label: 'Insumo clínico' },
  { value: 'producto_venta', label: 'Producto para venta' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'implante_protesis', label: 'Implante / prótesis' },
  { value: 'equipamiento', label: 'Equipamiento' }
]

const generarId = (): string => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `local-${Date.now()}`

export interface ModalNuevoItemStockProps {
  itemEditar: ItemInventario | null
  alGuardar: (item: ItemInventario) => void
  alCerrar: () => void
}

export const ModalNuevoItemStock: React.FC<ModalNuevoItemStockProps> = memo(({ itemEditar, alGuardar, alCerrar }) => {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tipoItem, setTipoItem] = useState<NonNullable<ItemInventario['tipoItem']>>('insumo_clinico')
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_INSUMOS[0])
  const [minimoCritico, setMinimoCritico] = useState<string | number>('0')
  const [cantidadMaxima, setCantidadMaxima] = useState<string | number>('')
  const [puntoReorden, setPuntoReorden] = useState<string | number>('')
  const [unidad, setUnidad] = useState<string>(UNIDADES_MEDIDA[0])
  const [precioCompra, setPrecioCompra] = useState<string | number>('')
  const [precioVenta, setPrecioVenta] = useState<string | number>('')
  const [ivaPorcentaje, setIvaPorcentaje] = useState<string | number>('0')
  const [proveedor, setProveedor] = useState('')
  const [requiereLote, setRequiereLote] = useState(false)
  const [requiereVencimiento, setRequiereVencimiento] = useState(false)
  const [requiereEsterilizacion, setRequiereEsterilizacion] = useState(false)
  const [numeroSerie, setNumeroSerie] = useState('')
  const [fechaInstalacion, setFechaInstalacion] = useState('')
  const [vidaUtilHoras, setVidaUtilHoras] = useState<string | number>('')
  const [proximaMantencion, setProximaMantencion] = useState('')

  useEffect(() => {
    if (!itemEditar) return
    setNombre(itemEditar.nombre || '')
    setCodigo(itemEditar.codigo || '')
    setTipoItem(itemEditar.tipoItem || 'insumo_clinico')
    setCategoria(itemEditar.categoria || CATEGORIAS_INSUMOS[0])
    setMinimoCritico(itemEditar.minimoCritico ?? 0)
    setCantidadMaxima(itemEditar.cantidadMaxima ?? '')
    setPuntoReorden(itemEditar.puntoReorden ?? '')
    setUnidad(itemEditar.unidad || UNIDADES_MEDIDA[0])
    setPrecioCompra(itemEditar.precioCompra ?? itemEditar.precioUnitario ?? '')
    setPrecioVenta(itemEditar.precioVenta ?? '')
    setIvaPorcentaje(itemEditar.ivaPorcentaje ?? 0)
    setProveedor(itemEditar.proveedor || '')
    setRequiereLote(itemEditar.requiereLote === true)
    setRequiereVencimiento(itemEditar.requiereVencimiento === true)
    setRequiereEsterilizacion(itemEditar.requiereEsterilizacion === true)
    setNumeroSerie(itemEditar.numeroSerie || '')
    setFechaInstalacion(itemEditar.fechaInstalacion || '')
    setVidaUtilHoras(itemEditar.vidaUtilHoras ?? '')
    setProximaMantencion(itemEditar.proximaMantencion || '')
  }, [itemEditar])

  useEffect(() => {
    setIvaPorcentaje(tipoItem === 'producto_venta' ? 19 : 0)
    if (tipoItem === 'instrumental' || tipoItem === 'implante_protesis') setRequiereEsterilizacion(true)
  }, [tipoItem])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!nombre.trim() || !codigo.trim()) return
    const numberOrEmpty = (value: string | number): number | '' => value === '' ? '' : Number(value)
    const item: ItemInventario = {
      ...(itemEditar || {}),
      id: itemEditar?.id || generarId(),
      nombre: nombre.trim(),
      codigo: codigo.trim(),
      tipoItem,
      categoria,
      cantidad: itemEditar?.cantidad ?? 0,
      minimoCritico: Number(minimoCritico) || 0,
      cantidadMaxima: numberOrEmpty(cantidadMaxima),
      puntoReorden: numberOrEmpty(puntoReorden),
      unidad,
      fechaVencimiento: itemEditar?.fechaVencimiento || '',
      precioCompra: numberOrEmpty(precioCompra),
      precioVenta: numberOrEmpty(precioVenta),
      precioUnitario: Number(precioCompra) || 0,
      ivaPorcentaje: tipoItem === 'producto_venta' ? 19 : Number(ivaPorcentaje) || 0,
      proveedor: proveedor.trim(),
      proveedorId: proveedor.trim() === itemEditar?.proveedor?.trim() ? itemEditar?.proveedorId : '',
      requiereLote,
      requiereVencimiento,
      requiereEsterilizacion: tipoItem === 'instrumental' || tipoItem === 'implante_protesis' || requiereEsterilizacion,
      estadoInstrumental: tipoItem === 'instrumental' ? itemEditar?.estadoInstrumental || 'disponible' : '',
      numeroSerie: numeroSerie.trim(),
      fechaInstalacion,
      vidaUtilHoras: numberOrEmpty(vidaUtilHoras),
      proximaMantencion
    }
    alGuardar(item)
    alCerrar()
  }

  const checkClass = 'h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'

  return (
    <Modal isOpen onClose={alCerrar} title={itemEditar ? 'Editar artículo de inventario' : 'Nuevo artículo de inventario'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nombre" type="text" required maxLength={160} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Guantes de nitrilo talla M" />
          <Input label="Código único" type="text" required maxLength={80} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: GUA-001" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
            Tipo de artículo
            <select value={tipoItem} onChange={(e) => setTipoItem(e.target.value as NonNullable<ItemInventario['tipoItem']>)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
              {TIPOS_ITEM.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
            Categoría
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
              {CATEGORIAS_INSUMOS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-gray-700 dark:text-graphite-300">
            Unidad de medida
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 dark:border-graphite-600 dark:bg-graphite-800">
              {UNIDADES_MEDIDA.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Stock mínimo" type="number" min="0" step="0.001" value={minimoCritico} onChange={(e) => setMinimoCritico(e.target.value)} />
          <Input label="Punto de reorden" type="number" min="0" step="0.001" value={puntoReorden} onChange={(e) => setPuntoReorden(e.target.value)} />
          <Input label="Stock máximo" type="number" min="0" step="0.001" value={cantidadMaxima} onChange={(e) => setCantidadMaxima(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Precio de compra (CLP)" type="number" min="0" step="0.01" value={precioCompra} onChange={(e) => setPrecioCompra(e.target.value)} />
          <Input label="Precio de venta (CLP)" type="number" min="0" step="0.01" required={tipoItem === 'producto_venta'} value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} disabled={tipoItem !== 'producto_venta'} />
          <Input label="IVA (%)" type="number" min="0" max="100" step="0.01" value={tipoItem === 'producto_venta' ? 19 : ivaPorcentaje} disabled />
        </div>

        <Input label="Proveedor principal" type="text" maxLength={160} value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Proveedor de referencia" />

        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-surface bg-surface-muted p-3 text-xs">
          <label className="inline-flex items-center gap-2"><input className={checkClass} type="checkbox" checked={requiereLote} onChange={(e) => setRequiereLote(e.target.checked)} /> Requiere lote</label>
          <label className="inline-flex items-center gap-2"><input className={checkClass} type="checkbox" checked={requiereVencimiento} onChange={(e) => setRequiereVencimiento(e.target.checked)} /> Requiere vencimiento</label>
          {(tipoItem === 'instrumental' || tipoItem === 'implante_protesis') && <span className="inline-flex items-center gap-2 font-semibold"><input className={checkClass} type="checkbox" checked disabled /> Requiere esterilización</span>}
        </div>

        {tipoItem === 'equipamiento' && (
          <div className="space-y-2">
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">Para que un equipo se pueda elegir como autoclave en BP10, asigna la categoría <strong>Esterilización</strong>.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Número de serie" type="text" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
            <Input label="Fecha de instalación" type="date" value={fechaInstalacion} onChange={(e) => setFechaInstalacion(e.target.value)} />
            <Input label="Vida útil estimada (horas)" type="number" min="0.01" step="0.01" value={vidaUtilHoras} onChange={(e) => setVidaUtilHoras(e.target.value)} />
            <Input label="Próxima mantención" type="date" value={proximaMantencion} onChange={(e) => setProximaMantencion(e.target.value)} />
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-graphite-400">El saldo se registra con una entrada o ajuste trazable después de crear el artículo.</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={alCerrar} variant="ghost" fullWidth>Cancelar</Button>
          <Button type="submit" variant="primary" fullWidth>{itemEditar ? 'Guardar cambios' : 'Crear artículo'}</Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevoItemStock.displayName = 'ModalNuevoItemStock'
