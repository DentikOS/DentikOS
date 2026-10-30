import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FichaDerivacionModal } from './FichaDerivacionModal'

describe('FichaDerivacionModal', () => {
  it('conserva el formulario y muestra error si no se pudo persistir', async () => {
    const onCerrar = vi.fn()
    const onDerivar = vi.fn().mockRejectedValue(new Error('No se pudo guardar la derivación clínica.'))
    render(<FichaDerivacionModal nombrePaciente="Paciente" onCerrar={onCerrar} onDerivar={onDerivar} />)
    fireEvent.change(screen.getByLabelText('Diagnóstico de derivación'), { target: { value: 'Diagnóstico revisado' } })
    fireEvent.change(screen.getByPlaceholderText(/Describa el motivo/), { target: { value: 'Hallazgo revisado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Emitir Derivación' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar'))
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText(/Describa el motivo/)).toHaveValue('Hallazgo revisado')
  })

  it('cierra solo después del guardado confirmado', async () => {
    const onCerrar = vi.fn()
    const onDerivar = vi.fn().mockResolvedValue(undefined)
    render(<FichaDerivacionModal nombrePaciente="Paciente" onCerrar={onCerrar} onDerivar={onDerivar} />)
    fireEvent.change(screen.getByLabelText('Diagnóstico de derivación'), { target: { value: 'Diagnóstico revisado' } })
    fireEvent.change(screen.getByPlaceholderText(/Describa el motivo/), { target: { value: 'Hallazgo revisado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Emitir Derivación' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalledOnce())
    expect(onDerivar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'Hallazgo revisado', diagnostico: 'Diagnóstico revisado' }))
  })
})
