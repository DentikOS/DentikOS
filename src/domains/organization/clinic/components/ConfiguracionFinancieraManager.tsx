import React, { useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'
import { useConfiguracionFinanciera } from '../hooks/useConfiguracionFinanciera'
import {
  METODOS_PAGO_CLINICA,
  type ConfiguracionFinanciera,
} from '../schemas/configuracionFinancieraSchema'

const ETIQUETAS_METODO: Record<(typeof METODOS_PAGO_CLINICA)[number], string> = {
  efectivo: 'Efectivo',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia bancaria',
  cheque: 'Cheque',
}

const ETIQUETAS_RECORDATORIO: Array<{
  clave: keyof ConfiguracionFinanciera['recordatorios']
  etiqueta: string
}> = [
  { clave: 'presupuestoSinRespuesta', etiqueta: 'Presupuesto sin respuesta · 3 días' },
  { clave: 'presupuestoPorVencer', etiqueta: 'Presupuesto por vencer · 3 y 1 día antes' },
  { clave: 'presupuestoVencido', etiqueta: 'Presupuesto vencido · 1 día después' },
  { clave: 'cuotasPendientes', etiqueta: 'Cuotas pendientes · 1 día antes' },
]

const campoClase = 'w-full rounded-lg border border-surface bg-surface px-3 py-2 text-xs disabled:opacity-60'
const etiquetaClase = 'block text-xs font-semibold text-graphite-700 dark:text-graphite-200'

export const ConfiguracionFinancieraManager: React.FC = () => {
  const { configuracion, cargando, cargada, guardando, error, esAdmin, guardar } = useConfiguracionFinanciera()
  const [borrador, setBorrador] = useState<ConfiguracionFinanciera>(configuracion)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (cargada && !error) setBorrador(configuracion)
  }, [configuracion, cargada, error])

  const actualizar = <K extends keyof ConfiguracionFinanciera>(clave: K, valor: ConfiguracionFinanciera[K]): void => {
    setBorrador((actual) => ({ ...actual, [clave]: valor }))
    setMensaje(null)
  }

  const guardarCambios = async (): Promise<void> => {
    const ok = await guardar(borrador)
    setMensaje(ok ? 'Configuración financiera compartida guardada.' : 'No se guardaron los cambios.')
  }

  const cambiarMetodo = (metodo: (typeof METODOS_PAGO_CLINICA)[number], seleccionado: boolean): void => {
    const nuevos = seleccionado
      ? [...borrador.mediosPagoAceptados, metodo]
      : borrador.mediosPagoAceptados.filter((item) => item !== metodo)
    actualizar('mediosPagoAceptados', [...new Set(nuevos)])
  }

  const cambiarRecordatorio = (
    clave: keyof ConfiguracionFinanciera['recordatorios'],
    valor: boolean
  ): void => {
    setBorrador((actual) => ({
      ...actual,
      recordatorios: { ...actual.recordatorios, [clave]: valor },
    }))
    setMensaje(null)
  }

  return (
    <section className="rounded-2xl border border-surface bg-surface p-5 shadow-xs" aria-labelledby="configuracion-financiera-title">
      <header className="mb-5 border-b border-surface pb-3">
        <h2 id="configuracion-financiera-title" className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-50">
          <Settings size={16} /> Configuración financiera compartida
        </h2>
        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
          Se guarda en la clínica y se aplica a presupuestos nuevos. Los presupuestos existentes conservan sus condiciones.
        </p>
      </header>

      {cargando && <p role="status" className="text-xs text-graphite-500">Cargando configuración financiera…</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {!cargando && !error && (
        <fieldset disabled={!esAdmin || guardando} className="space-y-6 disabled:opacity-80">
          {!esAdmin && (
            <p className="rounded-lg bg-surface-muted p-3 text-xs text-graphite-600 dark:text-graphite-300">
              Puedes consultar esta configuración. Solo un administrador de la clínica puede cambiarla.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={etiquetaClase}>
              Validez por defecto (días)
              <input className={`${campoClase} mt-1`} type="number" min="1" max="90" value={borrador.validezPresupuestoDias} onChange={(event) => actualizar('validezPresupuestoDias', Number(event.target.value))} />
            </label>
            <label className={etiquetaClase}>
              Máximo de cuotas sin interés
              <input className={`${campoClase} mt-1`} type="number" min="1" max="12" value={borrador.maximoCuotasSinInteres} onChange={(event) => actualizar('maximoCuotasSinInteres', Number(event.target.value))} />
            </label>
            <label className={etiquetaClase}>
              Frecuencia predeterminada
              <select className={`${campoClase} mt-1`} value={borrador.frecuenciaCuotas} onChange={(event) => actualizar('frecuenciaCuotas', event.target.value as ConfiguracionFinanciera['frecuenciaCuotas'])}>
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
              </select>
            </label>
            <label className={etiquetaClase}>
              Descuento manual máximo (%)
              <input className={`${campoClase} mt-1`} type="number" min="0" max="100" step="0.1" value={borrador.descuentoMaximoPermitidoPct} onChange={(event) => actualizar('descuentoMaximoPermitidoPct', Number(event.target.value))} />
            </label>
            <label className={etiquetaClase}>
              Abono mínimo para aprobar (%)
              <input className={`${campoClase} mt-1`} type="number" min="0" max="100" step="0.1" value={borrador.abonoMinimoParaAprobarPct} disabled onChange={(event) => actualizar('abonoMinimoParaAprobarPct', Number(event.target.value))} />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-surface p-3 text-xs">
              <input type="checkbox" checked={borrador.requiereMotivoDescuento} onChange={(event) => actualizar('requiereMotivoDescuento', event.target.checked)} />
              Requerir motivo al aplicar un descuento manual
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-surface p-3 text-xs">
              <input type="checkbox" checked={borrador.firmaObligatoriaPresupuesto} disabled onChange={(event) => actualizar('firmaObligatoriaPresupuesto', event.target.checked)} />
              Firma obligatoria en presupuestos
            </label>
          </div>
          <p className="-mt-4 text-[11px] text-graphite-500">Firma y abono mínimo se habilitarán cuando exista el flujo de firma y la validación transaccional de aprobación.</p>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-graphite-800 dark:text-graphite-100">Medios de pago aceptados</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {METODOS_PAGO_CLINICA.map((metodo) => (
                <label key={metodo} className="flex items-center gap-2 rounded-lg border border-surface p-3 text-xs">
                  <input type="checkbox" checked={borrador.mediosPagoAceptados.includes(metodo)} disabled onChange={(event) => cambiarMetodo(metodo, event.target.checked)} />
                  {ETIQUETAS_METODO[metodo]}
                </label>
              ))}
            </div>
            {borrador.mediosPagoAceptados.length === 0 && <p role="alert" className="text-xs text-rose-600">Debe quedar al menos un medio de pago aceptado.</p>}
            <p className="text-[11px] text-graphite-500">Los medios configurados se mantienen en “Todos” hasta aplicar la restricción también al registro de pagos.</p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-graphite-800 dark:text-graphite-100">Recordatorios de presupuesto y cuotas</legend>
            <label className="flex items-center gap-2 rounded-lg border border-surface p-3 text-xs">
              <input type="checkbox" checked={borrador.recordatorios.activados} disabled onChange={(event) => cambiarRecordatorio('activados', event.target.checked)} />
              Activar recordatorios automáticos
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ETIQUETAS_RECORDATORIO.map(({ clave, etiqueta }) => (
                <label key={clave} className="flex items-center gap-2 rounded-lg border border-surface p-3 text-xs">
                  <input type="checkbox" checked={borrador.recordatorios[clave]} disabled onChange={(event) => cambiarRecordatorio(clave, event.target.checked)} />
                  {etiqueta}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-graphite-500">Los recordatorios están definidos según el Blueprint, pero aún no se envían automáticamente.</p>
          </fieldset>

          {mensaje && <p role="status" className="text-xs text-graphite-600">{mensaje}</p>}
          {esAdmin && (
            <div className="flex justify-end border-t border-surface pt-3">
              <button type="button" onClick={() => void guardarCambios()} disabled={guardando || borrador.mediosPagoAceptados.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60">
                <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar configuración financiera'}
              </button>
            </div>
          )}
        </fieldset>
      )}
    </section>
  )
}
