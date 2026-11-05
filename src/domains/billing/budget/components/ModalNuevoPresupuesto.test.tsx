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

vi.mock('../../../organization/clinic/hooks/useConfiguracionConvenios', () => ({
  useConfiguracionConvenios: () => ({ configuracion: config, cargando: false, cargada: true, error: null }),
}))

vi.mock('../../../organization/clinic/hooks/useSedes', () => ({
  useSedes: () => ({ sedeActivaId: null, cargando: false, errorSincronizacion: null }),
}))

vi.mock('../../../../shared/hooks/useAppDialog', () => ({
  useAppDialog: () => ({ alert: vi.fn().mockResolvedValue(true) }),
}))

describe('ModalNuevoPresupuesto precios BP08', () => {
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

  it('usa el precio FONASA del catálogo cuando no hay convenio ni regla fija configurada', async () => {
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
      items: [expect.objectContaining({ convenio: 'FONASA', convenioId: 'fonasa', precioBase: 80000, valor: 80000 })],
    })))
  })
})
