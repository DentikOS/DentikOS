import { create } from 'zustand'

export interface PiezaOdontogramaItem {
  numero: string
  estado: string
  tipoPatologia?: string
}

export interface OdontogramaData {
  piezas: PiezaOdontogramaItem[]
}

export interface OdontogramaStore {
  odontograma: OdontogramaData | null
  setOdontograma: (odontograma: OdontogramaData | null) => void
}

const ODONTOGRAMA_SEED: OdontogramaData = {
  piezas: [
    { numero: '1.6', estado: 'patologia', tipoPatologia: 'caries' },
    { numero: '2.4', estado: 'patologia', tipoPatologia: 'fractura' },
    { numero: '3.6', estado: 'patologia', tipoPatologia: 'endodoncia' },
    { numero: '4.7', estado: 'patologia', tipoPatologia: 'caries' },
  ],
}

export const useOdontogramaStore = create<OdontogramaStore>((set) => ({
  odontograma: ODONTOGRAMA_SEED,
  setOdontograma: (odontograma) => set({ odontograma }),
}))
