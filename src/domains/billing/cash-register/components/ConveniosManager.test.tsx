import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearConfiguracionConveniosVacia } from '../../../organization/clinic/schemas/configuracionConveniosSchema'
import type { ConfiguracionConvenios } from '../../../organization/clinic/schemas/configuracionConveniosSchema'

const { guardarMock, hookState } = vi.hoisted(() => {
  const guardarMock = vi.fn()
  return {
    guardarMock,
    hookState: {
    configuracion: { version: 1 as const, categorias: [], convenios: [] } as ConfiguracionConvenios,
    cargando: false,
    cargada: true,
    guardando: false,
    error: null as string | null,
    esAdmin: true,
    guardar: guardarMock,
    },
  }
})

vi.mock('../../../organization/clinic/hooks/useConfiguracionConvenios', () => ({
  useConfiguracionConvenios: () => hookState,
}))

import { ConveniosManager } from './ConveniosManager'

describe('ConveniosManager compartido por clínica', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState.configuracion = crearConfiguracionConveniosVacia()
    hookState.cargando = false
    hookState.cargada = true
    hookState.guardando = false
    hookState.error = null
    hookState.esAdmin = true
    guardarMock.mockResolvedValue(true)
  })

  it('parte sin convenios ni porcentajes de ejemplo', () => {
    render(<ConveniosManager />)
    expect(screen.getByText(/Aún no hay convenios/i)).toBeInTheDocument()
    expect(screen.getByText(/parte sin convenios ni descuentos precargados/i)).toBeInTheDocument()
  })

  it('permite configurar y guardar una tasa por convenio y especialidad', async () => {
    render(<ConveniosManager />)
    fireEvent.change(screen.getByPlaceholderText('Nombre de la entidad o plan'), { target: { value: 'Isapre Uno' } })
    fireEvent.click(screen.getAllByRole('button').find((button) => button.textContent?.trim() === 'Agregar')!)
    fireEvent.change(screen.getByLabelText('Categoría de Endodoncia'), { target: { value: 'endodoncia' } })
    fireEvent.change(screen.getByLabelText('Descuento Endodoncia para Isapre Uno'), { target: { value: '12.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración compartida/i }))

    await waitFor(() => expect(guardarMock).toHaveBeenCalledWith(expect.objectContaining({
      categorias: expect.arrayContaining([expect.objectContaining({
        id: 'endodoncia',
        especialidades: expect.arrayContaining(['Endodoncia']),
      })]),
      convenios: [expect.objectContaining({
        nombre: 'Isapre Uno',
        descuentosPorCategoria: expect.objectContaining({ endodoncia: 12.5 }),
      })],
    })))
  })

  it('mantiene la configuración visible pero bloquea edición a roles distintos de admin', () => {
    hookState.configuracion = {
      ...crearConfiguracionConveniosVacia(),
      convenios: [{ id: 'isapre-1', nombre: 'Isapre Uno', tipo: 'isapre', activo: true, descuentosPorCategoria: {} }],
    }
    hookState.esAdmin = false
    render(<ConveniosManager />)
    expect(screen.getByText(/Solo un administrador/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Isapre Uno')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar configuración compartida/i })).not.toBeInTheDocument()
  })
})
