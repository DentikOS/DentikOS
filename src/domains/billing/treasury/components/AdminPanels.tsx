import React, { useMemo, useState } from 'react'
import type { TreasuryPanelProps } from './types'
import { dateOnlySantiago, formatearMenor, montoMenorDesdeTexto, numero, texto } from './types'
import { adaptarCarteraBp07 } from '../utils/carteraBp07Adapter'
import { resumirVentasInternas } from '../utils/librosCalculations'
import { proyectarFlujoCaja, type EscenarioFlujo } from '../utils/flujoCajaCalculations'

const ESCENARIOS: readonly EscenarioFlujo[] = ['optimista', 'realista', 'pesimista']

export const CarteraPanel: React.FC<TreasuryPanelProps> = ({ snapshot }) => {
  const { result, error } = useMemo(() => {
    if (!snapshot) return { result: [], error: null }
    try {
      return { result: adaptarCarteraBp07({ fechaCorte: dateOnlySantiago(), presupuestos: snapshot.presupuestos,
        pagos: snapshot.pagos, pacientes: snapshot.pacientes }), error: null }
    } catch (cause) {
      return { result: [], error: cause instanceof Error ? cause.message : 'No se pudo calcular la cartera.' }
    }
  }, [snapshot])
  const porMoneda = new Map<string, number>()
  for (const row of result) porMoneda.set(row.moneda, (porMoneda.get(row.moneda) || 0) + row.saldoMinor)
  return <section className="space-y-4">
    <div><h2 className="text-lg font-bold">Cartera por cobrar</h2><p className="text-sm text-secondary">Solo presupuestos aprobados o en tratamiento. Los pagos anulados se excluyen.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[...porMoneda.entries()].map(([currency, total]) => <div key={currency} className="rounded-xl border border-surface bg-surface p-4"><p className="text-xs text-secondary">Saldo por cobrar · {currency}</p><p className="mt-1 text-xl font-bold">{formatearMenor(total, currency)}</p></div>)}</div>
    <div className="overflow-x-auto rounded-2xl border border-surface bg-surface">
      <table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-secondary"><tr><th className="px-3 py-3">Presupuesto</th><th className="px-3 py-3">Paciente</th><th className="px-3 py-3">Saldo</th><th className="px-3 py-3">0–30</th><th className="px-3 py-3">31–60</th><th className="px-3 py-3">61–90</th><th className="px-3 py-3">+90</th><th className="px-3 py-3">Sin fecha</th></tr></thead>
        <tbody className="divide-y divide-surface">{result.map((row) => {
          const bands = row.antiguedad.porMoneda[row.moneda]
          return <tr key={row.presupuestoId}><td className="px-3 py-3">{row.folio}</td><td className="px-3 py-3">{row.paciente}</td><td className="px-3 py-3 font-semibold">{formatearMenor(row.saldoMinor, row.moneda)}</td><td className="px-3 py-3">{formatearMenor(bands.dias0a30Menor, row.moneda)}</td><td className="px-3 py-3">{formatearMenor(bands.dias31a60Menor, row.moneda)}</td><td className="px-3 py-3">{formatearMenor(bands.dias61a90Menor, row.moneda)}</td><td className="px-3 py-3">{formatearMenor(bands.masDe90Menor, row.moneda)}</td><td className="px-3 py-3">{formatearMenor(bands.sinFechaMenor, row.moneda)}{!row.agingVerificable && <span className="ml-1 text-xs text-amber-700">· sin imputación a cuota</span>}</td></tr>
        })}</tbody></table>
    </div>
    {!result.length && !error && <p className="rounded-xl border border-surface bg-surface p-4 text-sm text-secondary">No hay saldos pendientes con los datos sincronizados.</p>}
    <p className="text-xs text-secondary">La antigüedad por cuota solo se calcula cuando BP07 identifica la cuota pagada. Los abonos sin vínculo se muestran en “Sin fecha”; no se asignan automáticamente.</p>
  </section>
}

