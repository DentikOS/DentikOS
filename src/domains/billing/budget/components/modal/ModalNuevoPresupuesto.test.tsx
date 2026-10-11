import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalNuevoPresupuesto } from './ModalNuevoPresupuesto'

describe('ModalNuevoPresupuesto BP07', () => {
  it('renderiza modal con vista simplificada por defecto', () => {
    render(<ModalNuevoPresupuesto onCerrar={vi.fn()} />)
    expect(screen.getByTestId('modal-nuevo-presupuesto')).toBeInTheDocument()
    expect(screen.getByTestId('presupuesto-vista-simplificada')).toBeInTheDocument()
    expect(screen.getByText(/Fase urgencias/i)).toBeInTheDocument()
  })

  it('permite alternar entre vista simplificada y detallada', () => {
    render(<ModalNuevoPresupuesto onCerrar={vi.fn()} />)

    // Cambiar a detallada
    fireEvent.click(screen.getByTestId('btn-vista-detallada'))
    expect(screen.getByTestId('presupuesto-vista-detallada')).toBeInTheDocument()

    // Volver a simplificada
    fireEvent.click(screen.getByTestId('btn-vista-simplificada'))
    expect(screen.getByTestId('presupuesto-vista-simplificada')).toBeInTheDocument()
  })

  it('crea el presupuesto y llama a onGuardar con boton Guardar presupuesto', () => {
    const onGuardar = vi.fn()
    render(<ModalNuevoPresupuesto onGuardar={onGuardar} onCerrar={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-guardar-presupuesto'))
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'borrador' })
    )
  })

  it('abre modal para configurar cuota', () => {
    render(<ModalNuevoPresupuesto onCerrar={vi.fn()} />)
    fireEvent.click(screen.getByTestId('btn-configurar-cuota'))
    expect(screen.getByTestId('modal-configurar-cuotas')).toBeInTheDocument()
  })

  it('aplica bonificación automática de convenio FONASA o ISAPRE', () => {
    render(<ModalNuevoPresupuesto onCerrar={vi.fn()} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'fonasa' } })
    expect(screen.getByText(/Descuento Convenio:/i)).toHaveTextContent('15%')
  })
})
