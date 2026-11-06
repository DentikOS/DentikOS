import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  guardar: vi.fn(),
  configuracion: {
    version: 1 as const,
    categorias: [{ id: 'diagnostico', nombre: 'Diagnóstico', especialidades: ['Diagnóstico'] }],
    convenios: [],
    preciosEspecificos: [],
  },
  state: {
    prestacionesArancel: [{ id: 'prestacion-1', nombre: 'Control', especialidad: 'Diagnóstico', precioParticular: 20000 }],
    estadoRemoto: 'listo',
    sincronizarDesdeSupabase: vi.fn(),
  },
}))

vi.mock('../hooks/useConfiguracionConvenios', () => ({
  useConfiguracionConvenios: () => ({
    configuracion: mocks.configuracion,
    cargando: false,
    cargada: true,
    guardando: false,
    error: null,
    esAdmin: true,
    guardar: mocks.guardar,
  }),
}))

vi.mock('../../../../app/stores/prestacionesStore', () => ({
  usePrestacionesStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}))

vi.mock('../services/clinicStorageService', () => ({
  clinicStorageService: { obtenerClinica: () => ({ moneda: 'CLP' }) },
}))

import { ConfiguracionConveniosModulo } from './ConfiguracionConveniosModulo'

describe('ConfiguracionConveniosModulo', () => {
  beforeEach(() => {
    mocks.guardar.mockReset().mockResolvedValue(true)
  })

  it('permite configurar y sincronizar un convenio con descuento por categoría', async () => {
    render(<ConfiguracionConveniosModulo sedes={[]} />)

    fireEvent.change(screen.getByLabelText('Nombre del nuevo convenio'), { target: { value: 'ISAPRE Demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar convenio' }))
    fireEvent.change(screen.getByLabelText('ISAPRE Demo: descuento Diagnóstico en porcentaje'), { target: { value: '12.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))

    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({
      convenios: [expect.objectContaining({
        nombre: 'ISAPRE Demo',
        tipo: 'isapre',
        descuentosPorCategoria: expect.objectContaining({ diagnostico: 12.5 }),
      })],
    })))
    expect(await screen.findByText('Configuración sincronizada con la clínica.')).toBeInTheDocument()
  })
})
