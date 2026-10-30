import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalNuevoPresupuesto } from './ModalNuevoPresupuesto'

vi.mock('../../../cash-register/services/finanzasStorageService', () => ({
  finanzasStorageService: { obtenerConvenios: vi.fn(() => []) },
}))

const props = {
  pacienteId: 'paciente-1',
  pacienteNombre: 'Paciente Real',
  onGuardar: vi.fn(),
  onCerrar: vi.fn(),
}

const itemsIniciales = [{
  id: 'item-1', nombrePrestacion: 'Prestación revisada', cantidad: 1,
  precioUnitario: 42000, descuento: 0, subtotal: 42000, faseClinica: 'estabilizacion' as const,
}]

describe('ModalNuevoPresupuesto BP07', () => {
  it('abre sin prestaciones ficticias ni descuentos automáticos', () => {
    render(<ModalNuevoPresupuesto {...props} />)
    expect(screen.getByTestId('presupuesto-vista-simplificada')).toBeInTheDocument()
    expect(screen.getByText(/Fase urgencias/i)).toBeInTheDocument()
    expect(screen.getByText(/Total Bruto:/i)).toHaveTextContent('$0')
    expect(screen.queryByText(/Evaluación y Diagnóstico Integral/i)).not.toBeInTheDocument()
  })

  it('alterna vistas y configura cuotas sobre items reales', () => {
    render(<ModalNuevoPresupuesto {...props} itemsIniciales={itemsIniciales} />)
    fireEvent.click(screen.getByTestId('btn-vista-detallada'))
    expect(screen.getByTestId('presupuesto-vista-detallada')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-vista-simplificada'))
    expect(screen.getByTestId('presupuesto-vista-simplificada')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-configurar-cuota'))
    expect(screen.getByTestId('modal-configurar-cuotas')).toBeInTheDocument()
  })

  it('guarda un borrador solo con prestaciones revisadas', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true)
    const onCerrar = vi.fn()
    render(<ModalNuevoPresupuesto {...props} itemsIniciales={itemsIniciales} onGuardar={onGuardar} onCerrar={onCerrar} />)
    fireEvent.click(screen.getByTestId('btn-guardar-presupuesto'))
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({
      pacienteId: 'paciente-1', estado: 'borrador', totalAPagar: 42000,
    })))
    expect(onCerrar).toHaveBeenCalled()
  })

  it('mantiene abierto el borrador cuando falla el guardado', async () => {
    const onCerrar = vi.fn()
    render(<ModalNuevoPresupuesto {...props} itemsIniciales={itemsIniciales} onGuardar={vi.fn().mockResolvedValue(false)} onCerrar={onCerrar} />)
    fireEvent.click(screen.getByTestId('btn-guardar-presupuesto'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar'))
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
