import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalNuevaOrden } from './ModalNuevaOrden'

vi.mock('../../../../shared/hooks/useAppDialog', () => ({
  useAppDialog: () => ({ alert: vi.fn().mockResolvedValue(undefined) })
}))

vi.mock('../services/laboratorioCloudService', () => ({
  laboratorioCloudService: { generarIdempotencyKey: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
}))

const patientId = '11111111-1111-4111-8111-111111111111'
const tiposTrabajo = [
  { id: 'type-zirconia', categoria: 'protesis_fija' as const, nombre: 'Corona zirconio', diasEstimados: 4, estado: 'activo' as const },
  { id: 'type-old', categoria: 'protesis_fija' as const, nombre: 'Tipo desactivado', diasEstimados: 1, estado: 'inactivo' as const }
]
const plantillas = [{
  id: 'template-zirconia', nombre: 'Corona zirconio', categoria: 'protesis_fija',
  version: 2, dias_estimados: 7, estado: 'activo', descripcion: 'Zirconio',
  etapas: ['solicitud', 'fabricacion', 'entrega'], fotos_requeridas: ['inicial'], campos_personalizados: {}
}]

describe('ModalNuevaOrden', () => {
  it('selecciona el tipo relacionado, estima entrega y guarda una copia de la plantilla', async () => {
    const alGuardar = vi.fn().mockResolvedValue(undefined)
    render(<ModalNuevaOrden
      pacientes={[{ id: patientId, nombre: 'Paciente de prueba' }]}
      tiposTrabajo={tiposTrabajo}
      plantillas={plantillas}
      rol="dentista"
      alGuardar={alGuardar}
      alCerrar={vi.fn()}
    />)

    fireEvent.change(screen.getByLabelText('Plantilla de trabajo'), { target: { value: 'template-zirconia' } })
    expect(screen.getByLabelText('Tipo de trabajo *')).toHaveValue('type-zirconia')
    expect(screen.getByLabelText('Tipo de trabajo *')).not.toHaveDisplayValue('protesis_fija · Tipo desactivado')

    const fechaSolicitud = (screen.getByLabelText(/Fecha de solicitud/) as HTMLInputElement).value
    const [year, month, day] = fechaSolicitud.split('-').map(Number)
    const fechaEsperada = new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10)
    expect(screen.getByLabelText(/Fecha estimada de entrega/) as HTMLInputElement).toHaveValue(fechaEsperada)

    fireEvent.change(screen.getByLabelText('Paciente *'), { target: { value: patientId } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear orden' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({
      pacienteId: patientId,
      tipoTrabajoId: 'type-zirconia',
      plantillaId: 'template-zirconia',
      plantillaSnapshot: expect.objectContaining({ id: 'template-zirconia', version: 2 }),
      fechaEstimadaEntrega: fechaEsperada
    })))
  })
})
