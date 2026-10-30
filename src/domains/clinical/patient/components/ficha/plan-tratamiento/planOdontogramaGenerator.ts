import type { PiezaOdontogramaItem } from '../../../../../../app/stores/odontogramaStore'

export type FaseClinica = 'urgencias' | 'estabilizacion' | 'rehabilitacion' | 'estetica'

export interface ProcedimientoPlan {
  id: string
  descripcion: string
  pieza?: number | string
  hallazgo?: string
  prestacionId?: string
  faseAsignada?: FaseClinica
  costo: number | null
  requiereRevision: boolean
  estado: 'pendiente' | 'aprobado' | 'realizado' | 'cancelado'
}

export interface FasePlan {
  id: string
  nombre: string
  subtitulo: string
  procedimientos: ProcedimientoPlan[]
}

export const fasesVacias = (): FasePlan[] => [
  { id: 'fase-urgencias', nombre: 'Fase 1: Urgencias', subtitulo: 'Asignación clínica', procedimientos: [] },
  { id: 'fase-estabilizacion', nombre: 'Fase 2: Estabilización', subtitulo: 'Asignación clínica', procedimientos: [] },
  { id: 'fase-rehabilitacion', nombre: 'Fase 3: Rehabilitación', subtitulo: 'Asignación clínica', procedimientos: [] },
  { id: 'fase-estetica', nombre: 'Fase 4: Estética', subtitulo: 'Asignación clínica', procedimientos: [] },
  { id: 'fase-revision', nombre: 'Revisión clínica pendiente', subtitulo: 'Seleccione prestación y fase antes de presupuestar', procedimientos: [] },
]

export const generarFasesDesdeOdontograma = (piezas: PiezaOdontogramaItem[] = []): FasePlan[] => {
  const fases = fasesVacias()
  fases[4].procedimientos = piezas
    .filter((pieza) => pieza.estado === 'patologia')
    .map((pieza, indice) => ({
      id: `hallazgo-${pieza.numero}-${indice}`,
      descripcion: `Hallazgo ${pieza.tipoPatologia || 'sin clasificar'} (P.${pieza.numero})`,
      pieza: pieza.numero,
      hallazgo: pieza.tipoPatologia || 'sin clasificar',
      costo: null,
      requiereRevision: true,
      estado: 'pendiente' as const,
    }))
  return fases
}
