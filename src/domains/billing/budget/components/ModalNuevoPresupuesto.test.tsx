import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalNuevoPresupuesto } from './ModalNuevoPresupuesto'

const { config } = vi.hoisted(() => ({ config: {
  version: 1 as const,
  categorias: [{ id: 'endo', nombre: 'Endodoncia', especialidades: ['Endodoncia'] }],
  convenios: [{ id: 'seguro-1', nombre: 'Seguro Uno', tipo: 'isapre' as const, activo: true, descuentosPorCategoria: { endo: 20 } }],
  preciosEspecificos: [{ prestacionId: '8', alcance: 'convenio' as const, contextoId: 'seguro-1', precio: 70000 }],
} }))
const { configFinanciera } = vi.hoisted(() => ({ configFinanciera: {
  version: 1 as const,
  validezPresupuestoDias: 15,
  maximoCuotasSinInteres: 6,
  frecuenciaCuotas: 'mensual' as const,
  descuentoMaximoPermitidoPct: 50,
  requiereMotivoDescuento: true,
  firmaObligatoriaPresupuesto: false,
  abonoMinimoParaAprobarPct: 0,
  mediosPagoAceptados: ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque'] as const,
  recordatorios: { activados: true, presupuestoSinRespuesta: true, presupuestoPorVencer: true, presupuestoVencido: true, cuotasPendientes: true },
} }))

vi.mock('../../../organization/clinic/hooks/useConfiguracionConvenios', () => ({
  useConfiguracionConvenios: () => ({ configuracion: config, cargando: false, cargada: true, error: null }),
}))

vi.mock('../../../organization/clinic/hooks/useConfiguracionFinanciera', () => ({
  useConfiguracionFinanciera: () => ({ configuracion: configFinanciera, cargando: false, cargada: true, error: null }),
}))

vi.mock('../../../organization/clinic/hooks/useSedes', () => ({
  useSedes: () => ({ sedeActivaId: null, cargando: false, errorSincronizacion: null }),
}))

vi.mock('../../../../shared/hooks/useAppDialog', () => ({
  useAppDialog: () => ({ alert: vi.fn().mockResolvedValue(true) }),
}))

describe('ModalNuevoPresupuesto precios BP08', () => {
  it('usa la validez financiera compartida al crear un presupuesto nuevo', async () => {
    const alGuardar = vi.fn().mockResolvedValue(true)
    render(<ModalNuevoPresupuesto
      pacientes={[{ id: 'paciente-1', nombre: 'Ana Test', rut: '12.345.678-5' }]}
      prestaciones={[{ id: 8, nombre: 'Endodoncia', precioParticular: 100000 }]}
      alGuardar={alGuardar}
      alCerrar={vi.fn()}
    />)

    fireEvent.change(screen.getByDisplayValue('-- Seleccionar Paciente --'), { target: { value: 'paciente-1' } })
    fireEvent.change(screen.getByDisplayValue('-- Seleccionar Prestación --'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({ vigenciaDias: 15 })))
  })

  it('guarda el precio fijo del convenio en el snapshot del presupuesto', async () => {
    const alGuardar = vi.fn().mockResolvedValue(true)
    render(<ModalNuevoPresupuesto
      pacientes={[{ id: 'paciente-1', nombre: 'Ana Test', rut: '12.345.678-5', prevision: 'seguro-1' }]}
      prestaciones={[{ id: 8, nombre: 'Endodoncia', especialidad: 'Endodoncia', precioParticular: 100000, precioFonasa: 80000 }]}
      alGuardar={alGuardar}
      alCerrar={vi.fn()}
    />)

    fireEvent.change(screen.getByDisplayValue('-- Seleccionar Paciente --'), { target: { value: 'paciente-1' } })
    fireEvent.change(screen.getByDisplayValue('-- Seleccionar Prestación --'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({
        prestacionId: 8,
        precioBase: 70000,
        descuentoPct: 0,
        precioOrigen: 'convenio-precio-fijo',
        valor: 70000,
      })],
    })))
  })

  it('usa el precio base del catálogo para FONASA e ignora la tarifa heredada', async () => {
    const alGuardar = vi.fn().mockResolvedValue(true)
    render(<ModalNuevoPresupuesto
      pacientes={[{ id: 'paciente-2', nombre: 'Luis Test', rut: '12.345.678-5', prevision: 'FONASA' }]}
      prestaciones={[{ id: 8, nombre: 'Endodoncia', especialidad: 'Endodoncia', precioParticular: 100000, precioFonasa: 80000 }]}
      alGuardar={alGuardar}
      alCerrar={vi.fn()}
    />)

    fireEvent.change(screen.getByDisplayValue('-- Seleccionar Paciente --'), { target: { value: 'paciente-2' } })
    fireEvent.change(screen.getByDisplayValue('-- Seleccionar Prestación --'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ convenio: 'FONASA', convenioId: 'fonasa', precioBase: 100000, valor: 100000 })],
    })))
  })

  it('incluye productos de inventario con cantidad, precio e IVA en el borrador', async () => {
    const alGuardar = vi.fn().mockResolvedValue(true)
    render(<ModalNuevoPresupuesto
      pacientes={[{ id: 'paciente-1', nombre: 'Ana Test', rut: '12.345.678-5' }]}
      productosInventario={[{
        id: '33333333-4444-4555-8666-777777777777',
        nombre: 'Cepillo dental', unidad: 'Unidades', precioVenta: 1000, ivaPorcentaje: 19
      }]}
      alGuardar={alGuardar}
      alCerrar={vi.fn()}
    />)

    fireEvent.change(screen.getByDisplayValue('-- Seleccionar Paciente --'), { target: { value: 'paciente-1' } })
    fireEvent.change(screen.getByDisplayValue('-- Seleccionar producto --'), { target: { value: '33333333-4444-4555-8666-777777777777' } })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir producto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({
      montoTotal: 2380,
      items: [expect.objectContaining({
        inventarioId: '33333333-4444-4555-8666-777777777777',
        cantidadInventario: 2,
        precioUnitarioInventario: 1000,
        ivaPorcentajeInventario: 19,
        valor: 2380,
      })],
    })))
  })
})
