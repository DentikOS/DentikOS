import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Recetas } from './Recetas'
import type { Paciente } from '../../../schemas/pacienteSchema'
import { REALTIME_EVENTS } from '../../../../../../infrastructure/realtime/realtimeEvents'

const mocks = vi.hoisted(() => ({ listar: vi.fn(), guardar: vi.fn() }))

vi.mock('../../../services/recetasCanonicasStorageService', () => ({
  recetasCanonicasStorageService: { listar: mocks.listar, guardar: mocks.guardar },
}))

vi.mock('../../../services/recetaHash', () => ({
  generarHashReceta: vi.fn().mockResolvedValue('a'.repeat(64)),
}))

const PACIENTE_MOCK: Paciente = {
  id: 'pac-1',
  nombre: 'Marta Pérez',
  rut: '12.345.678-9',
  alergias: 'Ninguna',
  estado: 'activo'
}

const RECETA_MOCK = {
  id: 'dddddddd-0000-4000-8000-000000000004',
  user_id: 'cccccccc-0000-4000-8000-000000000003',
  paciente_id: 'bbbbbbbb-0000-4000-8000-000000000002',
  clinica_id: 'aaaaaaaa-0000-4000-8000-000000000001',
  fecha: '2026-11-05',
  profesional: 'Dra. Ejemplo',
  medicamentos: [{ nombre: 'Amoxicilina 500 mg', dosis: '500 mg', frecuencia: 'Cada 8 horas', duracion: '7 días' }],
  diagnostico: null,
  indicaciones: 'Seguir la pauta indicada.',
  firma: null,
  hash_forense: 'a'.repeat(64),
  qr_token: 'token-de-prueba',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listar.mockResolvedValue([])
  mocks.guardar.mockResolvedValue(RECETA_MOCK)
})

