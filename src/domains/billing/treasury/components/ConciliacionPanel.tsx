import React, { useMemo, useState } from 'react'
import ExcelJS from 'exceljs'
import type { TreasuryPanelProps } from './types'
import { formatearMenor, numero, texto } from './types'
import {
  inferirMapeoColumnasExtracto, parsearCsvBancario, parsearOfxBancario, parsearXlsxBancario,
  type FilaExtractoNormalizada, type ResultadoParseoExtracto
} from '../services/importadores/extractoParser'
import { sugerirCoincidenciasBancarias } from '../utils/conciliacionCalculations'

interface FuenteUI { id: string; tipo: 'pago' | 'gasto' | 'bono'; label: string; montoMenor: number; moneda: string; fecha: string; referencia: string }

export const ConciliacionPanel: React.FC<TreasuryPanelProps> = ({ snapshot, acciones, online, loading }) => {
  const [alias, setAlias] = useState('')
  const [entidad, setEntidad] = useState('')
  const [ultimosCuatro, setUltimosCuatro] = useState('')
  const [moneda, setMoneda] = useState('CLP')
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('')
  const [vistaPrevia, setVistaPrevia] = useState<{ file: File; resultado: ResultadoParseoExtracto; hash: string; cuentaId: string } | null>(null)
  const [seleccion, setSeleccion] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const cuentas = snapshot?.cuentasBancarias || []
  const filas = snapshot?.extractoFilas || []
  const conciliaciones = snapshot?.conciliaciones || []
  const conciliacionActivaPorFila = new Map(conciliaciones
    .filter((row) => row.estado === 'conciliada')
    .map((row) => [String(row.extracto_fila_id), row]))

  const fuentes = useMemo<FuenteUI[]>(() => {
    if (!snapshot) return []
    const pagos: FuenteUI[] = snapshot.pagos.flatMap((row) => {
      if (row.fecha_anulacion || row.motivo_anulacion) return []
      const medio = String(row.metodo_pago || '').toLowerCase()
      if (medio === 'efectivo' || medio === 'cash') return []
      const date = dateOnly(row.fecha)
      const amount = numero(row.monto) * 100
      if (!date || !Number.isSafeInteger(amount) || amount <= 0) return []
      return [{ id: String(row.id), tipo: 'pago', label: `Pago BP07 ${texto(row.folio, String(row.id).slice(0, 8))}`,
        montoMenor: amount, moneda: String(row.moneda || ''), fecha: date, referencia: String(row.referencia || row.folio || '') }]
    })
    const gastos: FuenteUI[] = snapshot.gastos.flatMap((row) => {
      if (row.estado !== 'pagado') return []
      const date = dateOnly(row.fecha_pago)
      const amount = numero(row.total_minor)
      if (!date || !Number.isSafeInteger(amount) || amount <= 0) return []
      return [{ id: String(row.id), tipo: 'gasto', label: `Gasto ${texto(row.proveedor_nombre)}`,
        montoMenor: amount, moneda: String(row.moneda || ''), fecha: date, referencia: String(row.folio_documento || '') }]
    })
    const bonos: FuenteUI[] = snapshot.liquidacionesBono.flatMap((row) => {
      if (row.estado !== 'confirmada') return []
      const date = dateOnly(row.fecha)
      const amount = numero(row.monto_minor)
      if (!date || !Number.isSafeInteger(amount) || amount <= 0) return []
      return [{ id: String(row.id), tipo: 'bono', label: `Liquidación de bono ${String(row.bono_id).slice(0, 8)}`,
        montoMenor: amount, moneda: String(row.moneda || ''), fecha: date, referencia: String(row.referencia || '') }]
    })
    return [...pagos, ...gastos, ...bonos]
  }, [snapshot])

  const handleCrearCuenta = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setError(null)
    try {
      setGuardando(true)
      await acciones.guardarCuentaBancaria({ alias, entidad, ultimosCuatro, moneda })
      setAlias(''); setEntidad(''); setUltimosCuatro('')
    } catch (cause) { setError(message(cause)) } finally { setGuardando(false) }
  }

  const handleArchivo = async (file: File): Promise<void> => {
    setError(null); setVistaPrevia(null)
    try {
      if (!cuentaSeleccionada) throw new Error('Selecciona una cuenta bancaria antes de importar.')
      const cuenta = cuentas.find((row) => String(row.id) === cuentaSeleccionada)
      if (!cuenta) throw new Error('La cuenta bancaria seleccionada ya no está disponible.')
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.')
      const bytes = await file.arrayBuffer()
      const hash = await sha256(bytes)
      const extension = file.name.split('.').pop()?.toLowerCase()
      let resultado: ResultadoParseoExtracto
      if (extension === 'csv') {
        const content = new TextDecoder().decode(bytes)
        const header = content.split(/\r?\n/, 1)[0].split(/[;,\t]/).map((value) => value.trim().replace(/^"|"$/g, ''))
        const mapping = inferirMapeoColumnasExtracto(header)
        const currency = mapping.moneda ? undefined : String(cuenta.moneda)
        resultado = parsearCsvBancario(content, mapping, { monedaPredeterminada: currency })
      } else if (extension === 'xlsx') {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(bytes)
        const worksheet = workbook.worksheets[0]
        if (!worksheet) throw new Error('El XLSX no contiene una hoja de movimientos.')
        const headerRow = worksheet.getRow(1)
        const headers = Array.from({ length: headerRow.cellCount }, (_, index) => headerRow.getCell(index + 1).text)
        const mapping = inferirMapeoColumnasExtracto(headers)
        const currency = mapping.moneda ? undefined : String(cuenta.moneda)
        resultado = await parsearXlsxBancario(bytes, mapping, { monedaPredeterminada: currency })
      } else if (extension === 'ofx' || extension === 'qfx') {
        resultado = parsearOfxBancario(new TextDecoder().decode(bytes), { monedaPredeterminada: String(cuenta.moneda) })
      } else throw new Error('Usa un archivo CSV, XLSX, OFX o QFX.')
      if (resultado.filas.some((row) => row.moneda !== cuenta.moneda)) throw new Error('La moneda del archivo no coincide con la cuenta seleccionada.')
      setVistaPrevia({ file, resultado, hash, cuentaId: cuentaSeleccionada })
    } catch (cause) { setError(message(cause)) }
  }

  const handleImportar = async (): Promise<void> => {
    if (!vistaPrevia) return
    setError(null)
    try {
      setGuardando(true)
      await acciones.importarExtracto({
        cuentaBancariaId: vistaPrevia.cuentaId,
        hashArchivo: vistaPrevia.hash,
        moneda: String(cuentas.find((row) => String(row.id) === vistaPrevia.cuentaId)?.moneda || ''),
        filas: vistaPrevia.resultado.filas.map((row) => ({
          fecha: row.fecha, monto_minor: row.montoMenor, moneda: row.moneda, descripcion: row.descripcion, referencia: row.referencia
        })),
        idempotencyKey: crypto.randomUUID()
      })
      setVistaPrevia(null)
    } catch (cause) { setError(message(cause)) } finally { setGuardando(false) }
  }

  const handleConciliar = async (fila: Record<string, unknown>): Promise<void> => {
    const key = String(fila.id)
    const [tipoFuente, fuenteId] = (seleccion[key] || '').split(':') as [FuenteUI['tipo'] | '', string]
    if (!tipoFuente || !fuenteId) { setError('Selecciona una fuente para confirmar la conciliación.'); return }
    setError(null)
    try {
      setGuardando(true)
      await acciones.conciliar({ extractoFilaId: key, moneda: String(fila.moneda), tipoFuente, fuenteId })
      setSeleccion((current) => ({ ...current, [key]: '' }))
    } catch (cause) { setError(message(cause)) } finally { setGuardando(false) }
  }

  const handleRevertir = async (id: string): Promise<void> => {
    const motivo = window.prompt('Motivo de reversión de la conciliación:') || ''
    if (motivo.trim().length < 5) return
    setError(null)
    try { setGuardando(true); await acciones.revertirConciliacion(id, motivo) }
    catch (cause) { setError(message(cause)) }
    finally { setGuardando(false) }
  }

  return <section className="space-y-4">
    <div><h2 className="text-lg font-bold">Conciliación bancaria</h2><p className="text-sm text-secondary">Las coincidencias son sugerencias; solo se concilian cuando el admin confirma.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    <form onSubmit={(event) => void handleCrearCuenta(event)} className="grid gap-3 rounded-2xl border border-surface bg-surface p-4 sm:grid-cols-2 xl:grid-cols-5">
      <h3 className="font-semibold sm:col-span-2 xl:col-span-5">Cuenta bancaria (sin número completo ni credenciales)</h3>
      <label className="text-xs font-medium">Alias<input required maxLength={80} value={alias} onChange={(e) => setAlias(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Banco<input required maxLength={120} value={entidad} onChange={(e) => setEntidad(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Últimos cuatro<input required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} value={ultimosCuatro} onChange={(e) => setUltimosCuatro(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium">Moneda<select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm"><option>CLP</option><option>USD</option><option>EUR</option></select></label>
      <button disabled={!online || loading || guardando} className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Guardar cuenta</button>
    </form>

    <div className="rounded-2xl border border-surface bg-surface p-4">
      <h3 className="font-semibold">Importar extracto</h3>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium">Cuenta<select value={cuentaSeleccionada} onChange={(event) => { setCuentaSeleccionada(event.target.value); setVistaPrevia(null) }} className="mt-1 block min-w-56 rounded-lg border border-surface bg-canvas px-3 py-2 text-sm"><option value="">Selecciona cuenta</option>{cuentas.filter((row) => row.activa).map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.alias)} · {String(row.moneda)} · ••••{String(row.ultimos_cuatro)}</option>)}</select></label>
        <label className="text-xs font-medium">Archivo CSV / XLSX / OFX / QFX<input type="file" accept=".csv,.xlsx,.ofx,.qfx" disabled={!online || guardando || !cuentaSeleccionada} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleArchivo(file); event.currentTarget.value = '' }} className="mt-1 block max-w-full text-sm" /></label>
      </div>
      <p className="mt-2 text-xs text-secondary">CSV/XLSX requiere una columna de importe firmado. El archivo original no se guarda; se persisten su hash y filas normalizadas (máx. 5 MB / 10.000 filas).</p>
      {vistaPrevia && <div className="mt-4 space-y-3 rounded-xl border border-primary/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">Vista previa de <strong>{vistaPrevia.file.name}</strong> · {vistaPrevia.resultado.filas.length} filas</p><button type="button" onClick={() => setVistaPrevia(null)} className="text-xs text-secondary">Descartar</button></div>
        <div className="space-y-1">{vistaPrevia.resultado.filas.slice(0, 5).map((row, index) => <div key={`${row.fecha}-${index}`} className="flex justify-between gap-3 text-xs"><span>{row.fecha} · {row.descripcion || row.referencia || 'Sin glosa'}</span><span>{formatearMenor(row.montoMenor, row.moneda)}</span></div>)}</div>
        <button type="button" onClick={() => void handleImportar()} disabled={!online || guardando} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Confirmar importación</button>
      </div>}
      {cuentas.length === 0 && <p className="mt-3 text-sm text-secondary">Registra una cuenta para importar extractos.</p>}
    </div>

    <div className="space-y-3">
      <h3 className="font-semibold">Movimientos del extracto</h3>
      {filas.length === 0 && <p className="rounded-xl border border-surface bg-surface p-4 text-sm text-secondary">No hay filas importadas.</p>}
      {filas.map((fila) => {
        const movimiento = { montoMenor: Math.abs(numero(fila.monto_minor)), moneda: String(fila.moneda), fecha: String(fila.fecha), referencia: String(fila.referencia || '') }
        const fuentesValidas = fuentes.filter((source) => (numero(fila.monto_minor) >= 0 ? source.tipo !== 'gasto' : source.tipo === 'gasto'))
        const sugerencias = sugerirCoincidenciasBancarias({ movimiento, fuentes: fuentesValidas, toleranciaMontoMenor: 0, ventanaDias: 10, limite: 5 })
        const sugeridas = new Set(sugerencias.map((item) => item.fuenteId))
        const opciones = [...fuentesValidas.filter((source) => sugeridas.has(source.id)), ...fuentesValidas.filter((source) => !sugeridas.has(source.id))]
        const extracto = snapshot?.extractos.find((row) => row.id === fila.extracto_id)
        const cuenta = cuentas.find((row) => row.id === extracto?.cuenta_bancaria_id)
        const conciliacion = conciliacionActivaPorFila.get(String(fila.id))
        return <article key={String(fila.id)} className="rounded-2xl border border-surface bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{String(fila.fecha)} · {String(cuenta?.alias || 'Cuenta')}</p><p className="text-sm text-secondary">{texto(fila.descripcion, texto(fila.referencia, 'Sin descripción'))} · Ref. {texto(fila.referencia)}</p></div><strong>{formatearMenor(numero(fila.monto_minor), String(fila.moneda))}</strong></div>
          {conciliacion ? <div className="mt-2 flex items-center justify-between text-sm text-emerald-700"><span>Conciliada · {String(conciliacion.created_at || '')}</span><button type="button" onClick={() => void handleRevertir(String(conciliacion.id))} disabled={!online || guardando} className="text-xs underline">Revertir con motivo</button></div> : <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-72 flex-1 text-xs font-medium">Origen de la coincidencia{ sugerencias.length > 0 && <span className="ml-1 text-emerald-700">· {sugerencias.length} sugerencia(s)</span>}
              <select value={seleccion[String(fila.id)] || ''} onChange={(event) => setSeleccion((current) => ({ ...current, [String(fila.id)]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-surface bg-canvas px-3 py-2 text-sm"><option value="">Selecciona manualmente</option>{opciones.map((source) => <option key={`${source.tipo}:${source.id}`} value={`${source.tipo}:${source.id}`}>{sugeridas.has(source.id) ? 'Sugerida · ' : ''}{source.label} · {formatearMenor(source.montoMenor, source.moneda)} · {source.fecha}</option>)}</select>
            </label>
            <button type="button" onClick={() => void handleConciliar(fila)} disabled={!online || guardando || !seleccion[String(fila.id)]} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Confirmar match</button>
          </div>}
        </article>
      })}
    </div>
  </section>
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'No se pudo completar la operación.' }
