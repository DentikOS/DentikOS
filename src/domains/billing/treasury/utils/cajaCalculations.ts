import { validarMoneda, validarMontoMenor } from './validation'

export interface MovimientoCajaCalculable {
  montoMenor: number
  moneda: string
  estado: 'confirmado' | 'pendiente' | 'anulado'
  medioPago?: string
}

export interface DenominacionCaja {
  valorMenor: number
  cantidad: number
}

export interface ArqueoCajaInput {
  moneda: string
  montoAperturaMenor: number
  pagos: readonly MovimientoCajaCalculable[]
  egresos: readonly MovimientoCajaCalculable[]
  denominaciones: readonly DenominacionCaja[]
  umbralMotivoMenor?: number
}

export interface ArqueoCajaCalculado {
  moneda: string
  montoEsperadoMenor: number
  montoContadoMenor: number
  diferenciaMenor: number
  umbralMotivoMenor: number
  requiereMotivo: boolean
}

export function calcularArqueoCaja(input: ArqueoCajaInput): ArqueoCajaCalculado {
  validarMoneda(input.moneda)
  validarMontoMenor(input.montoAperturaMenor, 'monto de apertura')
  const umbralMotivoMenor = input.umbralMotivoMenor ?? 500_000
  validarMontoMenor(umbralMotivoMenor, 'umbral de motivo')

  const totalPagosMenor = input.pagos.reduce((total, pago) => {
    validarMontoMenor(pago.montoMenor, 'monto de pago')
    validarMoneda(pago.moneda)
    if (pago.estado !== 'confirmado' || pago.moneda !== input.moneda || pago.medioPago?.toLowerCase() !== 'efectivo') {
      return total
    }
    return sumarMontos(total, pago.montoMenor)
  }, 0)

  const totalEgresosMenor = input.egresos.reduce((total, egreso) => {
    validarMontoMenor(egreso.montoMenor, 'monto de egreso')
    validarMoneda(egreso.moneda)
    if (
      egreso.estado !== 'confirmado' ||
      egreso.moneda !== input.moneda ||
      egreso.medioPago?.toLowerCase() !== 'efectivo'
    ) return total
    return sumarMontos(total, egreso.montoMenor)
  }, 0)

  const montoEsperadoMenor = sumarMontos(input.montoAperturaMenor, totalPagosMenor) - totalEgresosMenor
  validarMontoMenor(montoEsperadoMenor, 'monto esperado', true)

  const montoContadoMenor = input.denominaciones.reduce((total, denominacion) => {
    validarMontoMenor(denominacion.valorMenor, 'denominación')
    if (denominacion.valorMenor === 0 || !Number.isSafeInteger(denominacion.cantidad) || denominacion.cantidad < 0) {
      throw new RangeError('La denominación y su cantidad deben ser válidas.')
    }
    const subtotal = denominacion.valorMenor * denominacion.cantidad
    validarMontoMenor(subtotal, 'conteo de denominación')
    return sumarMontos(total, subtotal)
  }, 0)

  const diferenciaMenor = montoContadoMenor - montoEsperadoMenor
  validarMontoMenor(diferenciaMenor, 'diferencia', true)
  return {
    moneda: input.moneda,
    montoEsperadoMenor,
    montoContadoMenor,
    diferenciaMenor,
    umbralMotivoMenor,
    requiereMotivo: Math.abs(diferenciaMenor) > umbralMotivoMenor,
  }
}

function sumarMontos(a: number, b: number): number {
  const suma = a + b
  validarMontoMenor(suma, 'suma', true)
  return suma
}
