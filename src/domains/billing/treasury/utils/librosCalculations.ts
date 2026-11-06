import { validarMoneda, validarMontoMenor } from './validation'

export interface VentaParaLibroInterno {
  id: string
  montoMenor: number
  moneda: string
  estado: 'confirmado' | 'pendiente' | 'anulado'
  tipoDTE?: string | null
  folioDTE?: string | null
}

export interface ResumenVentasInternas {
  esOficial: false
  porMoneda: Record<string, { totalMenor: number; documentosDteFaltantes: number; pagosConfirmados: number }>
  advertencias: ['vista_interna_no_verificada']
}

export function resumirVentasInternas(pagos: readonly VentaParaLibroInterno[]): ResumenVentasInternas {
  const porMoneda: ResumenVentasInternas['porMoneda'] = {}
  for (const pago of pagos) {
    validarMontoMenor(pago.montoMenor, 'monto de pago')
    validarMoneda(pago.moneda)
    if (pago.estado !== 'confirmado') continue
    const resumen = porMoneda[pago.moneda] ??= { totalMenor: 0, documentosDteFaltantes: 0, pagosConfirmados: 0 }
    const total = resumen.totalMenor + pago.montoMenor
    validarMontoMenor(total, 'total del libro interno')
    resumen.totalMenor = total
    resumen.pagosConfirmados += 1
    if (!pago.tipoDTE?.trim() || !pago.folioDTE?.trim()) resumen.documentosDteFaltantes += 1
  }
  return { esOficial: false, porMoneda, advertencias: ['vista_interna_no_verificada'] }
}
