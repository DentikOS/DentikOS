import { diasEntreFechas, validarFechaIso, validarMoneda, validarMontoMenor } from './validation'

export interface FuenteConciliable {
  id: string
  montoMenor: number
  moneda: string
  fecha: string
  referencia?: string | null
}

export interface SugerenciaConciliacion {
  fuenteId: string
  puntuacion: number
  diferenciaMontoMenor: number
  diferenciaDias: number
  estado: 'sugerida'
}

export function sugerirCoincidenciasBancarias(input: {
  movimiento: Omit<FuenteConciliable, 'id'>
  fuentes: readonly FuenteConciliable[]
  toleranciaMontoMenor: number
  ventanaDias: number
  limite: number
}): SugerenciaConciliacion[] {
  validarMontoMenor(input.movimiento.montoMenor)
  validarMoneda(input.movimiento.moneda)
  validarFechaIso(input.movimiento.fecha)
  validarMontoMenor(input.toleranciaMontoMenor, 'tolerancia de monto')
  if (!Number.isSafeInteger(input.ventanaDias) || input.ventanaDias < 0) {
    throw new RangeError('La ventana de fechas debe ser un entero no negativo.')
  }
  if (!Number.isSafeInteger(input.limite) || input.limite < 1 || input.limite > 100) {
    throw new RangeError('El límite de sugerencias debe estar entre 1 y 100.')
  }

  const referenciaMovimiento = normalizarReferencia(input.movimiento.referencia)
  return input.fuentes
    .map((fuente) => {
      validarMontoMenor(fuente.montoMenor, 'monto fuente')
      validarMoneda(fuente.moneda)
      validarFechaIso(fuente.fecha)
      const diferenciaMontoMenor = Math.abs(fuente.montoMenor - input.movimiento.montoMenor)
      const diferenciaDias = Math.abs(diasEntreFechas(fuente.fecha, input.movimiento.fecha))
      return { fuente, diferenciaMontoMenor, diferenciaDias }
    })
    .filter(({ fuente, diferenciaMontoMenor, diferenciaDias }) => (
      fuente.moneda === input.movimiento.moneda &&
      diferenciaMontoMenor <= input.toleranciaMontoMenor &&
      diferenciaDias <= input.ventanaDias
    ))
    .map(({ fuente, diferenciaMontoMenor, diferenciaDias }) => {
      const referenciaFuente = normalizarReferencia(fuente.referencia)
      const referenciaCoincide = referenciaMovimiento.length > 0 && referenciaFuente === referenciaMovimiento
      const puntuacion =
        (diferenciaMontoMenor === 0 ? 50 : 0) +
        (diferenciaDias === 0 ? 25 : Math.max(0, 10 - diferenciaDias)) +
        (referenciaCoincide ? 100 : 0)
      return {
        fuenteId: fuente.id,
        puntuacion,
        diferenciaMontoMenor,
        diferenciaDias,
        estado: 'sugerida' as const,
      }
    })
    .sort((a, b) => (
      b.puntuacion - a.puntuacion ||
      a.diferenciaMontoMenor - b.diferenciaMontoMenor ||
      a.diferenciaDias - b.diferenciaDias ||
      a.fuenteId.localeCompare(b.fuenteId)
    ))
    .slice(0, input.limite)
}

function normalizarReferencia(valor: string | null | undefined): string {
  return (valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
