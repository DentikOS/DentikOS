import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PerfilProfesionalForm } from './PerfilProfesionalForm'
import { useSesionStore } from '../../../../app/stores/sesionStore'

// Mock useSesionStore
vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: vi.fn(),
}))

describe('PerfilProfesionalForm - Role-Aware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSesionStore).mockImplementation((selector: any) =>
      selector({
        userProfile: { rol: 'admin' },
      })
    )
  })

  it('muestra campos de odontólogo para rol admin', () => {
    render(<PerfilProfesionalForm alGuardar={vi.fn()} />)

    expect(screen.getByLabelText(/Especialidad Clínica/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/N° Registro ISP/i)).toBeInTheDocument()
    expect(screen.getByText(/Firma Digital/i)).toBeInTheDocument()
  })

  it('oculta campos de odontólogo para rol recepcion', () => {
    vi.mocked(useSesionStore).mockImplementation((selector: any) =>
      selector({
        userProfile: { rol: 'recepcion' },
      })
    )

    render(<PerfilProfesionalForm alGuardar={vi.fn()} />)

    expect(screen.queryByLabelText(/Especialidad Clínica/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/N° Registro ISP/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Firma Digital/i)).not.toBeInTheDocument()
  })

  it('muestra título apropiado según rol', () => {
    render(<PerfilProfesionalForm alGuardar={vi.fn()} />)
    expect(screen.getByText(/Perfil del Odontólogo \/ Profesional/i)).toBeInTheDocument()

    vi.mocked(useSesionStore).mockImplementation((selector: any) =>
      selector({
        userProfile: { rol: 'recepcion' },
      })
    )
    const { rerender } = render(<PerfilProfesionalForm alGuardar={vi.fn()} />)
    rerender(<PerfilProfesionalForm alGuardar={vi.fn()} />)
    expect(screen.getByText(/Perfil de Recepción/i)).toBeInTheDocument()
  })

  it('muestra título para rol asistente', () => {
    vi.mocked(useSesionStore).mockImplementation((selector: any) =>
      selector({
        userProfile: { rol: 'asistente' },
      })
    )

    render(<PerfilProfesionalForm alGuardar={vi.fn()} />)
    expect(screen.getByText(/Perfil del Asistente Dental/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Especialidad Clínica/i)).not.toBeInTheDocument()
  })

  it('exige N° Registro ISP si es odontólogo y muestra error al enviar vacío', async () => {
    const alGuardar = vi.fn()
    render(
      <PerfilProfesionalForm
        userProfile={{ nombreCompleto: 'Dr. Test', rut: '12.345.678-9', numeroRegistroISP: '' }}
        alGuardar={alGuardar}
      />
    )

    const form = screen.getByRole('button', { name: /Guardar Perfil/i }).closest('form')!
    fireEvent.submit(form)

    expect(
      screen.getByText(/El N° de Registro ISP es obligatorio para el ejercicio clínico odontológico/i)
    ).toBeInTheDocument()
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('permite guardar a recepcionista sin campos clínicos', async () => {
    vi.mocked(useSesionStore).mockImplementation((selector: any) =>
      selector({
        userProfile: { rol: 'recepcion' },
      })
    )
    const alGuardar = vi.fn()
    render(<PerfilProfesionalForm alGuardar={alGuardar} />)

    const nombreInput = screen.getByLabelText(/Nombre Completo/i)
    fireEvent.change(nombreInput, { target: { value: 'Laura Recepción' } })

    const btnGuardar = screen.getByRole('button', { name: /Guardar Perfil/i })
    fireEvent.click(btnGuardar)

    expect(alGuardar).toHaveBeenCalledTimes(1)
    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreCompleto: 'Laura Recepción',
        especialidad: undefined,
        registroSalud: undefined,
        numeroRegistroISP: undefined,
        firmaDigital: undefined,
      })
    )
  })
})
