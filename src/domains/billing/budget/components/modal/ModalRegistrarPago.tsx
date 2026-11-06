import React, { useEffect, useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { imputacionesPagoService, type PrestacionImputable } from '../../services/imputacionesPagoService'
import { leerImputacionesSeleccionadas, SelectorImputacionesPago } from './SelectorImputacionesPago'
import { formatearImporteDocumento, resolverIdiomaDocumento, resolverMonedaDocumento } from '../../../../../shared/utils/formatoDocumento'
import { useClinicaDocumento } from '../../../../organization/clinic/hooks/useClinicaDocumento'

export type MedioPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque'

export interface PagoRegistrado {
  id: string
  monto: number
  medioPago: MedioPago
  referencia: string
  fecha: string
  nuevoEstado: 'en_curso' | 'completado'
  imputaciones: Array<{ itemId: string; monto: number }>
}

interface ModalRegistrarPagoProps {
  saldoPendiente: number
  totalPresupuesto: number
  presupuestoId?: string | number
  folioPresupuesto?: string
  pacienteNombre?: string
  moneda?: string
  onRegistrarPago: (pago: PagoRegistrado) => boolean | void | Promise<boolean | void>
  onCerrar: () => void
}

export const ModalRegistrarPago: React.FC<ModalRegistrarPagoProps> = ({
  saldoPendiente,
  totalPresupuesto,
  presupuestoId,
  folioPresupuesto,
  pacienteNombre = 'Paciente',
  moneda: monedaProp,
  onRegistrarPago,
  onCerrar,
}) => {
  const clinicaDocumento = useClinicaDocumento()
  const moneda = resolverMonedaDocumento(monedaProp)
  const idioma = resolverIdiomaDocumento(clinicaDocumento.idiomaDocumentos)
  const [monto, setMonto] = useState<number>(saldoPendiente)
  const [medioPago, setMedioPago] = useState<MedioPago>('tarjeta')
  const [referencia, setReferencia] = useState('')
  const [errorMonto, setErrorMonto] = useState('')
  const [errorRegistro, setErrorRegistro] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [pagoId] = useState(() => crypto.randomUUID())
  const [prestaciones, setPrestaciones] = useState<PrestacionImputable[]>([])
  const [valoresImputacion, setValoresImputacion] = useState<Record<string, number>>({})
  const [cargandoPrestaciones, setCargandoPrestaciones] = useState(Boolean(presupuestoId))
  const [errorPrestaciones, setErrorPrestaciones] = useState(false)

  useEffect(() => {
    let vigente = true
    if (!presupuestoId) return () => { vigente = false }
    setCargandoPrestaciones(true)
    void imputacionesPagoService.listar(presupuestoId).then((snapshot) => {
      if (!vigente) return
      setPrestaciones(snapshot.items)
      setErrorPrestaciones(false)
    }).catch(() => {
      if (vigente) setErrorPrestaciones(true)
    }).finally(() => {
      if (vigente) setCargandoPrestaciones(false)
    })
    return () => { vigente = false }
  }, [presupuestoId])

  const handleMontoChange = (val: number) => {
    setMonto(val)
    if (val <= 0) {
      setErrorMonto('El monto debe ser mayor a $0.')
    } else if (val > saldoPendiente) {
      setErrorMonto(`El monto no puede exceder el saldo pendiente (${formatearImporteDocumento(saldoPendiente, moneda, idioma)}).`)
    } else {
      setErrorMonto('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (monto <= 0 || monto > saldoPendiente) return

    const imputaciones = leerImputacionesSeleccionadas(valoresImputacion)
    if (imputaciones.some((item) => !Number.isSafeInteger(item.monto)) ||
      !Number.isSafeInteger(imputaciones.reduce((total, item) => total + item.monto, 0)) ||
      imputaciones.reduce((total, item) => total + item.monto, 0) > monto ||
      imputaciones.some((item) => item.monto > (prestaciones.find((prestacion) => prestacion.id === item.itemId)?.saldoPendiente ?? 0))) {
      setErrorRegistro('Revisa los montos asignados; no pueden superar el abono ni el saldo de una prestación.')
      return
    }

    const nuevoSaldo = saldoPendiente - monto
    const nuevoEstado: 'en_curso' | 'completado' = nuevoSaldo === 0 ? 'completado' : 'en_curso'

    const pago: PagoRegistrado = {
      id: pagoId,
      monto,
      medioPago,
      referencia: referencia.trim() || `Transacción ${medioPago}`,
      fecha: new Date().toISOString(),
      nuevoEstado,
      imputaciones,
    }

    setRegistrando(true)
    setErrorRegistro('')
    try {
      const resultado = await onRegistrarPago(pago)
      if (resultado === false) { setErrorRegistro('No se pudo registrar el pago.'); return }
      onCerrar()
    } catch {
      setErrorRegistro('No se pudo registrar el pago. Comprueba el estado y saldo del presupuesto.')
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" data-testid="modal-registrar-pago">
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface">
          <div>
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">
              Registrar abono manual (BP07 §19)
            </h3>
            <p className="text-xs text-graphite-500">
              {pacienteNombre} &bull; Folio: <span className="font-mono">{folioPresupuesto}</span>
            </p>
          </div>
          <button onClick={onCerrar} className="p-1 rounded-lg hover:bg-surface-hover text-graphite-400" aria-label="Cerrar modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-surface/50 border border-surface rounded-xl text-xs">
          <div>
            <span className="text-graphite-400 block text-[11px]">Total Presupuesto</span>
            <span className="font-mono font-bold text-graphite-700 dark:text-graphite-300 text-sm">
              {formatearImporteDocumento(totalPresupuesto, moneda, idioma)}
            </span>
          </div>
          <div>
            <span className="text-graphite-400 block text-[11px]">Saldo Pendiente</span>
            <span className="font-mono font-bold text-primary text-sm">
              {formatearImporteDocumento(saldoPendiente, moneda, idioma)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Monto a Pagar ({moneda})
            </label>
            <input
              type="number"
              min="1"
              max={saldoPendiente}
              value={monto}
              onChange={(e) => handleMontoChange(Number(e.target.value))}
              className="w-full p-2.5 bg-surface border border-surface rounded-xl font-mono text-base font-bold text-primary"
              data-testid="input-monto-pago"
              required
            />
            {errorMonto && <p className="text-xs text-rose-500 mt-1 font-medium">{errorMonto}</p>}
          </div>

          <div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
                Medio de Pago
              </label>
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
                data-testid="select-medio-pago"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta (Débito/Crédito)</option>
                <option value="transferencia">Transferencia Electrónica</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-graphite-500">El pago se atribuye al usuario autenticado de la clínica.</p>

          <div>
            <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
              Referencia / Comprobante
            </label>
            <input
              type="text"
              placeholder="Ej: Transbank Op. #84920 o Transf. BancoEstado"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
              data-testid="input-referencia-pago"
            />
          </div>

          {presupuestoId && (
            <>
              {cargandoPrestaciones && <p className="text-xs text-graphite-500">Consultando prestaciones y saldos…</p>}
              {errorPrestaciones && (
                <p className="text-xs text-amber-700">
                  No se pudieron consultar las prestaciones. El abono puede registrarse sin asignar y luego imputarse desde el historial.
                </p>
              )}
              {!cargandoPrestaciones && !errorPrestaciones && (
                <SelectorImputacionesPago
                  prestaciones={prestaciones}
                  maximoImputable={monto}
                  valores={valoresImputacion}
                  onChange={setValoresImputacion}
                  moneda={moneda}
                  idioma={idioma}
                />
              )}
            </>
          )}

          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs flex items-center justify-between">
            <span className="text-graphite-600 dark:text-graphite-300">Transición de Estado Automática:</span>
            <span className="font-bold uppercase tracking-wider text-primary">
              {monto >= saldoPendiente ? 'COMPLETADO (100% Pagado)' : 'EN CURSO (Pago Parcial)'}
            </span>
          </div>
          {errorRegistro && <p role="alert" className="text-xs text-rose-600">{errorRegistro}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
            <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              disabled={Boolean(errorMonto) || monto <= 0 || registrando || cargandoPrestaciones}
              data-testid="btn-confirmar-registro-pago"
            >
              Registrar Pago ({formatearImporteDocumento(monto, moneda, idioma)})
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
