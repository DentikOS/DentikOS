import { create } from 'zustand'

export interface PiezaOdontogramaItem {
  numero: string
  estado: string
  tipoPatologia?: string
}

export interface OdontogramaData {
  piezas: PiezaOdontogramaItem[]
  actualizadoAt?: string
}

export interface OdontogramaStore {
  odontograma: OdontogramaData | null
  pacienteId: string | null
  setOdontograma: (odontograma: OdontogramaData | null, pacienteId?: string | null) => void
}

export const useOdontogramaStore = create<OdontogramaStore>((set) => ({
  odontograma: null,
  pacienteId: null,
  setOdontograma: (odontograma, pacienteId = null) => set({ odontograma, pacienteId }),
}))
