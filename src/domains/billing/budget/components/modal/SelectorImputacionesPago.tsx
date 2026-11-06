import React from 'react'
import type { ImputacionPagoInput, PrestacionImputable } from '../../services/imputacionesPagoService'
import { formatearImporteDocumento, resolverIdiomaDocumento, resolverMonedaDocumento } from '../../../../../shared/utils/formatoDocumento'

interface SelectorImputacionesPagoProps {
  prestaciones: PrestacionImputable[]
  maximoImputable: number
  valores: Record<string, number>
  onChange: (valores: Record<string, number>) => void
  moneda?: string
  idioma?: string
}

export const leerImputacionesSeleccionadas = (valores: Record<string, number>): ImputacionPagoInput[] =>
  Object.entries(valores)
    .filter(([, monto]) => monto > 0)
    .map(([itemId, monto]) => ({ itemId, monto }))

export const SelectorImputacionesPago: React.FC<SelectorImputacionesPagoProps> = ({
  prestaciones,
  maximoImputable,
  valores,
  onChange,
  moneda: monedaProp,
  idioma: idiomaProp,
}) => {
  const moneda = resolverMonedaDocumento(monedaProp)
  const idioma = resolverIdiomaDocumento(idiomaProp)
  const formatear = (monto: number) => formatearImporteDocumento(monto, moneda, idioma)
  const imputado = leerImputacionesSeleccionadas(valores).reduce((total, item) => total + item.monto, 0)
  const excedido = imputado > maximoImputable
  const montoInvalido = !Number.isSafeInteger(imputado) || leerImputacionesSeleccionadas(valores).some((item) => !Number.isSafeInteger(item.monto))

  return (
    <section className="space-y-2 rounded-xl border border-surface p-3" aria-label="Imputación a prestaciones">
      <div className="flex items-center justify-between gap-2 text-xs">
        <strong>Asignar abono a prestaciones</strong>
        <span className={excedido || montoInvalido ? 'font-semibold text-rose-600' : 'text-graphite-600'}>
          Por asignar: {formatear(Math.max(0, maximoImputable - imputado))}
        </span>
      </div>
      <p className="text-[11px] text-graphite-500">
        La asignación es manual. Puedes dejar parte del abono sin asignar; una prestación queda pagada al cubrir su saldo neto.
      </p>
      {prestaciones.length === 0 && (
        <p className="text-xs text-amber-700">No hay prestaciones sincronizadas disponibles para imputar este abono.</p>
      )}
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {prestaciones.map((prestacion) => {
          const monto = valores[prestacion.id] || 0
          const invalido = monto > prestacion.saldoPendiente
          return (
            <div key={prestacion.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 border-t border-surface pt-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{prestacion.nombre}</p>
                <p className="text-[11px] text-graphite-500">
                  Neto {formatear(prestacion.montoNeto)} · Asignado {formatear(prestacion.montoImputado)} · Saldo {formatear(prestacion.saldoPendiente)}
                </p>
              </div>
              <label className="text-[11px] text-graphite-500">
                <span className="sr-only">Monto a imputar a {prestacion.nombre}</span>
                <input
                  type="number"
                  min="0"
                  max={prestacion.saldoPendiente}
                  step="1"
                  value={monto || ''}
                  disabled={prestacion.saldoPendiente <= 0}
                  onChange={(event) => onChange({ ...valores, [prestacion.id]: Math.max(0, Number(event.target.value) || 0) })}
                  className={`w-full rounded-lg border bg-surface p-2 text-right font-mono text-xs ${invalido ? 'border-rose-500' : 'border-surface'}`}
                  data-testid={`input-imputacion-${prestacion.id}`}
                />
              </label>
            </div>
          )
        })}
      </div>
      {excedido && <p role="alert" className="text-xs text-rose-600">La suma asignada supera el monto disponible del abono.</p>}
      {montoInvalido && <p role="alert" className="text-xs text-rose-600">Cada monto imputado debe ser un número entero en {moneda}.</p>}
      {prestaciones.some((prestacion) => (valores[prestacion.id] || 0) > prestacion.saldoPendiente) && (
        <p role="alert" className="text-xs text-rose-600">Una prestación no puede recibir más que su saldo neto.</p>
      )}
    </section>
  )
}
