import React, { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import type { ImputacionRegistrada, PagoImputable, PrestacionImputable } from '../../services/imputacionesPagoService'
import { leerImputacionesSeleccionadas, SelectorImputacionesPago } from './SelectorImputacionesPago'
import { formatearImporteDocumento, resolverIdiomaDocumento, resolverMonedaDocumento } from '../../../../../shared/utils/formatoDocumento'

interface ModalImputarPagoProps {
  pago: PagoImputable
  moneda?: string
  idioma?: string
  prestaciones: PrestacionImputable[]
  imputaciones: ImputacionRegistrada[]
  onImputar: (pagoId: string, imputaciones: Array<{ itemId: string; monto: number }>) => Promise<boolean>
  onRevertir: (imputacionId: string, motivo: string) => Promise<boolean>
  onCerrar: () => void
}

export const ModalImputarPago: React.FC<ModalImputarPagoProps> = ({
  pago,
  moneda: monedaProp,
  idioma: idiomaProp,
  prestaciones,
  imputaciones,
  onImputar,
  onRevertir,
  onCerrar,
}) => {
  const moneda = resolverMonedaDocumento(monedaProp)
  const idioma = resolverIdiomaDocumento(idiomaProp)
  const formatear = (monto: number) => formatearImporteDocumento(monto, moneda, idioma)
  const [valores, setValores] = useState<Record<string, number>>({})
  const [reversionActiva, setReversionActiva] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const seleccionadas = leerImputacionesSeleccionadas(valores)
  const totalSeleccionado = seleccionadas.reduce((total, item) => total + item.monto, 0)
  const imputacionesPago = imputaciones.filter((item) => item.pagoId === pago.id)

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!seleccionadas.length || seleccionadas.some((item) => !Number.isSafeInteger(item.monto)) ||
      !Number.isSafeInteger(totalSeleccionado) || totalSeleccionado > pago.montoSinImputar ||
      seleccionadas.some((item) => item.monto > (prestaciones.find((prestacion) => prestacion.id === item.itemId)?.saldoPendiente ?? 0))) {
      setError('Revisa el monto disponible del abono y el saldo de cada prestación.')
      return
    }
    setProcesando(true)
    setError('')
    try {
      if (await onImputar(pago.id, seleccionadas)) onCerrar()
      else setError('No se pudo guardar la imputación. Comprueba los saldos y vuelve a intentar.')
    } catch {
      setError('No se pudo guardar la imputación. Comprueba los saldos y vuelve a intentar.')
    } finally {
      setProcesando(false)
    }
  }

  const guardarReversion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reversionActiva || motivo.trim().length < 5 || motivo.trim().length > 250) return
    setProcesando(true)
    setError('')
    try {
      if (await onRevertir(reversionActiva, motivo.trim())) {
        setReversionActiva(null)
        setMotivo('')
      } else setError('No se pudo corregir la imputación. Comprueba el estado y vuelve a intentar.')
    } catch {
      setError('No se pudo corregir la imputación. Comprueba el estado y vuelve a intentar.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" data-testid="modal-imputar-pago">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col space-y-4 overflow-y-auto rounded-2xl border border-surface bg-surface p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-surface pb-3">
          <div>
            <h3 className="text-base font-bold">Imputar abono a prestaciones</h3>
            <p className="text-xs text-graphite-500">Abono de {formatear(pago.monto)} · {pago.metodoPago} · {pago.fecha}</p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1 text-graphite-400 hover:bg-surface-hover" aria-label="Cerrar imputación">
            <X className="h-5 w-5" />
          </button>
        </header>

        <p className="rounded-xl bg-primary/10 p-3 text-xs">
          Sin asignar: <strong>{formatear(pago.montoSinImputar)}</strong> · Asignado actualmente: {formatear(pago.montoImputado)}
        </p>

        {pago.montoSinImputar > 0 ? (
          <form onSubmit={guardar} className="space-y-3">
            <SelectorImputacionesPago
              prestaciones={prestaciones}
              maximoImputable={pago.montoSinImputar}
              valores={valores}
              onChange={setValores}
              moneda={moneda}
              idioma={idioma}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>Cerrar</Button>
              <Button type="submit" variant="primary" size="sm" icon={CheckCircle2}
                disabled={procesando || !seleccionadas.length || totalSeleccionado > pago.montoSinImputar}>
                Asignar {formatear(totalSeleccionado)}
              </Button>
            </div>
          </form>
        ) : <p className="text-xs text-graphite-500">Este abono no tiene monto sin asignar.</p>}

        {imputacionesPago.length > 0 && (
          <section className="space-y-2" aria-label="Imputaciones registradas">
            <h4 className="text-xs font-bold">Imputaciones registradas</h4>
            {imputacionesPago.map((imputacion) => (
              <article key={imputacion.id} className="space-y-2 rounded-xl border border-surface p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{imputacion.itemNombre}</p>
                    <p className="text-graphite-500">
                      Original {formatear(imputacion.monto)} · Vigente {formatear(imputacion.montoVigente)}
                    </p>
                  </div>
                  {imputacion.montoVigente > 0 && (
                    <button type="button" className="rounded-lg border border-surface px-2 py-1 font-semibold"
                      disabled={procesando}
                      onClick={() => { setError(''); setReversionActiva(imputacion.id); setMotivo('') }}>
                      Corregir
                    </button>
                  )}
                </div>
                {imputacion.reversiones.map((reversion) => (
                  <p key={reversion.id} className="border-t border-surface pt-2 text-graphite-500">
                    Revertido {formatear(reversion.monto)} · {reversion.motivo} · {new Date(reversion.createdAt).toLocaleString(idioma)}
                  </p>
                ))}
                {reversionActiva === imputacion.id && (
                  <form onSubmit={guardarReversion} className="space-y-2 border-t border-surface pt-2">
                    <label className="block text-[11px] font-semibold">
                      Motivo de la corrección
                      <textarea value={motivo} maxLength={250} minLength={5}
                        onChange={(event) => setMotivo(event.target.value)} rows={2}
                        className="mt-1 w-full rounded-lg border border-surface bg-surface p-2 text-xs font-normal"
                        required />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setReversionActiva(null)}>Cancelar</Button>
                      <Button type="submit" variant="primary" size="sm"
                        disabled={procesando || motivo.trim().length < 5}>
                        Revertir {formatear(imputacion.montoVigente)}
                      </Button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </section>
        )}
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  )
}
