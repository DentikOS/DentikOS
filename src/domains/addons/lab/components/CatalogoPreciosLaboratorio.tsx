import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, RefreshCw, Save } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { Input } from '../../../../shared/ui/ui/Input'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'
import { laboratorioCoreService, type PrecioLaboratorioActual } from '../services/laboratorioCoreService'

interface Option { id: string; nombre: string }

export interface CatalogoPreciosLaboratorioProps {
  laboratorios: Option[]
  tiposTrabajo: Option[]
  puedeGestionar: boolean
}

const clp = (value: number): string => formatearImporteDocumento(value, 'CLP')

export const CatalogoPreciosLaboratorio: React.FC<CatalogoPreciosLaboratorioProps> = ({
  laboratorios,
  tiposTrabajo,
  puedeGestionar
}) => {
  const [precios, setPrecios] = useState<PrecioLaboratorioActual[]>([])
  const [laboratorioId, setLaboratorioId] = useState('')
  const [tipoTrabajoId, setTipoTrabajoId] = useState('')
  const [costo, setCosto] = useState('')
  const [diasEstimados, setDiasEstimados] = useState('')
  const [condicionPago, setCondicionPago] = useState('')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const labPorId = useMemo(() => new Map(laboratorios.map(item => [item.id, item.nombre])), [laboratorios])
  const tipoPorId = useMemo(() => new Map(tiposTrabajo.map(item => [item.id, item.nombre])), [tiposTrabajo])
  const precioSeleccionado = precios.find(price => price.laboratorioId === laboratorioId && price.tipoTrabajoId === tipoTrabajoId)

  const cargar = useCallback(async (): Promise<void> => {
    if (!puedeGestionar) return
    setCargando(true)
    setError(null)
    try {
      setPrecios(await laboratorioCoreService.listarPreciosActuales())
    } catch {
      setError('No se pudo cargar el tarifario vigente. Revisa la clínica y los permisos.')
    } finally {
      setCargando(false)
    }
  }, [puedeGestionar])

  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => {
    if (!laboratorioId && laboratorios[0]) setLaboratorioId(laboratorios[0].id)
  }, [laboratorios, laboratorioId])
  useEffect(() => {
    if (!tipoTrabajoId && tiposTrabajo[0]) setTipoTrabajoId(tiposTrabajo[0].id)
  }, [tiposTrabajo, tipoTrabajoId])
  useEffect(() => {
    setCosto(precioSeleccionado ? String(precioSeleccionado.costo) : '')
    setDiasEstimados(precioSeleccionado?.diasEstimados == null ? '' : String(precioSeleccionado.diasEstimados))
    setCondicionPago(precioSeleccionado?.condicionPago || '')
  }, [precioSeleccionado?.id])

  const guardar = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const importe = Number(costo)
    const dias = diasEstimados.trim() === '' ? null : Number(diasEstimados)
    if (!laboratorioId || !tipoTrabajoId || !Number.isSafeInteger(importe) || importe < 0
      || (dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 365))) {
      setError('Revisa el laboratorio, tipo, costo y días estimados.')
      return
    }
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      await laboratorioCoreService.guardarPrecio({
        laboratorioId, tipoTrabajoId, costo: importe, diasEstimados: dias, condicionPago
      })
      await cargar()
      setMensaje('Precio vigente guardado. La versión anterior permanece en el historial.')
    } catch {
      setError('No se pudo guardar el precio. Confirma que el laboratorio y el tipo sigan activos.')
    } finally {
      setGuardando(false)
    }
  }

  if (!puedeGestionar) return null

  return (
    <section className="rounded-2xl border border-surface bg-surface p-5 space-y-4" aria-label="Tarifario de laboratorios">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CircleDollarSign size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Tarifario de costos por laboratorio</h3>
          <p className="mt-1 text-xs text-muted-foreground">Cada cambio conserva el precio anterior. Las nuevas órdenes toman el costo vigente y el precio al paciente del presupuesto.</p>
        </div>
        <Button type="button" variant="outline" size="sm" icon={RefreshCw} loading={cargando} onClick={() => void cargar()}>Actualizar</Button>
      </div>

      {laboratorios.length === 0 || tiposTrabajo.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface p-4 text-sm text-muted-foreground">Agrega un laboratorio y un tipo de trabajo activo antes de registrar precios.</p>
      ) : (
        <form onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
          <label className="space-y-1 text-xs font-medium">
            <span>Laboratorio</span>
            <select value={laboratorioId} onChange={event => setLaboratorioId(event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              {laboratorios.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>Tipo de trabajo</span>
            <select value={tipoTrabajoId} onChange={event => setTipoTrabajoId(event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              {tiposTrabajo.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <Input label="Costo del laboratorio (CLP)" type="number" min="0" step="1" required value={costo} onChange={event => setCosto(event.target.value)} />
          <Input label="Días estimados" type="number" min="1" max="365" value={diasEstimados} onChange={event => setDiasEstimados(event.target.value)} />
          <Button type="submit" icon={Save} loading={guardando} disabled={cargando}>Guardar precio</Button>
          <Input label="Condición de pago" value={condicionPago} maxLength={500} onChange={event => setCondicionPago(event.target.value)} className="md:col-span-2 xl:col-span-5" />
        </form>
      )}

      {error && <p role="alert" className="text-xs text-clinical-error">{error}</p>}
      {mensaje && <p role="status" className="text-xs text-clinical-success">{mensaje}</p>}

      <div className="border-t border-surface pt-3">
        <h4 className="text-xs font-semibold">Precios vigentes</h4>
        {cargando ? <p className="mt-2 text-xs text-muted-foreground">Cargando tarifario…</p> : precios.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No hay precios vigentes registrados.</p>
        ) : (
          <ul className="mt-2 divide-y divide-surface">
            {precios.map(price => (
              <li key={price.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="font-medium">{labPorId.get(price.laboratorioId) || 'Laboratorio'} · {tipoPorId.get(price.tipoTrabajoId) || 'Trabajo'}</span>
                <span className="text-right tabular-nums">{clp(price.costo)}{price.diasEstimados ? ` · ${price.diasEstimados} días` : ''}{price.condicionPago ? ` · ${price.condicionPago}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
