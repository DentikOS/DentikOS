import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaquetesClinicosManager } from './PaquetesClinicosManager'

const dialogs = vi.hoisted(() => ({ alert: vi.fn() }))

vi.mock('../../../../shared/hooks/useAppDialog', () => ({
  useAppDialog: () => ({ alert: dialogs.alert }),
}))

describe('PaquetesClinicosManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dialogs.alert.mockResolvedValue(undefined)
  })

  it('permite compartir con la clínica los metadatos locales de un pack legado', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined)
    render(<PaquetesClinicosManager
      paquetes={[{
        id: '33333333-3333-4333-8333-333333333333',
        nombre: 'Pack evaluación',
        descripcion: 'Evaluación y limpieza',
        precioCombo: 50000,
        ahorroEstimado: '15%',
        pendienteCompartir: true,
      }]}
      alGuardarPaquete={guardar}
      alEliminarPaquete={vi.fn().mockResolvedValue(undefined)}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Compartir con la clínica' }))

    await waitFor(() => expect(guardar).toHaveBeenCalledWith({
      id: '33333333-3333-4333-8333-333333333333',
      nombre: 'Pack evaluación',
      descripcion: 'Evaluación y limpieza',
      precioCombo: 50000,
      ahorroEstimado: '15%',
    }))
    expect(dialogs.alert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pack compartido' }))
  })
})
