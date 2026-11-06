import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TablaArancelPrestaciones } from './TablaArancelPrestaciones'

describe('TablaArancelPrestaciones precios BP08', () => {
  it('muestra el precio base y no presenta una tarifa FONASA dentro del catálogo', () => {
    render(<TablaArancelPrestaciones
      prestaciones={[{
        id: 'prest-1', nombre: 'Limpieza dental', especialidad: 'Preventivo',
        precioParticular: 35000, precioFonasa: 20000, codigoFonasa: '',
      }]}
      onEditar={vi.fn()}
      onEliminar={vi.fn()}
    />)

    expect(screen.getByRole('columnheader', { name: 'Precio base (CLP)' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Precio Fonasa \/ Convenio/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Pendiente de revisión/)).not.toBeInTheDocument()
  })
})
