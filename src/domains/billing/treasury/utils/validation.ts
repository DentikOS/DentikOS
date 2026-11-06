export function validarMontoMenor(monto: number, nombre = 'monto', permitirNegativo = false): void {
  if (!Number.isSafeInteger(monto) || (!permitirNegativo && monto < 0)) {
    throw new RangeError(`El ${nombre} debe ser un entero seguro${permitirNegativo ? '' : ' no negativo'}.`)
  }
}

export function validarMoneda(moneda: string): void {
  if (!/^[A-Z]{3}$/.test(moneda)) throw new RangeError('La moneda debe ser un código ISO de tres letras.')
}

export function validarFechaIso(fecha: string, nombre = 'fecha'): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new RangeError(`La ${nombre} debe usar formato AAAA-MM-DD.`)
  const fechaParseada = new Date(`${fecha}T00:00:00.000Z`)
  if (!Number.isFinite(fechaParseada.getTime()) || fechaParseada.toISOString().slice(0, 10) !== fecha) {
    throw new RangeError(`La ${nombre} no es válida.`)
  }
}

export function diasEntreFechas(fechaInicio: string, fechaFin: string): number {
  validarFechaIso(fechaInicio)
  validarFechaIso(fechaFin)
  const inicio = Date.parse(`${fechaInicio}T00:00:00.000Z`)
  const fin = Date.parse(`${fechaFin}T00:00:00.000Z`)
  return Math.floor((fin - inicio) / 86_400_000)
}
