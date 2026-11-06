import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalNuevaPrestacion } from './ModalNuevaPrestacion'

describe('ModalNuevaPrestacion precios BP08', () => {
  it('edita solo el precio base y deja el campo legado de convenio sin tarifa', async () => {
    const alGuardar = vi.fn().mockResolvedValue(undefined)

    render(<ModalNuevaPrestacion alGuardar={alGuardar} alCerrar={vi.fn()} />)

    expect(screen.getByLabelText(/Precio base/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Precio Fonasa \/ Convenio/i)).not.toBeInTheDocument()
    expect(screen.getByText(/precios para ISAPRE, FONASA y sucursales se configuran/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Nombre del Procedimiento \/ Tratamiento/), { target: { value: 'Limpieza dental' } })
    fireEvent.change(screen.getByLabelText(/Precio base/), { target: { value: '35000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Prestación' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({
      precioParticular: 35000,
      precioFonasa: null,
    })))
  })
})
