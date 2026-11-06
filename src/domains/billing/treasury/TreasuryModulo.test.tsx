import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { TreasuryModulo } from './TreasuryModulo'

vi.mock('./hooks/useTreasury', () => ({
  useTreasury: () => ({
    snapshot: null,
    loading: false,
    error: null,
    online: true,
    refrescar: vi.fn(),
    acciones: {}
  })
}))

describe('TreasuryModulo', () => {
  beforeEach(() => {
    useSesionStore.setState({ userProfile: null })
  })

  it('muestra caja y no expone módulos administrativos a recepción', () => {
    useSesionStore.setState({ userProfile: { rol: 'recepcion', email: 'recepcion@example.test', nombreCompleto: 'Recepción' } })

    render(<TreasuryModulo />)

    expect(screen.getByRole('heading', { name: 'Caja' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conciliación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cartera' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gastos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Libros' })).not.toBeInTheDocument()
  })

  it('admin ve las áreas CORE y Finanzas ya no ofrece borrar pagos o abonos', () => {
    useSesionStore.setState({ userProfile: { rol: 'admin', email: 'admin@example.test', nombreCompleto: 'Admin' } })

    render(<TreasuryModulo />)

    for (const area of ['Caja', 'Conciliación', 'Cartera', 'Gastos', 'Bonos', 'Libros', 'Flujo', 'Reportes']) {
      expect(screen.getByRole('button', { name: area })).toBeInTheDocument()
    }
    expect(screen.queryByText(/historial global de movimientos/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /eliminar|borrar pago|borrar abono/i })).not.toBeInTheDocument()
  })

  it.each(['dentista', 'asistente', 'otro'])('%s no obtiene la ruta BP15', (rol) => {
    useSesionStore.setState({ userProfile: { rol, email: 'usuario@example.test', nombreCompleto: 'Usuario' } })

    render(<TreasuryModulo />)

    expect(screen.getByRole('heading', { name: 'Acceso no disponible' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Caja' })).not.toBeInTheDocument()
  })
})