export const GastosPanel: React.FC<TreasuryPanelProps> = ({ snapshot, acciones, online, loading }) => {
  const [fecha, setFecha] = useState(dateOnlySantiago())
  const [categoria, setCategoria] = useState('Operación clínica')
  const [proveedor, setProveedor] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [moneda, setMoneda] = useState('CLP')
  const [neto, setNeto] = useState('0')
  const [iva, setIva] = useState('0')
  const [exento, setExento] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const expenses = snapshot?.gastos || []

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setError(null)
    try {
      const netoMinor = montoMenorDesdeTexto(neto)
      const ivaMinor = montoMenorDesdeTexto(iva)
      const exentoMinor = montoMenorDesdeTexto(exento)
      const totalMinor = netoMinor + ivaMinor + exentoMinor
      if (totalMinor <= 0 || !Number.isSafeInteger(totalMinor)) throw new Error('El gasto debe tener un total mayor que cero.')
      setBusy(true)
      await acciones.guardarGasto({ fecha_emision: fecha, categoria, proveedor_nombre: proveedor, descripcion,
        moneda, neto_minor: netoMinor, iva_minor: ivaMinor, exento_minor: exentoMinor, total_minor: totalMinor,
        iva_recuperable: ivaMinor > 0, estado: 'pendiente' })
      setProveedor(''); setDescripcion(''); setNeto('0'); setIva('0'); setExento('0')
    } catch (cause) { setError(msg(cause)) } finally { setBusy(false) }
  }

  const pagar = async (id: string): Promise<void> => {
    setError(null)
    try { setBusy(true); await acciones.pagarGasto(id, dateOnlySantiago(), 'transferencia') }
    catch (cause) { setError(msg(cause)) } finally { setBusy(false) }
  }
  const adjuntar = async (id: string, file: File): Promise<void> => {
    setError(null)
    try { setBusy(true); await acciones.subirDocumentoGasto({ gastoId: id, file }) }
    catch (cause) { setError(msg(cause)) } finally { setBusy(false) }
  }
  const descargar = async (id: string): Promise<void> => {
    setError(null)
    try { setBusy(true); await acciones.descargarDocumentoGasto(id) }
    catch (cause) { setError(msg(cause)) } finally { setBusy(false) }
  }
  const agrupado = new Map<string, number>()
  for (const expense of expenses) {
    const key = `${String(expense.categoria)} · ${String(expense.moneda)}`
    agrupado.set(key, (agrupado.get(key) || 0) + numero(expense.total_minor))
  }

  return <section className="space-y-4">
    <div><h2 className="text-lg font-bold">Gastos y compras registrados</h2><p className="text-sm text-secondary">El desglose de IVA refleja lo ingresado por administración y requiere revisión contable.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-2xl border border-surface bg-surface p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-medium">Fecha de emisión<input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Categoría<input required maxLength={80} value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Proveedor<input required maxLength={180} value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Moneda<select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm"><option>CLP</option><option>USD</option><option>EUR</option></select></label>
      <label className="text-xs font-medium">Descripción<input required maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Neto<input required inputMode="decimal" value={neto} onChange={(e) => setNeto(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">IVA ingresado<input required inputMode="decimal" value={iva} onChange={(e) => setIva(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Exento ingresado<input required inputMode="decimal" value={exento} onChange={(e) => setExento(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <div className="sm:col-span-2 xl:col-span-4"><p className="mb-2 text-xs text-secondary">Total calculado: {formatearMenor(totalExpense(neto, iva, exento), moneda)} · Sin clasificación automática de impuestos.</p><button disabled={!online || loading || busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Registrar gasto pendiente</button></div>
    </form>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[...agrupado.entries()].map(([key, total]) => <div key={key} className="rounded-xl border border-surface bg-surface p-3"><p className="text-xs text-secondary">{key}</p><strong>{formatearMenor(total, key.split(' · ').pop() || 'CLP')}</strong></div>)}</div>
    <div className="overflow-x-auto rounded-2xl border border-surface bg-surface"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-secondary"><tr><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Proveedor</th><th className="px-3 py-3">Categoría</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Respaldo</th><th className="px-3 py-3">Acción</th></tr></thead><tbody className="divide-y divide-surface">{expenses.map((row) => {
      const documentos = (snapshot?.documentosGasto || []).filter((doc) => doc.gasto_id === row.id && !doc.eliminado_at)
      return <tr key={String(row.id)}><td className="px-3 py-3">{String(row.fecha_emision)}</td><td className="px-3 py-3">{String(row.proveedor_nombre)}</td><td className="px-3 py-3">{String(row.categoria)}</td><td className="px-3 py-3">{formatearMenor(numero(row.total_minor), String(row.moneda))}</td><td className="px-3 py-3">{String(row.estado)}</td><td className="px-3 py-3"><div className="space-y-2">{documentos.map((doc) => <button key={String(doc.id)} type="button" onClick={() => void descargar(String(doc.id))} disabled={!online || busy} className="block text-xs underline">Descargar {String(doc.mime_type)}</button>)}{row.estado !== 'anulado' && <label className="block cursor-pointer text-xs font-semibold text-primary">Adjuntar respaldo<input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,application/xml,text/xml,image/jpeg,image/png" disabled={!online || busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void adjuntar(String(row.id), file); event.currentTarget.value = '' }} className="sr-only" /></label>}</div></td><td className="px-3 py-3">{row.estado === 'pendiente' && <button type="button" onClick={() => void pagar(String(row.id))} disabled={!online || busy} className="rounded-lg border border-surface px-2 py-1 text-xs font-semibold disabled:opacity-50">Pagar por transferencia</button>}</td></tr>
    })}</tbody></table></div>
  </section>
}

