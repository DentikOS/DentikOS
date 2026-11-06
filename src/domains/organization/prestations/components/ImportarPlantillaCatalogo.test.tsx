import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  importarPlantilla: vi.fn(),
  setPrestacionesArancel: vi.fn(),
  sincronizarDesdeSupabase: vi.fn(),
  moneda: 'CLP',
}))

vi.mock('../../clinic/services/clinicStorageService', () => ({
  clinicStorageService: { obtenerClinica: () => ({ moneda: mocks.moneda }) },
}))
vi.mock('../../../../app/stores/prestacionesStore', () => ({
  usePrestacionesStore: {
    getState: () => ({
      setPrestacionesArancel: mocks.setPrestacionesArancel,
      sincronizarDesdeSupabase: mocks.sincronizarDesdeSupabase,
    }),
  },
}))
vi.mock('../services/prestacionesSupabaseService', () => ({
  prestacionesSupabaseService: { importarPlantilla: mocks.importarPlantilla },
}))

import { ImportarPlantillaCatalogo } from './ImportarPlantillaCatalogo'

describe('ImportarPlantillaCatalogo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.moneda = 'CLP'
    mocks.importarPlantilla.mockResolvedValue([{ id: 'prestacion-1', codigoInterno: 'PRE-01' }])
  })

  it('muestra solo el precio base de BP08 y confirma la carga completa', async () => {
    render(<ImportarPlantillaCatalogo />)
    fireEvent.click(screen.getByRole('button', { name: /Clínica General/ }))

    expect(screen.getByRole('spinbutton', { name: 'PRE-01 precio base' })).toHaveValue(50000)
    expect(screen.queryByRole('spinbutton', { name: /Fonasa/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /importar 20 prestaciones/i }))

    await waitFor(() => expect(mocks.importarPlantilla).toHaveBeenCalledTimes(1))
    expect(mocks.importarPlantilla).toHaveBeenCalledWith('general', expect.arrayContaining([
      expect.objectContaining({ codigoInterno: 'PRE-01', precioParticular: 50000, precioFonasa: null }),
    ]))
    expect(mocks.setPrestacionesArancel).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'prestacion-1' }),
    ]))
  })

  it('exige precios revisados en la moneda configurada que no sea CLP', () => {
    mocks.moneda = 'USD'
    render(<ImportarPlantillaCatalogo />)
    fireEvent.click(screen.getByRole('button', { name: /Clínica General/ }))

    expect(screen.getByRole('spinbutton', { name: 'PRE-01 precio base' })).toHaveValue(null)
    expect(screen.getByRole('button', { name: /importar 20 prestaciones/i })).toBeDisabled()
  })
})
