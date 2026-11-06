import { calcularAntiguedadCartera, type BandasCartera, type CuotaCartera } from './carteraCalculations'

type Row = Record<string, unknown>

export interface CarteraBp07Row {
  presupuestoId: string
  folio: string
  paciente: string
  moneda: string
  saldoMinor: number
  antiguedad: { porMoneda: Record<string, BandasCartera> }
  agingVerificable: boolean
}

export function adaptarCarteraBp07(input: {
  fechaCorte: string
  presupuestos: readonly Row[]
  pagos: readonly Row[]
  pacientes: readonly Row[]
}): CarteraBp07Row[] {
  const pacientes = new Map(input.pacientes.map((row) => [String(row.id), String(row.nombre || 'Paciente sin nombre')]))
  return input.presupuestos.flatMap((budget) => {
    if (!esPresupuestoCobrar(budget.estado)) return []
    const id = String(budget.id || '')
    const moneda = typeof budget.moneda === 'string' ? budget.moneda : ''
    const totalPesos = numero(budget.monto_total ?? budget.total_apagar ?? budget.total)
    if (!id || !/^[A-Z]{3}$/.test(moneda) || !Number.isSafeInteger(totalPesos) || totalPesos <= 0) return []
    const pagos = input.pagos.filter((payment) => String(payment.presupuesto_id || '') === id && !estaAnulado(payment))
    const pagadoPesos = pagos.reduce((sum, payment) => sum + Math.max(0, numero(payment.monto)), 0)
    const saldoPesos = Math.max(0, totalPesos - pagadoPesos)
    if (!Number.isSafeInteger(saldoPesos) || saldoPesos === 0) return []

    const cuotas = cuotasConAsignacion(budget.plan_pago, pagos, moneda)
    const cuotasVerificables = cuotas !== null && sumarCuotasAbiertas(cuotas) === saldoPesos * 100
    const aging = cuotasVerificables
      ? calcularAntiguedadCartera({ fechaCorte: input.fechaCorte, cuotas: cuotas! })
      : calcularAntiguedadCartera({ fechaCorte: input.fechaCorte, cuotas: [{
        moneda, montoCuotaMenor: saldoPesos * 100, fechaVencimiento: null, pagos: []
      }] })

    return [{
      presupuestoId: id,
      folio: String(budget.folio || id.slice(0, 8)),
      paciente: pacientes.get(String(budget.paciente_id || '')) || 'Paciente',
      moneda,
      saldoMinor: saldoPesos * 100,
      antiguedad: aging,
      agingVerificable: cuotasVerificables
    }]
  })
}

function cuotasConAsignacion(planValue: unknown, pagos: readonly Row[], moneda: string): CuotaCartera[] | null {
  if (!planValue || typeof planValue !== 'object') return null
  const calendario = (planValue as { calendario?: unknown }).calendario
  if (!Array.isArray(calendario) || calendario.length === 0) return null
  const hasUnassignedPayment = pagos.some((payment) => payment.numero_cuota == null
    || !Number.isSafeInteger(Number(payment.numero_cuota)))
  if (hasUnassignedPayment) return null
  const totalCuotas = calendario.reduce((sum, item) => {
    if (!item || typeof item !== 'object') return Number.NaN
    return sum + numero((item as Row).monto)
  }, 0)
  if (!Number.isSafeInteger(totalCuotas)) return null
  return calendario.map((item) => {
    if (!item || typeof item !== 'object') throw new RangeError('El calendario BP07 tiene un formato inválido.')
    const entry = item as Row
    const numeroCuota = Number(entry.numero)
    const fecha = typeof entry.fechaVencimiento === 'string' ? entry.fechaVencimiento.slice(0, 10) : null
    const montoPesos = numero(entry.monto)
    const paymentsForQuota = pagos.filter((payment) => Number(payment.numero_cuota) === numeroCuota)
      .map((payment) => ({ montoMenor: numero(payment.monto) * 100, estado: estaAnulado(payment) ? 'anulado' as const : 'confirmado' as const }))
    return { moneda, montoCuotaMenor: montoPesos * 100, fechaVencimiento: fecha, pagos: paymentsForQuota }
  })
}

function sumarCuotasAbiertas(cuotas: readonly CuotaCartera[]): number {
  return cuotas.reduce((total, cuota) => {
    const pagado = cuota.pagos.reduce((sum, payment) => payment.estado === 'confirmado' ? sum + payment.montoMenor : sum, 0)
    return total + Math.max(0, cuota.montoCuotaMenor - pagado)
  }, 0)
}

function estaAnulado(row: Row): boolean {
  const estado = String(row.estado || '').toLocaleLowerCase()
  return Boolean(row.fecha_anulacion || row.motivo_anulacion || ['anulado', 'purgado', 'anulada'].includes(estado))
}

function esPresupuestoCobrar(estado: unknown): boolean {
  return ['aprobado', 'en-curso', 'entratamiento'].includes(String(estado || '').toLocaleLowerCase())
}

function numero(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}