export const BonosPanel: React.FC<TreasuryPanelProps> = ({ snapshot, acciones, online, loading }) => {
  const [numeroBono, setNumeroBono] = useState('')
  const [prevision, setPrevision] = useState('FONASA')
  const [pacienteId, setPacienteId] = useState('')
  const [moneda, setMoneda] = useState('CLP')
  const [total, setTotal] = useState('')
  const [aporte, setAporte] = useState('')
  const [copago, setCopago] = useState('')
  const [fechaEmision, setFechaEmision] = useState(dateOnlySantiago())
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const bonos = snapshot?.bonos || []

  const crear = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setError(null)
    try {
      const totalMinor = montoMenorDesdeTexto(total), aporteMinor = montoMenorDesdeTexto(aporte), copagoMinor = montoMenorDesdeTexto(copago)
      if (totalMinor !== aporteMinor + copagoMinor || totalMinor <= 0) throw new Error('Total debe ser aporte más copago y mayor que cero.')
      setBusy(true)
      await acciones.guardarBono({ numero_bono: numeroBono, prevision, paciente_id: pacienteId || null,
        moneda, monto_total_minor: totalMinor, aporte_minor: aporteMinor, copago_minor: copagoMinor,
        fecha_emision: fechaEmision || null, fecha_vencimiento: fechaVencimiento || null })
      setNumeroBono(''); setTotal(''); setAporte(''); setCopago('')
    } catch (cause) { setError(msg(cause)) } finally { setBusy(false) }
  }

  const liquidar = async (bono: Record<string, unknown>): Promise<void> => {
    const rawAmount = window.prompt(`Monto recibido de ${String(bono.numero_bono)} (pesos):`)
    if (!rawAmount) return
    try {
      setBusy(true)
      await acciones.liquidarBono({ bonoId: String(bono.id), montoMinor: montoMenorDesdeTexto(rawAmount),
        moneda: String(bono.moneda), fecha: dateOnlySantiago(), metodoPago: 'transferencia' })
      setError(null)
    } catch (cause) { setError(msg(cause)) } finally { setBusy(false) }
  }

  const saldoAporte = (bono: Record<string, unknown>): number => Math.max(0, numero(bono.aporte_minor) - (snapshot?.liquidacionesBono || []).filter((row) => row.bono_id === bono.id && row.estado === 'confirmada').reduce((sum, row) => sum + numero(row.monto_minor), 0))
  return <section className="space-y-4">
    <div><h2 className="text-lg font-bold">Bonos FONASA / Isapre</h2><p className="text-sm text-secondary">Registro manual del bono emitido en el portal de la previsión y sus liquidaciones.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    <form onSubmit={(event) => void crear(event)} className="grid gap-3 rounded-2xl border border-surface bg-surface p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-medium">Número de bono<input required maxLength={80} value={numeroBono} onChange={(e) => setNumeroBono(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Previsión<input required maxLength={80} value={prevision} onChange={(e) => setPrevision(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Paciente (opcional)<select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm"><option value="">Sin vincular</option>{(snapshot?.pacientes || []).map((patient) => <option key={String(patient.id)} value={String(patient.id)}>{String(patient.nombre)}</option>)}</select></label>
      <label className="text-xs font-medium">Moneda<select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm"><option>CLP</option><option>USD</option><option>EUR</option></select></label>
      <label className="text-xs font-medium">Total<input required inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Aporte previsión<input required inputMode="decimal" value={aporte} onChange={(e) => setAporte(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Copago<input required inputMode="decimal" value={copago} onChange={(e) => setCopago(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Vence aporte previsión<input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <div className="sm:col-span-2 xl:col-span-4"><button disabled={!online || loading || busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Registrar bono</button></div>
    </form>
    <div className="space-y-2">{bonos.map((bono) => <article key={String(bono.id)} className="rounded-2xl border border-surface bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{String(bono.numero_bono)} · {String(bono.prevision)}</p><p className="text-xs text-secondary">{String(bono.fecha_emision || 'Fecha no informada')} · {String(bono.estado)}</p></div><p className="text-sm">Pendiente: <strong>{formatearMenor(saldoAporte(bono), String(bono.moneda))}</strong></p></div>{saldoAporte(bono) > 0 && <button type="button" onClick={() => void liquidar(bono)} disabled={!online || busy} className="mt-3 rounded-lg border border-surface px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Registrar liquidación parcial</button>}</article>)}</div>
    {!bonos.length && <p className="text-sm text-secondary">No hay bonos registrados.</p>}
  </section>
}

export const LibrosPanel: React.FC<TreasuryPanelProps> = ({ snapshot }) => {
  const pagos = snapshot?.pagos || []
  const ventas = pagos.map((row) => ({
    id: String(row.id), montoMenor: Math.max(0, numero(row.monto) * 100), moneda: String(row.moneda || 'CLP'),
    estado: row.fecha_anulacion || row.motivo_anulacion ? 'anulado' as const : 'confirmado' as const,
    tipoDTE: typeof row.tipoDTE === 'string' ? row.tipoDTE : null,
    folioDTE: typeof row.folioDTE === 'string' ? row.folioDTE : null
  }))
  const resumen = resumirVentasInternas(ventas)
  const compras = snapshot?.gastos || []
  const purchaseTotal = new Map<string, number>()
  for (const row of compras) {
    if (row.estado === 'anulado') continue
    const currency = String(row.moneda)
    purchaseTotal.set(currency, (purchaseTotal.get(currency) || 0) + numero(row.total_minor))
  }
  return <section className="space-y-4">
    <div><h2 className="text-lg font-bold">Libros internos</h2><p className="text-sm text-secondary">Vista de ventas BP07 y compras registradas en BP15.</p></div>
    <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Información interna para revisión. No es un libro legal ni una declaración SII; los DTE no están verificados por una fuente externa.</div>
    <div className="grid gap-3 sm:grid-cols-2">{Object.entries(resumen.porMoneda).map(([currency, row]) => <article key={`ventas-${currency}`} className="rounded-xl border border-surface bg-surface p-4"><h3 className="font-semibold">Ventas capturadas · {currency}</h3><p className="mt-2 text-xl font-bold">{formatearMenor(row.totalMenor, currency)}</p><p className="text-xs text-secondary">{row.pagosConfirmados} pagos · {row.documentosDteFaltantes} con DTE/folio faltantes o no verificados</p></article>)}{[...purchaseTotal.entries()].map(([currency, total]) => <article key={`gastos-${currency}`} className="rounded-xl border border-surface bg-surface p-4"><h3 className="font-semibold">Compras/gastos registrados · {currency}</h3><p className="mt-2 text-xl font-bold">{formatearMenor(total, currency)}</p><p className="text-xs text-secondary">Importes ingresados por administración; no determina crédito tributario.</p></article>)}</div>
    <div className="overflow-x-auto rounded-2xl border border-surface bg-surface"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase text-secondary"><tr><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Comprobante</th><th className="px-3 py-3">Medio</th><th className="px-3 py-3">Moneda / monto</th><th className="px-3 py-3">Documento informado</th></tr></thead><tbody className="divide-y divide-surface">{pagos.slice(0, 100).map((row) => <tr key={String(row.id)}><td className="px-3 py-3">{String(row.fecha || '—')}</td><td className="px-3 py-3">{String(row.folio || row.id)}</td><td className="px-3 py-3">{String(row.metodo_pago || '—')}</td><td className="px-3 py-3">{formatearMenor(numero(row.monto) * 100, String(row.moneda || 'CLP'))}</td><td className="px-3 py-3">{row.tipoDTE && row.folioDTE ? `Declarado: ${String(row.tipoDTE)} ${String(row.folioDTE)} · no verificado` : 'No informado / no disponible en BP07'}</td></tr>)}</tbody></table></div>
  </section>
}

export const FlujoPanel: React.FC<TreasuryPanelProps> = ({ snapshot, acciones, online, loading }) => {
  const [moneda, setMoneda] = useState('CLP')
  const [horizonte, setHorizonte] = useState('90')
  const [tasas, setTasas] = useState<Record<EscenarioFlujo, string>>({ optimista: '', realista: '', pesimista: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const parametros = snapshot?.parametrosProyeccion || []
  const currentParams = ESCENARIOS.map((scenario) => parametros.find((row) => row.escenario === scenario && row.moneda === moneda))
  const cashSession = (snapshot?.cajaSesiones || []).slice().sort((a, b) => String(b.fecha_operacion).localeCompare(String(a.fecha_operacion)))[0]
  const saldoInicial = cashSession ? numero(cashSession.estado === 'cerrada' ? cashSession.monto_contado_minor : cashSession.monto_apertura_minor) : null
  const desde = dateOnlySantiago()
  const horizonteN = Number(horizonte)
  const hasta = Number.isSafeInteger(horizonteN) && horizonteN > 0
    ? new Date(Date.parse(`${desde}T00:00:00Z`) + horizonteN * 86_400_000).toISOString().slice(0, 10) : desde
  const bonosIncome = (snapshot?.bonos || []).map((row) => ({ id: String(row.id), tipo: 'bono' as const,
    montoMenor: Math.max(0, numero(row.aporte_minor) - (snapshot?.liquidacionesBono || []).filter((l) => l.bono_id === row.id && l.estado === 'confirmada').reduce((sum, l) => sum + numero(l.monto_minor), 0)),
    moneda: String(row.moneda), fecha: typeof row.fecha_vencimiento === 'string' ? row.fecha_vencimiento : null }))
    .filter((row) => row.montoMenor > 0)
  const noScheduledExpenses = (snapshot?.gastos || []).filter((row) => row.estado === 'pendiente').map((row) => ({
    id: String(row.id), montoMenor: numero(row.total_minor), moneda: String(row.moneda), fechaProgramada: null
  }))
  const rates = Object.fromEntries(ESCENARIOS.map((scenario) => {
    const saved = currentParams.find((row) => row?.escenario === scenario)
    const raw = tasas[scenario] !== '' ? Number(tasas[scenario]) : saved ? numero(saved.tasa_cobranza_bps) / 100 : Number.NaN
    return [scenario, Number.isFinite(raw) ? Math.round(raw * 100) : undefined]
  })) as Partial<Record<EscenarioFlujo, number>>
  const projection = saldoInicial !== null && ESCENARIOS.every((scenario) => rates[scenario] !== undefined)
    ? proyectarFlujoCaja({ moneda, saldoInicialMenor: saldoInicial, desde, hasta,
      tasasCobranzaPuntosBase: rates,
      ingresos: bonosIncome,
      gastos: noScheduledExpenses
    }) : null

  const saveParams = async (): Promise<void> => {
    setError(null)
    try {
      setBusy(true)
      const parsed = Object.fromEntries(ESCENARIOS.map((scenario) => {
        const value = Number(tasas[scenario])
        if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Ingresa una tasa de 0 a 100 para ${scenario}.`)
        return [scenario, Math.round(value * 100)]
      })) as Record<EscenarioFlujo, number>
      await Promise.all(ESCENARIOS.map((scenario) => acciones.guardarParametros({ moneda, escenario: scenario, tasaBps: parsed[scenario], horizonteDias: Number(horizonte) })))
    } catch (cause) { setError(msg(cause)) } finally { setBusy(false) }
  }
  return <section className="space-y-4">
    <div><h2 className="text-lg font-bold">Flujo de caja proyectado</h2><p className="text-sm text-secondary">Escenarios con tasas explícitas y saldos conocidos. Sin tipo de cambio automático.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    <div className="rounded-2xl border border-surface bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-4"><label className="text-xs font-medium">Moneda<select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm"><option>CLP</option><option>USD</option><option>EUR</option></select></label><label className="text-xs font-medium">Horizonte (días)<input type="number" min="1" max="3650" value={horizonte} onChange={(e) => setHorizonte(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>{ESCENARIOS.map((scenario) => <label key={scenario} className="text-xs font-medium">Tasa {scenario} (%)<input type="number" min="0" max="100" step="0.1" placeholder={currentParams.find((row) => row?.escenario === scenario) ? String(numero(currentParams.find((row) => row?.escenario === scenario)?.tasa_cobranza_bps) / 100) : ''} value={tasas[scenario]} onChange={(e) => setTasas((current) => ({ ...current, [scenario]: e.target.value }))} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>)}</div>
      <button type="button" onClick={() => void saveParams()} disabled={!online || loading || busy} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Guardar escenarios</button>
    </div>
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Saldo base visible: {saldoInicial === null ? 'no hay sesión de caja registrada' : formatearMenor(saldoInicial, String(cashSession?.moneda || moneda))}. Incluye solo la caja en efectivo, no el saldo de cuentas bancarias.</div>
    {projection ? <div className="grid gap-3 md:grid-cols-3">{ESCENARIOS.map((scenario) => { const row = projection.porEscenario[scenario]; return <article key={scenario} className="rounded-2xl border border-surface bg-surface p-4"><h3 className="font-semibold capitalize">{scenario}</h3><p className="mt-2 text-xl font-bold">{row.saldoFinalMenor === null ? 'Insuficiente' : formatearMenor(row.saldoFinalMenor, moneda)}</p><p className="text-xs text-secondary">{row.estado === 'completo' ? 'Proyección calculada' : 'Faltan fechas o datos para cerrar la proyección'}</p></article> })}</div> : <p className="rounded-xl border border-surface bg-surface p-4 text-sm text-secondary">Completa tasas y saldo base para calcular el escenario. La proyección queda insuficiente si hay ingresos/gastos sin fecha.</p>}
    {projection?.datosExcluidos.length ? <p className="text-xs text-secondary">Filas excluidas por fecha/moneda: {projection.datosExcluidos.length}. No se convierten monedas ni se asignan vencimientos supuestos.</p> : null}
  </section>
}

export const ReportesPanel: React.FC<TreasuryPanelProps> = ({ snapshot }) => {
  const nowMonth = dateOnlySantiago().slice(0, 7)
  const payments = (snapshot?.pagos || []).filter((row) => !row.fecha_anulacion && !row.motivo_anulacion && String(row.fecha || '').slice(0, 7) === nowMonth)
  const expenses = (snapshot?.gastos || []).filter((row) => row.estado !== 'anulado' && String(row.fecha_emision || '').slice(0, 7) === nowMonth)
  const sumByCurrency = (rows: readonly Record<string, unknown>[], getAmount: (row: Record<string, unknown>) => number): Map<string, number> => {
    const result = new Map<string, number>()
    rows.forEach((row) => { const currency = String(row.moneda || ''); result.set(currency, (result.get(currency) || 0) + getAmount(row)) })
    return result
  }
  const income = sumByCurrency(payments, (row) => numero(row.monto) * 100)
  const costs = sumByCurrency(expenses, (row) => numero(row.total_minor))
  const unreconciled = (snapshot?.extractoFilas || []).filter((row) => !(snapshot?.conciliaciones || []).some((match) => match.estado === 'conciliada' && match.extracto_fila_id === row.id)).length
  return <section className="space-y-4">
    <div><h2 className="text-lg font-bold">Reportes financieros CORE</h2><p className="text-sm text-secondary">Totales de fuentes registradas en {nowMonth}, separados por moneda.</p></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[...new Set([...income.keys(), ...costs.keys()])].map((currency) => <article key={currency} className="rounded-2xl border border-surface bg-surface p-4"><h3 className="font-semibold">{currency}</h3><p className="mt-2 text-xs text-secondary">Ingresos BP07</p><p className="font-bold">{formatearMenor(income.get(currency) || 0, currency)}</p><p className="mt-2 text-xs text-secondary">Gastos BP15</p><p className="font-bold">{formatearMenor(costs.get(currency) || 0, currency)}</p></article>)}</div>
    <div className="grid gap-3 sm:grid-cols-3"><article className="rounded-xl border border-surface bg-surface p-4"><p className="text-xs text-secondary">Pagos del mes</p><strong>{payments.length}</strong></article><article className="rounded-xl border border-surface bg-surface p-4"><p className="text-xs text-secondary">Gastos del mes</p><strong>{expenses.length}</strong></article><article className="rounded-xl border border-surface bg-surface p-4"><p className="text-xs text-secondary">Filas bancarias sin conciliar</p><strong>{unreconciled}</strong></article></div>
    <p className="text-xs text-secondary">Informe operativo interno. No calcula utilidad, rentabilidad, IVA por régimen ni declaraciones tributarias.</p>
  </section>
}

function totalExpense(neto: string, iva: string, exento: string): number {
  try { return montoMenorDesdeTexto(neto) + montoMenorDesdeTexto(iva) + montoMenorDesdeTexto(exento) }
  catch { return 0 }
}

function msg(cause: unknown): string { return cause instanceof Error ? cause.message : 'No se pudo completar la operación.' }
