import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  crear: vi.fn(),
  actualizar: vi.fn(),
  useBoxesClinicos: vi.fn(),
}))

vi.mock('../hooks/useBoxesClinicos', () => ({
  useBoxesClinicos: (...args) => {
    mocks.useBoxesClinicos(...args)
    return { boxes: [], cargando: false, error: null, recargar: vi.fn(), crear: mocks.crear, actualizar: mocks.actualizar }
  },
}))

vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: (selector) => selector({ clinicaActual: '00000000-0000-4000-8000-000000000001' }),
}))

import { GestionBoxesClinicos } from './GestionBoxesClinicos'

const sede = {
  id: '00000000-0000-4000-8000-000000000010',
  clinicaId: '00000000-0000-4000-8000-000000000001',
  nombre: 'Sucursal Central',
  direccion: 'Av. Providencia 123',
  comuna: 'Providencia',
  region: 'Metropolitana',
  telefono: '+56 2 2345 6789',
  activa: true,
  estado: 'activa',
}

describe('GestionBoxesClinicos', () => {
  beforeEach(() => {
    mocks.crear.mockReset().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000020' })
    mocks.actualizar.mockReset().mockResolvedValue({})
    mocks.useBoxesClinicos.mockReset()
  })

  it('guarda la unidad dental y el equipamiento elegido para la sucursal activa', async () => {
    render(<GestionBoxesClinicos sede={sede} puedeAdministrar />)
    fireEvent.change(screen.getByLabelText('Nombre del box'), { target: { value: 'Box Cirugía' } })
    fireEvent.change(screen.getByLabelText('Tipo de box'), { target: { value: 'cirugia' } })
    fireEvent.change(screen.getByLabelText('Unidad dental'), { target: { value: 'Planmeca E1' } })
    fireEvent.click(screen.getByLabelText('Láser dental'))
    fireEvent.change(screen.getByLabelText('Láser dental marca'), { target: { value: 'Biolase' } })
    fireEvent.change(screen.getByLabelText('Láser dental número de serie'), { target: { value: 'BL-2024-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar box' }))

    await waitFor(() => expect(mocks.crear).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Box Cirugía',
      tipo: 'cirugia',
      unidadDental: 'Planmeca E1',
      equipamiento: [{ tipo: 'laser_dental', marca: 'Biolase', serial: 'BL-2024-001' }],
    })))
    expect(mocks.useBoxesClinicos).toHaveBeenCalledWith(sede.id)
  })

  it('no muestra controles de modificación a usuarios sin rol administrador', () => {
    render(<GestionBoxesClinicos sede={sede} puedeAdministrar={false} />)

    expect(screen.queryByRole('button', { name: 'Registrar box' })).not.toBeInTheDocument()
    expect(screen.getByText(/Solo administración clínica puede registrar o modificar boxes/i)).toBeInTheDocument()
  })

  it('explica que la sede principal de la clínica se completa y lleva a configurarla', () => {
    const onIrAConfigurarSedePrincipal = vi.fn()
    render(<GestionBoxesClinicos sede={null} puedeAdministrar sucursalesRegistradas={0} onIrAConfigurarSedePrincipal={onIrAConfigurarSedePrincipal} />)

    expect(screen.getByText(/la sede principal de esta clínica aún no está configurada/i)).toBeInTheDocument()
    expect(screen.getByText(/quedará seleccionada automáticamente para gestionar boxes/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Completar sede principal' }))
    expect(onIrAConfigurarSedePrincipal).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Selecciona una sucursal activa/i)).not.toBeInTheDocument()
  })

  it('distingue las sucursales registradas pero inactivas de una clínica sin sucursales', () => {
    render(<GestionBoxesClinicos sede={null} puedeAdministrar sucursalesRegistradas={1} />)

    expect(screen.getByText(/Activa una de las sucursales registradas o registra una nueva/i)).toBeInTheDocument()
  })
})
