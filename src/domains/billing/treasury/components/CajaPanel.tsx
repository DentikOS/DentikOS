import React, { useMemo, useState } from 'react'
import type { TreasuryPanelProps } from './types'
import { dateOnlySantiago, formatearMenor, montoMenorDesdeTexto, numero, texto } from './types'

const DENOMINACIONES_PESOS = [20_000, 10_000, 5_000, 2_000, 1_000, 500, 100, 50, 10] as const

export const CajaPanel: React.FC<TreasuryPanelProps> = ({ snapshot, acciones, online, loading }) => {
  const [apertura, setApertura] = useState('0')
  const [conteo, setConteo] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const hoy = dateOnlySantiago()
  const sesiones = snapshot?.cajaSesiones || []
  const movimientos = snapshot?.cajaMovimientos || []
  const sesionHoy = sesiones.find((row) => row.fecha_operacion === hoy && row.moneda === 'CLP' && row.estado === 'abierta')
  const yaOperadaHoy = sesiones.some((row) => row.fecha_operacion === hoy && row.moneda === 'CLP')
  const movimientosSesion = movimientos.filter((row) => row.caja_sesion_id === sesionHoy?.id)
  const esperado = useMemo(() => {
    if (!sesionHoy) return 0
    const porId = new Map(movimientosSesion.map((row) => [String(row.id), row]))
    return movimientosSesion.reduce((total, row) => {
      const monto = numero(row.monto_minor)
      if (row.tipo === 'ingreso') return total + monto
      if (row.tipo === 'egreso') return total - monto
      if (row.tipo === 'reversion') {
        const original = porId.get(String(row.reversion_de_movimiento_id))
        if (original?.tipo === 'ingreso') return total - monto
        if (original?.tipo === 'egreso') return total + monto
      }
      return total
    }, numero(sesionHoy.monto_apertura_minor))
  }, [sesionHoy, movimientosSesion])
  const contado = DENOMINACIONES_PESOS.reduce((sum, pesos) => sum + pesos * 100 * numero(conteo[String(pesos)]), 0)

  const handleAbrir = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)
    try {
      setGuardando(true)
      await acciones.abrirCaja('CLP', montoMenorDesdeTexto(apertura))
      setApertura('0')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir la caja.')
    } finally { setGuardando(false) }
  }

  const handleCerrar = async (): Promise<void> => {
    setError(null)
    try {
      const lineas = DENOMINACIONES_PESOS.map((pesos) => ({ valorMinor: pesos * 100, cantidad: Number(conteo[String(pesos)] || 0) }))
        .filter((linea) => linea.cantidad > 0)
      setGuardando(true)
      await acciones.cerrarCaja(String(sesionHoy?.id), lineas, motivo)
      setConteo({})
      setMotivo('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la caja.')
    } finally { setGuardando(false) }
  }

  return <section className="space-y-4" aria-labelledby="bp15-caja-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="bp15-caja-title" className="text-lg font-bold">Caja</h2><p className="text-sm text-secondary">Caja única en CLP · operación del {hoy}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${online ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{online ? 'Conectado' : 'Solo lectura offline'}</span>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    {!sesionHoy && <form onSubmit={(event) => void handleAbrir(event)} className="flex flex-wrap items-end gap-3 rounded-2xl border border-surface bg-surface p-4">
      <label className="space-y-1 text-sm font-medium">Monto de apertura (CLP)
        <input type="number" min="0" step="1" value={apertura} onChange={(event) => setApertura(event.target.value)} className="block w-48 rounded-lg border border-surface bg-canvas px-3 py-2" required />
      </label>
      <button type="submit" disabled={!online || loading || guardando || yaOperadaHoy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Abrir caja</button>
      {yaOperadaHoy && <p className="text-sm text-secondary">La sesión de CLP de hoy ya está cerrada. No se permite reabrirla.</p>}
    </form>}

    {sesionHoy && <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <div className="rounded-2xl border border-surface bg-surface p-4">
        <h3 className="font-semibold">Sesión abierta</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <dt className="text-secondary">Apertura</dt><dd className="text-right font-semibold">{formatearMenor(numero(sesionHoy.monto_apertura_minor), 'CLP')}</dd>
          <dt className="text-secondary">Ingresos y egresos</dt><dd className="text-right font-semibold">{formatearMenor(esperado - numero(sesionHoy.monto_apertura_minor), 'CLP')}</dd>
          <dt className="text-secondary">Saldo esperado</dt><dd className="text-right text-lg font-bold">{formatearMenor(esperado, 'CLP')}</dd>
        </dl>
        <p className="mt-4 text-xs text-secondary">Los pagos en efectivo se incorporan solo después de que BP07 los confirma en el servidor.</p>
      </div>
      <div className="rounded-2xl border border-surface bg-surface p-4">
        <h3 className="font-semibold">Arqueo físico</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DENOMINACIONES_PESOS.map((pesos) => <label key={pesos} className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-2 py-1.5 text-xs">
            <span>{formatearMenor(pesos * 100, 'CLP')}</span>
            <input aria-label={`Cantidad ${pesos}`} type="number" min="0" step="1" value={conteo[String(pesos)] || ''}
              onChange={(event) => setConteo((current) => ({ ...current, [String(pesos)]: event.target.value }))}
              className="w-16 rounded border border-surface bg-surface px-2 py-1 text-right" />
          </label>)}
        </div>
        <p className="mt-3 text-right text-sm">Contado: <strong>{formatearMenor(contado, 'CLP')}</strong> · Diferencia: <strong>{formatearMenor(contado - esperado, 'CLP')}</strong></p>
        <label className="mt-3 block space-y-1 text-sm font-medium">Motivo de diferencia (requerido sobre $5.000)
          <textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={500} rows={2} className="block w-full rounded-lg border border-surface bg-canvas px-3 py-2" />
        </label>
        <button type="button" onClick={() => void handleCerrar()} disabled={!online || loading || guardando || contado === 0}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Confirmar cierre</button>
      </div>
    </div>}

    <div className="rounded-2xl border border-surface bg-surface p-4">
      <h3 className="mb-3 font-semibold">Movimientos de la sesión</h3>
      {sesionHoy && movimientosSesion.length > 0 ? <div className="space-y-2">{movimientosSesion.map((row) => <div key={String(row.id)} className="flex justify-between gap-3 border-b border-surface py-2 text-sm">
        <span>{texto(row.tipo)} · {texto(row.origen_tipo)}</span><span>{formatearMenor(numero(row.monto_minor), String(row.moneda || 'CLP'))}</span>
      </div>)}</div> : <p className="text-sm text-secondary">Sin movimientos confirmados en esta sesión.</p>}
    </div>

    <div className="rounded-2xl border border-surface bg-surface p-4">
      <h3 className="mb-3 font-semibold">Sesiones recientes</h3>
      {sesiones.length ? <div className="space-y-2">{sesiones.slice(0, 10).map((row) => <div key={String(row.id)} className="flex flex-wrap justify-between gap-2 border-b border-surface py-2 text-sm">
        <span>{String(row.fecha_operacion)} · {String(row.moneda)} · {String(row.estado)}</span>
        <span>{formatearMenor(numero(row.estado === 'cerrada' ? row.monto_contado_minor : row.monto_apertura_minor), String(row.moneda || 'CLP'))}</span>
      </div>)}</div> : <p className="text-sm text-secondary">Todavía no hay sesiones de caja.</p>}
    </div>
  </section>
}
