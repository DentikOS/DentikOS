import { validarFechaIso, validarMoneda, validarMontoMenor } from './validation'

export type EscenarioFlujo = 'optimista' | 'realista' | 'pesimista'

export interface IngresoProyectable {
  id: string
  tipo: 'cuota' | 'bono'
  montoMenor: number
  moneda: string
  fecha: string | null
}

export interface GastoProyectable {
  id: string
  montoMenor: number
  moneda: string
  fechaProgramada: string | null
}

export interface ResultadoEscenarioFlujo {
  estado: 'completo' | 'insuficiente'
  saldoConocidoMenor: number
  saldoFinalMenor: number | null
}

export interface FlujoCajaCalculado {
  moneda: string
  porEscenario: Record<EscenarioFlujo, ResultadoEscenarioFlujo>
  datosExcluidos: Array<{ id: string; motivo: 'sin_fecha' | 'otra_moneda' | 'fuera_horizonte' }>
}

const escenarios: readonly EscenarioFlujo[] = ['optimista', 'realista', 'pesimista']

export function proyectarFlujoCaja(input: {
  moneda: string
  saldoInicialMenor: number
  desde: string
  hasta: string
  tasasCobranzaPuntosBase: Partial<Record<EscenarioFlujo, number>>
  ingresos: readonly IngresoProyectable[]
  gastos: readonly GastoProyectable[]
}): FlujoCajaCalculado {
  validarMoneda(input.moneda)
  validarMontoMenor(input.saldoInicialMenor, 'saldo inicial', true)
  validarFechaIso(input.desde, 'fecha inicial')
  validarFechaIso(input.hasta, 'fecha final')
  if (input.desde > input.hasta) throw new RangeError('El horizonte de proyección está invertido.')

  const datosExcluidos: FlujoCajaCalculado['datosExcluidos'] = []
  const ingresosIncluidos: IngresoProyectable[] = []
  const gastosIncluidos: GastoProyectable[] = []

  for (const ingreso of input.ingresos) {
    validarMontoMenor(ingreso.montoMenor, 'monto de ingreso')
    validarMoneda(ingreso.moneda)
    if (ingreso.moneda !== input.moneda) {
      datosExcluidos.push({ id: ingreso.id, motivo: 'otra_moneda' })
      continue
    }
    if (ingreso.fecha === null) {
      datosExcluidos.push({ id: ingreso.id, motivo: 'sin_fecha' })
      continue
    }
    validarFechaIso(ingreso.fecha, 'fecha de ingreso')
    if (ingreso.fecha < input.desde || ingreso.fecha > input.hasta) {
      datosExcluidos.push({ id: ingreso.id, motivo: 'fuera_horizonte' })
      continue
    }
    ingresosIncluidos.push(ingreso)
  }

  for (const gasto of input.gastos) {
    validarMontoMenor(gasto.montoMenor, 'monto de gasto')
    validarMoneda(gasto.moneda)
    if (gasto.moneda !== input.moneda) {
      datosExcluidos.push({ id: gasto.id, motivo: 'otra_moneda' })
      continue
    }
    if (gasto.fechaProgramada === null) {
      datosExcluidos.push({ id: gasto.id, motivo: 'sin_fecha' })
      continue
    }
    validarFechaIso(gasto.fechaProgramada, 'fecha programada de gasto')
    if (gasto.fechaProgramada < input.desde || gasto.fechaProgramada > input.hasta) {
      datosExcluidos.push({ id: gasto.id, motivo: 'fuera_horizonte' })
      continue
    }
    gastosIncluidos.push(gasto)
  }

  for (const escenario of escenarios) {
    const tasa = input.tasasCobranzaPuntosBase[escenario]
    if (tasa !== undefined && (!Number.isSafeInteger(tasa) || tasa < 0 || tasa > 10_000)) {
      throw new RangeError(`La tasa del escenario ${escenario} debe estar entre 0 y 10000 puntos base.`)
    }
  }

  const hayDatosSinFecha = datosExcluidos.some((dato) => dato.motivo === 'sin_fecha')
  const egresosMenor = sumar(gastosIncluidos.map(({ montoMenor }) => montoMenor))
  const porEscenario = Object.fromEntries(escenarios.map((escenario) => {
    const tasa = input.tasasCobranzaPuntosBase[escenario]
    const tasaValida = tasa !== undefined
    const ingresosMenor = tasaValida
      ? sumar(ingresosIncluidos.map(({ montoMenor }) => aplicarTasa(montoMenor, tasa!)))
      : 0
    const saldoConocidoMenor = sumar([input.saldoInicialMenor, ingresosMenor, -egresosMenor], true)
    const estado = tasaValida && !hayDatosSinFecha ? 'completo' : 'insuficiente'
    return [escenario, {
      estado,
      saldoConocidoMenor,
      saldoFinalMenor: estado === 'completo' ? saldoConocidoMenor : null,
    }]
  })) as Record<EscenarioFlujo, ResultadoEscenarioFlujo>

  return { moneda: input.moneda, porEscenario, datosExcluidos }
}

function aplicarTasa(montoMenor: number, puntosBase: number): number {
  const resultado = (BigInt(montoMenor) * BigInt(puntosBase) + 5_000n) / 10_000n
  if (resultado > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('El ingreso proyectado excede el límite seguro.')
  return Number(resultado)
}

function sumar(importes: readonly number[], permitirNegativo = false): number {
  const resultado = importes.reduce((total, importe) => {
    const suma = total + importe
    validarMontoMenor(suma, 'suma', permitirNegativo)
    return suma
  }, 0)
  return resultado
}
