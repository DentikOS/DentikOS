import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfiguracionGesClinicaPanel } from './ConfiguracionGesClinicaPanel'

describe('ConfiguracionGesClinicaPanel', () => {
  it('guarda los valores vacíos como nulos y no inventa códigos ni aranceles', async () => {
    const alGuardar = vi.fn().mockResolvedValue(undefined)
    render(<ConfiguracionGesClinicaPanel configuraciones={[]} alGuardar={alGuardar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith('pulpitis', {
      codigo_fonasa: null,
      descripcion_convenio: null,
      arancel_pactado: null,
      centro_costos: null,
      previsiones_convenio: []
    }, null))
  })
})
