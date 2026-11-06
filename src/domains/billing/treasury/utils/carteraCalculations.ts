import { diasEntreFechas, validarFechaIso, validarMoneda, validarMontoMenor } from './validation'

export interface PagoCuotaCartera {
  montoMenor: number
  estado: 'confirmado' | 'pendiente' | 'anulado'
}

export interface CuotaCartera {
  moneda: string
  montoCuotaMenor: number
  fechaVencimiento: string | null
  pagos: readonly PagoCuotaCartera[]
}

export interface BandasCartera {
  dias0a30Menor: number
  dias31a60Menor: number
  dias61a90Menor: number
  masDe90Menor: number
  sinFechaMenor: number
  porVencerMenor: number
  totalMenor: number
}

export function calcularAntiguedadCartera(input: {
  fechaCorte: string
  cuotas: readonly CuotaCartera[]
}): { porMoneda: Record<string, BandasCartera> } {
  validarFechaIso(input.fechaCorte, 'fecha de corte')
  const porMoneda: Record<string, BandasCartera> = {}

  for (const cuota of input.cuotas) {
    validarMoneda(cuota.moneda)
    validarMontoMenor(cuota.montoCuotaMenor, 'monto de cuota')
    if (cuota.fechaVencimiento !== null) validarFechaIso(cuota.fechaVencimiento, 'fecha de vencimiento')
    const pagosConfirmadosMenor = cuota.pagos.reduce((total, pago) => {
      validarMontoMenor(pago.montoMenor, 'monto de pago')
      return pago.estado === 'confirmado' ? sumar(total, pago.montoMenor) : total
    }, 0)
    if (pagosConfirmadosMenor > cuota.montoCuotaMenor) {
      throw new RangeError('Los pagos confirmados superan el monto de la cuota.')
    }
    const saldoMenor = cuota.montoCuotaMenor - pagosConfirmadosMenor
    if (saldoMenor === 0) continue

    const bandas = porMoneda[cuota.moneda] ??= crearBandasVacias()
    bandas.totalMenor = sumar(bandas.totalMenor, saldoMenor)
    if (cuota.fechaVencimiento === null) {
      bandas.sinFechaMenor = sumar(bandas.sinFechaMenor, saldoMenor)
      continue
    }

    const diasVencidos = diasEntreFechas(cuota.fechaVencimiento, input.fechaCorte)
    if (diasVencidos < 0) bandas.porVencerMenor = sumar(bandas.porVencerMenor, saldoMenor)
    else if (diasVencidos <= 30) bandas.dias0a30Menor = sumar(bandas.dias0a30Menor, saldoMenor)
    else if (diasVencidos <= 60) bandas.dias31a60Menor = sumar(bandas.dias31a60Menor, saldoMenor)
    else if (diasVencidos <= 90) bandas.dias61a90Menor = sumar(bandas.dias61a90Menor, saldoMenor)
    else bandas.masDe90Menor = sumar(bandas.masDe90Menor, saldoMenor)
  }

  return { porMoneda }
}

function crearBandasVacias(): BandasCartera {
  return {
    dias0a30Menor: 0,
    dias31a60Menor: 0,
    dias61a90Menor: 0,
    masDe90Menor: 0,
    sinFechaMenor: 0,
    porVencerMenor: 0,
    totalMenor: 0,
  }
}

function sumar(a: number, b: number): number {
  const resultado = a + b
  validarMontoMenor(resultado, 'suma')
  return resultado
}
