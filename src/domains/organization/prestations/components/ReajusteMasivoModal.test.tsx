import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReajusteMasivoModal } from './ReajusteMasivoModal'

const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }))

vi.mock('../../../../shared/hooks/useAppDialog', () => ({
  useAppDialog: () => dialogs,
}))

describe('ReajusteMasivoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dialogs.confirm.mockResolvedValue(true)
    dialogs.alert.mockResolvedValue(undefined)
  })

  it('espera la confirmación remota antes de avisar éxito y cerrar', async () => {
    let confirmarReajuste: (() => void) | undefined
    const aplicar = vi.fn(() => new Promise<void>((resolve) => { confirmarReajuste = resolve }))
    const cerrar = vi.fn()
    render(<ReajusteMasivoModal alAplicarReajuste={aplicar} alCerrar={cerrar} />)

    fireEvent.change(screen.getByLabelText(/Porcentaje de Reajuste/), { target: { value: '7.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Reajuste' }))
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith(7.5))
    expect(dialogs.alert).not.toHaveBeenCalled()
    expect(cerrar).not.toHaveBeenCalled()

    await act(async () => { confirmarReajuste?.() })
    await waitFor(() => expect(dialogs.alert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Arancel reajustado',
    })))
    expect(cerrar).toHaveBeenCalledOnce()
  })

  it('mantiene el modal abierto y muestra el error cuando el reajuste falla', async () => {
    const aplicar = vi.fn().mockRejectedValue(new Error('El arancel cambió desde que se cargó.'))
    const cerrar = vi.fn()
    render(<ReajusteMasivoModal alAplicarReajuste={aplicar} alCerrar={cerrar} />)

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Reajuste' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El arancel cambió desde que se cargó.')
    expect(dialogs.alert).not.toHaveBeenCalled()
    expect(cerrar).not.toHaveBeenCalled()
  })

  it('rechaza porcentajes fuera del rango permitido antes de pedir confirmación', async () => {
    const aplicar = vi.fn().mockResolvedValue(undefined)
    render(<ReajusteMasivoModal alAplicarReajuste={aplicar} alCerrar={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Porcentaje de Reajuste/), { target: { value: '10001' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('entre -100% y 10000%')
    expect(dialogs.confirm).not.toHaveBeenCalled()
    expect(aplicar).not.toHaveBeenCalled()
  })
})
