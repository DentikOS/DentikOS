import type { PiezaOdontogramaItem } from '../../../../../../app/stores/odontogramaStore'

export interface ProcedimientoPlan {
  id: string
  descripcion: string
  pieza?: number | string
  costo: number
  estado: 'pendiente' | 'aprobado' | 'realizado' | 'cancelado'
}

export interface FasePlan {
  id: string
  nombre: string
  subtitulo: string
  procedimientos: ProcedimientoPlan[]
}

const FASES_VACIAS: FasePlan[] = [
  { id: 'fase-urgencias', nombre: 'Fase 1: Urgencias', subtitulo: 'Alivio de dolor agudo', procedimientos: [] },
  { id: 'fase-estabilizacion', nombre: 'Fase 2: Estabilización', subtitulo: 'Operatoria y saneamiento', procedimientos: [] },
  { id: 'fase-rehabilitacion', nombre: 'Fase 3: Rehabilitación', subtitulo: 'Prótesis e implantes', procedimientos: [] },
  { id: 'fase-estetica', nombre: 'Fase 4: Estética', subtitulo: 'Blanqueamiento y mantención', procedimientos: [] },
]

export const generarFasesDesdeOdontograma = (piezas: PiezaOdontogramaItem[] = []): FasePlan[] => {
  const patologias = piezas.filter((p) => p.estado === 'patologia')
  if (patologias.length === 0) return FASES_VACIAS
  const TARIFAS: Record<string, { desc: string; costo: number; fase: string }> = {
    caries: { desc: 'Restauración Resina', costo: 45000, fase: 'fase-estabilizacion' },
    endodoncia: { desc: 'Endodoncia Molar', costo: 180000, fase: 'fase-urgencias' },
    fractura: { desc: 'Corona Zirconio', costo: 280000, fase: 'fase-rehabilitacion' },
  }
  const procs = patologias.map((p, idx) => {
    const c = TARIFAS[p.tipoPatologia || 'caries'] || { desc: `Tratamiento P.${p.numero}`, costo: 50000, fase: 'fase-estabilizacion' }
    return { id: `proc-${p.numero}-${idx}`, descripcion: `${c.desc} (P.${p.numero})`, pieza: p.numero, costo: c.costo, estado: 'pendiente' as const, fase: c.fase }
  })
  return [
    { id: 'fase-urgencias', nombre: 'Fase 1: Urgencias', subtitulo: 'Alivio de dolor agudo', procedimientos: procs.filter((p) => p.fase === 'fase-urgencias') },
    { id: 'fase-estabilizacion', nombre: 'Fase 2: Estabilización', subtitulo: 'Operatoria y saneamiento', procedimientos: procs.filter((p) => p.fase === 'fase-estabilizacion') },
    { id: 'fase-rehabilitacion', nombre: 'Fase 3: Rehabilitación', subtitulo: 'Prótesis e implantes', procedimientos: procs.filter((p) => p.fase === 'fase-rehabilitacion') },
    { id: 'fase-estetica', nombre: 'Fase 4: Estética', subtitulo: 'Blanqueamiento y mantención', procedimientos: [{ id: 'proc-est', descripcion: 'Profilaxis y control preventivo', costo: 35000, estado: 'pendiente' }] },
  ]
}
