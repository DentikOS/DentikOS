export type PestanaFicha =
  | 'resumen-ejecutivo'
  | 'datos'
  | 'odontograma'
  | 'periodontograma'
  | 'evoluciones'
  | 'presupuestos'
  | 'recetas-consentimientos'
  | 'timeline'

export interface ContextoFicha {
  citaActiva: boolean
  prestacion?: { categoria?: string }
}

export interface PacienteContextual {
  esNuevo: boolean
  diasSinVisita: number
  presupuestoPendienteDias: number
  ultimaPestanaUsada?: PestanaFicha
}

export const determinarPestanaDefault = (
  paciente: PacienteContextual,
  contexto: ContextoFicha
): PestanaFicha => {
  if (contexto.citaActiva) return 'odontograma'
  if (paciente.esNuevo) return 'datos'
  if (paciente.presupuestoPendienteDias > 7) return 'presupuestos'
  if (contexto.prestacion?.categoria === 'periodoncia') return 'periodontograma'
  if (paciente.diasSinVisita > 180) return 'resumen-ejecutivo'
  return paciente.ultimaPestanaUsada ?? 'resumen-ejecutivo'
}