describe('Recetas con autocompletado Vademécum', () => {
  it('inicia sin medicamento, posología ni indicaciones precargadas', () => {
    const { container } = render(<Recetas paciente={PACIENTE_MOCK} />)

    expect(screen.getByTestId('input-medicamento-vademecum')).toHaveValue('')
    expect(screen.getByPlaceholderText('Dosis')).toHaveValue('')
    expect(screen.getByPlaceholderText('Frecuencia')).toHaveValue('')
    expect(screen.getByPlaceholderText('Duración')).toHaveValue('')
    expect(container.querySelector('textarea')).toHaveValue('')
  })

  it('permite buscar y autocompletar fármacos desde el Vademécum', () => {
    render(<Recetas paciente={PACIENTE_MOCK} />)

    const input = screen.getByTestId('input-medicamento-vademecum')
    fireEvent.change(input, { target: { value: 'Amoxi' } })

    const sugerencias = screen.getAllByTestId('item-sugerencia-vademecum')
    expect(sugerencias.length).toBeGreaterThan(0)
    expect(sugerencias[0].textContent).toContain('Amoxicilina')

    fireEvent.click(sugerencias[0])
    expect((input as HTMLInputElement).value).toContain('Amoxicilina')
  })

  it('seleccionar un fármaco no asigna dosis, frecuencia ni duración automáticas', () => {
    render(<Recetas paciente={PACIENTE_MOCK} />)

    fireEvent.change(screen.getByTestId('input-medicamento-vademecum'), { target: { value: 'Amoxi' } })
    fireEvent.click(screen.getAllByTestId('item-sugerencia-vademecum')[0])

    expect(screen.getByPlaceholderText('Dosis')).toHaveValue('')
    expect(screen.getByPlaceholderText('Frecuencia')).toHaveValue('')
    expect(screen.getByPlaceholderText('Duración')).toHaveValue('')
  })

  it('detecta conflicto y alerta cuando el paciente es alérgico a Penicilina', () => {
    const pacienteAlergico: Paciente = {
      ...PACIENTE_MOCK,
      alergias: 'Penicilina (Shock anafiláctico)',
    }
    render(<Recetas paciente={pacienteAlergico} />)
    fireEvent.change(screen.getByTestId('input-medicamento-vademecum'), { target: { value: 'Amoxi' } })
    fireEvent.click(screen.getAllByTestId('item-sugerencia-vademecum')[0])
    expect(screen.getByRole('alert')).toHaveTextContent('contraindicado por alergia a penicilinas')
  })

  it('confirma el guardado remoto antes de mostrar la receta como emitida', async () => {
    render(<Recetas paciente={PACIENTE_MOCK} profesional="Dra. Ejemplo" />)
    fireEvent.change(screen.getByTestId('input-medicamento-vademecum'), { target: { value: 'Amoxi' } })
    fireEvent.click(screen.getAllByTestId('item-sugerencia-vademecum')[0])
    fireEvent.change(screen.getByPlaceholderText('Dosis'), { target: { value: '500 mg' } })
    fireEvent.change(screen.getByPlaceholderText('Frecuencia'), { target: { value: 'Cada 8 horas' } })
    fireEvent.change(screen.getByPlaceholderText('Duración'), { target: { value: '7 días' } })
    fireEvent.change(screen.getByLabelText('Indicaciones Adicionales'), { target: { value: 'Seguir la pauta indicada.' } })
    const btnEmitir = screen.getByRole('button', { name: /Emitir receta/i })
    fireEvent.click(btnEmitir)

    await screen.findByText('Receta guardada en Supabase')
    expect(screen.getByTestId('recetas-emitidas-lista')).toBeInTheDocument()
    expect(screen.getByText(/Trazabilidad:/i)).toBeInTheDocument()
    expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({
      paciente_id: PACIENTE_MOCK.id,
      indicaciones: 'Seguir la pauta indicada.',
      firma: null,
    }))
  })

  it('exige dosis, frecuencia y duración antes de emitir', async () => {
    const { container } = render(<Recetas paciente={PACIENTE_MOCK} profesional="Dra. Ejemplo" />)
    fireEvent.change(screen.getByTestId('input-medicamento-vademecum'), { target: { value: 'Amoxicilina manual' } })
    fireEvent.change(screen.getByPlaceholderText('Dosis'), { target: { value: '500 mg' } })

    fireEvent.submit(container.querySelector('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(/dosis, frecuencia y duración/i)
    expect(mocks.guardar).not.toHaveBeenCalled()
    expect(screen.queryByText('Receta guardada en Supabase')).not.toBeInTheDocument()
  })

  it('no muestra éxito ni agrega la receta si Supabase no confirma el guardado', async () => {
    mocks.guardar.mockRejectedValueOnce(new Error('Fallo de red'))
    render(<Recetas paciente={PACIENTE_MOCK} profesional="Dra. Ejemplo" />)
    fireEvent.change(screen.getByTestId('input-medicamento-vademecum'), { target: { value: 'Amoxicilina manual' } })
    fireEvent.change(screen.getByPlaceholderText('Dosis'), { target: { value: '500 mg' } })
    fireEvent.change(screen.getByPlaceholderText('Frecuencia'), { target: { value: 'Cada 8 horas' } })
    fireEvent.change(screen.getByPlaceholderText('Duración'), { target: { value: '7 días' } })
    fireEvent.click(screen.getByRole('button', { name: /Emitir receta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Fallo de red/)
    expect(screen.queryByText('Receta guardada en Supabase')).not.toBeInTheDocument()
    expect(screen.queryByTestId('recetas-emitidas-lista')).not.toBeInTheDocument()
  })

  it('advierte que la receta no tiene firma electrónica ni QR verificable', () => {
    render(<Recetas paciente={PACIENTE_MOCK} />)
    expect(screen.getByRole('note')).toHaveTextContent(/no incluye firma electrónica ni QR verificable/i)
  })

  it('recarga la lista cuando Realtime anuncia cambios de ese paciente', async () => {
    render(<Recetas paciente={PACIENTE_MOCK} />)
    await waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
    mocks.listar.mockClear()

    window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.RECETAS_CHANGED, {
      detail: { new: { paciente_id: PACIENTE_MOCK.id } },
    }))

    await waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
  })
})
