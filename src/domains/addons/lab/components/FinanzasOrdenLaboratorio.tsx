import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Wallet } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'
import type { OrdenLaboratorio } from '../constants/laboratorioConstants'
import { laboratorioFinanceService, type CostoOrdenLaboratorio, type ResumenPagosLaboratorio, type MetodoPagoLaboratorio } from '../services/laboratorioFinanceService'

interface FinanzasOrdenLaboratorioProps {
  clinicaId: string | null
  ordenes: OrdenLaboratorio[]
  puedeVerCostos: boolean
  puedePagar: boolean
  puedeVerPrecioPaciente: boolean
  puedeGuardarCosto: boolean
}

const METODOS_PAGO: readonly MetodoPagoLaboratorio[] = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Cheque']

const formatCLP = (monto: number): string => new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0
}).format(monto)

const fechaLocalActual = (): string => {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

export const FinanzasOrdenLaboratorio: React.FC<FinanzasOrdenLaboratorioProps> = ({
  clinicaId,
  ordenes,
  puedeVerCostos,
  puedePagar,
  puedeVerPrecioPaciente,
  puedeGuardarCosto
}) => {
  const ordenesSincronizadas = useMemo(() => ordenes.filter(order => typeof order.id === 'string'), [ordenes])
  const [ordenId, setOrdenId] = useState('')
  const [costo, setCosto] = useState<CostoOrdenLaboratorio | null>(null)
  const [precioPaciente, setPrecioPaciente] = useState<number | null>(null)
  const [resumenPago, setResumenPago] = useState<ResumenPagosLaboratorio | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [informacion, setInformacion] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<string | null>(null)
  const [costoInput, setCostoInput] = useState('')
  const [precioInput, setPrecioInput] = useState('')
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(fechaLocalActual())
  const [metodoPago, setMetodoPago] = useState<MetodoPagoLaboratorio>('Transferencia')
  const [recarga, setRecarga] = useState(0)
  const idempotencyKeyRef = useRef('')
  const solicitudRef = useRef(0)

  useEffect(() => {
    if (!ordenesSincronizadas.some(order => order.id === ordenId)) {
      setOrdenId(ordenesSincronizadas[0]?.id as string || '')
    }
  }, [ordenId, ordenesSincronizadas])

  const cargarDatosFinancieros = useCallback(async (): Promise<void> => {
    const solicitud = ++solicitudRef.current
    setCosto(null)
    setPrecioPaciente(null)
    setResumenPago(null)
    setError(null)
    setInformacion(null)
    setConfirmacion(null)
    setCostoInput('')
    setPrecioInput('')
    idempotencyKeyRef.current = ''
    if (!clinicaId || !ordenId || (!puedeVerCostos && !puedePagar && !puedeVerPrecioPaciente)) {
      setCargando(false)
      return
    }

    setCargando(true)
    try {
      type Resultado =
        | { tipo: 'costo'; valor: CostoOrdenLaboratorio | null }
        | { tipo: 'precio'; valor: number | null }
        | { tipo: 'resumen'; valor: ResumenPagosLaboratorio }
      const peticiones: Array<Promise<Resultado>> = []
      if (puedeVerCostos) {
        peticiones.push(laboratorioFinanceService.obtenerCostoOrden(ordenId)
          .then(valor => ({ tipo: 'costo', valor })))
      } else if (puedeVerPrecioPaciente) {
        peticiones.push(laboratorioFinanceService.obtenerPrecioPaciente(ordenId)
          .then(valor => ({ tipo: 'precio', valor })))
      }
      if (puedeVerCostos || puedePagar) {
        peticiones.push(laboratorioFinanceService.obtenerResumenPagos(ordenId)
          .then(valor => ({ tipo: 'resumen', valor })))
      }
      const resultados = await Promise.allSettled(peticiones)
      if (solicitudRef.current !== solicitud) return
      let falloCarga = false
      for (const resultado of resultados) {
        if (resultado.status === 'rejected') {
          const reason = resultado.reason as { code?: string } | null
          if (reason?.code === 'COST_NOT_REGISTERED') {
            setInformacion('Aún no hay costos registrados para esta orden. Administración puede completarlos para habilitar los pagos.')
            continue
          }
          falloCarga = true
          continue
        }
        if (resultado.value.tipo === 'costo') {
          setCosto(resultado.value.valor)
          setPrecioPaciente(resultado.value.valor?.precioPaciente ?? null)
        } else if (resultado.value.tipo === 'precio') {
          setPrecioPaciente(resultado.value.valor)
        } else {
          setResumenPago(resultado.value.valor)
        }
      }
      if (falloCarga) {
        setError('No se pudo cargar la información financiera de la orden. Revisa el permiso y vuelve a intentar.')
      }
    } catch {
      if (solicitudRef.current === solicitud) {
        setError('No se pudo cargar la información financiera de la orden. Revisa el permiso y vuelve a intentar.')
      }
    } finally {
      if (solicitudRef.current === solicitud) setCargando(false)
    }
  }, [clinicaId, ordenId, puedeVerCostos, puedePagar, puedeVerPrecioPaciente])

  useEffect(() => {
    void cargarDatosFinancieros()
    return () => { solicitudRef.current += 1 }
  }, [cargarDatosFinancieros, recarga])

  useEffect(() => {
    const actualizarFinanzas = (): void => setRecarga(value => value + 1)
    window.addEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, actualizarFinanzas)
    return () => window.removeEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, actualizarFinanzas)
  }, [])

  useEffect(() => {
    setCostoInput(costo ? String(costo.costoTotal) : '')
    setPrecioInput(costo?.precioPaciente == null ? '' : String(costo.precioPaciente))
  }, [costo])

  const guardarCosto = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!ordenId) return
    const costoTotal = Number(costoInput)
    const precio = precioInput.trim() === '' ? null : Number(precioInput)
    if (!Number.isSafeInteger(costoTotal) || costoTotal < 0
      || (precio !== null && (!Number.isSafeInteger(precio) || precio < 0))) {
      setError('Ingresa montos enteros iguales o mayores a cero.')
      return
    }
    setGuardando(true)
    setError(null)
    setConfirmacion(null)
    try {
      await laboratorioFinanceService.guardarCostoOrden({ ordenId, costoTotal, precioPaciente: precio })
      setConfirmacion('Costos de la orden guardados.')
      setRecarga(value => value + 1)
    } catch {
      setError('No se pudo guardar el costo. Confirma tu rol y vuelve a intentar.')
    } finally {
      setGuardando(false)
    }
  }

  const registrarPago = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!ordenId) return
    const monto = Number(montoPago)
    if (!Number.isSafeInteger(monto) || monto <= 0) {
      setError('El monto del pago debe ser un número entero mayor que cero.')
      return
    }
    setGuardando(true)
    setError(null)
    setConfirmacion(null)
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = laboratorioFinanceService.generarIdempotencyKey()
      await laboratorioFinanceService.registrarPago({
        ordenId, monto, fecha: fechaPago, metodoPago, idempotencyKey: idempotencyKeyRef.current
      })
      idempotencyKeyRef.current = ''
      setMontoPago('')
      setConfirmacion('Pago de laboratorio registrado y vinculado al egreso de Finanzas.')
      setRecarga(value => value + 1)
    } catch {
      setError('No se pudo registrar el pago. El saldo se conserva; vuelve a intentar para consultar el resultado.')
    } finally {
      setGuardando(false)
    }
  }

  if (!puedeVerCostos && !puedePagar && !puedeVerPrecioPaciente) return null

  const margen = puedeVerCostos && costo?.precioPaciente != null && costo
    ? costo.precioPaciente - costo.costoTotal
    : null
  const saldoDisponible = resumenPago?.saldo

  return (
    <section className="rounded-2xl border border-surface bg-surface p-5 space-y-4" aria-label="Finanzas de órdenes de laboratorio">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-champagne-300/10 dark:text-champagne-300">
          <Wallet size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Costos y pagos de laboratorio</h3>
          <p className="mt-1 text-xs text-muted-foreground">Los cambios se sincronizan con la clínica y el registro de Finanzas.</p>
        </div>
      </div>

      {ordenesSincronizadas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface p-4 text-sm text-muted-foreground">No hay órdenes sincronizadas para consultar.</p>
      ) : (
        <>
          <label className="block max-w-2xl space-y-1 text-xs font-medium">
            <span>Orden</span>
            <select value={ordenId} onChange={event => setOrdenId(event.target.value)} className="min-h-10 w-full rounded-lg border border-surface bg-background px-3">
              {ordenesSincronizadas.map(order => (
                <option key={order.id} value={order.id}>{order.codigoOrden} · {order.pacienteNombre}</option>
              ))}
            </select>
          </label>

          {cargando && <p role="status" className="text-xs text-muted-foreground">Cargando datos financieros autorizados…</p>}
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
          {informacion && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{informacion}</p>}
          {confirmacion && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{confirmacion}</p>}

          {(puedeVerCostos || puedeVerPrecioPaciente) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {puedeVerCostos && (
                <article className="rounded-xl border border-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Costo laboratorio</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{costo ? formatCLP(costo.costoTotal) : 'Sin registrar'}</p>
                </article>
              )}
              <article className="rounded-xl border border-surface p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Precio al paciente</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{precioPaciente == null ? 'Sin definir' : formatCLP(precioPaciente)}</p>
              </article>
              {puedeVerCostos && (
                <article className="rounded-xl border border-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Margen estimado</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{margen == null ? 'Sin definir' : formatCLP(margen)}</p>
                </article>
              )}
            </div>
          )}

          {puedeGuardarCosto && (
            <form onSubmit={event => void guardarCosto(event)} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-surface p-4 sm:grid-cols-3" aria-label="Editar costo de orden">
              <label className="space-y-1 text-xs font-medium">
                <span>Costo del laboratorio (CLP)</span>
                <input aria-label="Costo del laboratorio" type="number" min={0} step={1} required value={costoInput} onChange={event => setCostoInput(event.target.value)} className="min-h-10 w-full rounded-lg border border-surface bg-background px-3" />
              </label>
              <label className="space-y-1 text-xs font-medium">
                <span>Precio al paciente (CLP)</span>
                <input aria-label="Precio al paciente" type="number" min={0} step={1} value={precioInput} onChange={event => setPrecioInput(event.target.value)} className="min-h-10 w-full rounded-lg border border-surface bg-background px-3" />
              </label>
              <Button type="submit" loading={guardando}>Guardar costos</Button>
            </form>
          )}

          {(puedeVerCostos || puedePagar) && resumenPago && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {puedeVerCostos && resumenPago.costoTotal !== undefined && (
                <article className="rounded-xl border border-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total pagado al laboratorio</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{formatCLP(resumenPago.totalPagado)}</p>
                </article>
              )}
              <article className="rounded-xl border border-surface p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Saldo pendiente</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatCLP(resumenPago.saldo)}</p>
              </article>
            </div>
          )}

          {puedePagar && (
            <form onSubmit={event => void registrarPago(event)} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-surface p-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Registrar pago de laboratorio">
              <label className="space-y-1 text-xs font-medium">
                <span>Monto de la cuota (CLP)</span>
                <input aria-label="Monto de la cuota" type="number" min={1} max={saldoDisponible ?? undefined} step={1} required value={montoPago} onChange={event => setMontoPago(event.target.value)} className="min-h-10 w-full rounded-lg border border-surface bg-background px-3" />
              </label>
              <label className="space-y-1 text-xs font-medium">
                <span>Fecha</span>
                <input aria-label="Fecha del pago" type="date" required value={fechaPago} onChange={event => setFechaPago(event.target.value)} className="min-h-10 w-full rounded-lg border border-surface bg-background px-3" />
              </label>
              <label className="space-y-1 text-xs font-medium">
                <span>Método</span>
                <select value={metodoPago} onChange={event => setMetodoPago(event.target.value as MetodoPagoLaboratorio)} className="min-h-10 w-full rounded-lg border border-surface bg-background px-3">
                  {METODOS_PAGO.map(method => <option key={method} value={method}>{method}</option>)}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">{saldoDisponible === undefined ? 'Registra primero el costo de la orden.' : `Saldo: ${formatCLP(saldoDisponible)}`}</p>
              <Button type="submit" loading={guardando} disabled={saldoDisponible === undefined || saldoDisponible <= 0}>Registrar pago</Button>
            </form>
          )}

          {(puedeVerCostos || puedePagar) && (
            <div className="overflow-x-auto rounded-xl border border-surface">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead><tr className="border-b border-surface bg-background text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">Fecha</th><th className="p-3">Método</th><th className="p-3 text-right">Cuota</th>
                </tr></thead>
                <tbody>
                  {!resumenPago || resumenPago.pagos.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Aún no hay pagos registrados.</td></tr>
                  ) : resumenPago.pagos.map(payment => (
                    <tr key={payment.id} className="border-b border-surface last:border-0">
                      <td className="p-3">{payment.fecha}</td><td className="p-3">{payment.metodoPago}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{formatCLP(payment.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
