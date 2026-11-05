import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfiguracionFinancieraManager } from './ConfiguracionFinancieraManager'

const { estado } = vi.hoisted(() => ({
  estado: {
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
    guardando: false,
    error: null,
    esAdmin: true,
    guardar: vi.fn(),
  },
}))

vi.mock('../../../organization/clinic/hooks/useConfiguracionFinanciera', () => ({
  useConfiguracionFinanciera: () => estado,
}))

describe('ConfiguracionFinancieraManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    estado.esAdmin = true
  })

  it('muestra los valores compartidos y guarda cambios de forma conjunta', async () => {
    estado.guardar.mockResolvedValue(true)
    render(<ConfiguracionFinancieraManager />)

    expect(screen.getByLabelText('Validez por defecto (días)')).toHaveValue(15)
    fireEvent.change(screen.getByLabelText('Máximo de cuotas sin interés'), { target: { value: '8' } })
    expect(screen.getByRole('checkbox', { name: 'Firma obligatoria en presupuestos' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración financiera' }))

    await waitFor(() => expect(estado.guardar).toHaveBeenCalledWith(expect.objectContaining({
      maximoCuotasSinInteres: 8,
      firmaObligatoriaPresupuesto: false,
    })))
  })

  it('mantiene los cambios de solo lectura para roles distintos a admin', () => {
    estado.esAdmin = false
    render(<ConfiguracionFinancieraManager />)

    expect(screen.getByText(/Solo un administrador/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar configuración financiera' })).not.toBeInTheDocument()
  })
})
