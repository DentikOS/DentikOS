import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalNuevoPresupuesto } from './ModalNuevoPresupuesto'

vi.mock('../../../../organization/clinic/hooks/useConfiguracionFinanciera', () => ({
  useConfiguracionFinanciera: () => ({
    configuracion: {
      version: 1,
      validezPresupuestoDias: 15,
      maximoCuotasSinInteres: 6,
      frecuenciaCuotas: 'mensual',
      descuentoMaximoPermitidoPct: 50,
      requiereMotivoDescuento: true,
      firmaObligatoriaPresupuesto: false,
      abonoMinimoParaAprobarPct: 0,
      mediosPagoAceptados: ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque'],
      recordatorios: { activados: true, presupuestoSinRespuesta: true, presupuestoPorVencer: true, presupuestoVencido: true, cuotasPendientes: true },
    },
    cargando: false,
    cargada: true,
    error: null,
  }),
}))

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
    expect(screen.getByLabelText('Vigencia del Presupuesto (Días)')).toHaveValue(15)
    expect(screen.getByLabelText('Descuento Especial Manual (%)')).toHaveAttribute('max', '50')
    fireEvent.click(screen.getByTestId('btn-guardar-presupuesto'))
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({
      pacienteId: 'paciente-1', estado: 'borrador', totalAPagar: 42000,
    })))
    expect(onCerrar).toHaveBeenCalled()
  })

  it('permite una prestación con precio cero si el presupuesto incluye otros tratamientos', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true)
    const itemsCubiertos = [
      { ...itemsIniciales[0], id: 'item-cubierto', nombrePrestacion: 'Prestación cubierta', precioUnitario: 0, subtotal: 0 },
      itemsIniciales[0],
    ]
    render(<ModalNuevoPresupuesto {...props} itemsIniciales={itemsCubiertos} onGuardar={onGuardar} />)
    fireEvent.click(screen.getByTestId('btn-guardar-presupuesto'))

    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({
      totalAPagar: 42000,
      items: itemsCubiertos,
    })))
  })

  it('mantiene abierto el borrador cuando falla el guardado', async () => {
    const onCerrar = vi.fn()
    render(<ModalNuevoPresupuesto {...props} itemsIniciales={itemsIniciales} onGuardar={vi.fn().mockResolvedValue(false)} onCerrar={onCerrar} />)
    fireEvent.click(screen.getByTestId('btn-guardar-presupuesto'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar'))
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
