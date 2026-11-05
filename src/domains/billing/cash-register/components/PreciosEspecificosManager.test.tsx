import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { crearConfiguracionConveniosVacia } from '../../../organization/clinic/schemas/configuracionConveniosSchema'
import { PreciosEspecificosManager } from './PreciosEspecificosManager'

vi.mock('../../../../app/stores/prestacionesStore', () => ({
  usePrestacionesStore: (selector: (state: unknown) => unknown) => selector({
    prestacionesArancel: [{ id: 8, nombre: 'Endodoncia', precioParticular: 100000 }],
    estadoRemoto: 'listo',
  }),
}))

vi.mock('../../../organization/clinic/hooks/useSedes', () => ({
  useSedes: () => ({
    sedes: [{ id: 'sede-1', nombre: 'Sucursal Centro', estado: 'activa' }],
    cargando: false,
    errorSincronizacion: null,
  }),
}))

describe('PreciosEspecificosManager', () => {
  it('agrega un precio fijo por prestación y sucursal a la configuración compartida', () => {
    const onChange = vi.fn()
    render(<PreciosEspecificosManager
      configuracion={crearConfiguracionConveniosVacia()}
      esAdmin
      guardando={false}
      onChange={onChange}
    />)

    fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'sucursal' } })
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'sede-1' } })
    fireEvent.change(screen.getByLabelText('Prestación del arancel'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Precio fijo (CLP)'), { target: { value: '55000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar precio' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      preciosEspecificos: [{ prestacionId: '8', alcance: 'sucursal', contextoId: 'sede-1', precio: 55000 }],
    }))
  })

  it('no presenta controles de edición para otros roles', () => {
    render(<PreciosEspecificosManager
      configuracion={crearConfiguracionConveniosVacia()}
      esAdmin={false}
      guardando={false}
      onChange={vi.fn()}
    />)
    expect(screen.queryByRole('button', { name: 'Agregar precio' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Precio fijo (CLP)')).not.toBeInTheDocument()
  })
})
