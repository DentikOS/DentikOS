import { create } from 'zustand'
import { VADEMECUM_ODONTOLOGICO } from '../../data/vademecum'

export interface Medicamento {
  id: string | number
  nombre: string
  presentacion?: string
  posologia?: string
  dosis?: string
  frecuencia?: string
  duracion?: string
  familia?: string
}

export interface VademecumState {
  medicamentos: Medicamento[]
  setMedicamentos: (medicamentos: Medicamento[]) => void
}

const MEDICAMENTOS_INICIALES: Medicamento[] = VADEMECUM_ODONTOLOGICO.map((m, idx) => ({
  id: `med-${idx + 1}`,
  nombre: m.medicamento,
  presentacion: m.medicamento.includes('(') ? m.medicamento.split('(')[1].replace(')', '') : 'Comprimidos',
  posologia: m.posologia,
  familia: m.familia,
  dosis: '1 comprimido',
  frecuencia: 'Cada 8 horas',
  duracion: '5 a 7 días',
}))

export const useVademecumStore = create<VademecumState>((set) => ({
  medicamentos: MEDICAMENTOS_INICIALES,
  setMedicamentos: (medicamentos) => set({ medicamentos }),
}))
