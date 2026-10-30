import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ModalNuevoPaciente } from './components/ModalNuevoPaciente'
import { FichaClinica } from './components/ficha/FichaClinica'
import { ModalNuevoPresupuesto } from '../../billing/budget/components/modal/ModalNuevoPresupuesto'
import { ModalRegistrarPago } from '../../billing/budget/components/modal/ModalRegistrarPago'
import { fichasClinicasStorageService } from './services/fichasClinicasStorageService'
import type { Paciente } from './schemas/pacienteSchema'

vi.mock('./services/fichasClinicasStorageService', () => ({
  fichasClinicasStorageService: {
    obtenerFichaClinica: vi.fn(),
    guardarSeccionFicha: vi.fn(),
    suscribirCambiosFicha: vi.fn(() => () => {}),
  },
}))

describe('Flujo Clínico E2E de Persistencia BP06 + BP07', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      id: 'ficha-e2e',
      paciente_id: 'pac-e2e',
      clinica_id: 'clinica-1',
      odontograma: { piezas: [] },
      periodontograma: [],
      evoluciones: [],
      recetas: [],
      consentimientos: [],
      adjuntos: [],
    } as any)
    vi.mocked(fichasClinicasStorageService.guardarSeccionFicha).mockResolvedValue({
      success: true,
    } as any)
  })

  it('valida flujo completo: creación de paciente con 3 campos obligatorios', () => {
    const onGuardar = vi.fn()
    render(
      <ModalNuevoPaciente
        pacientes={[]}
        alGuardar={onGuardar}
        alCerrar={vi.fn()}
      />
    )

    const inputNombre = screen.getByTestId('paciente-nombre')
    const inputRut = screen.getByTestId('paciente-rut')
    const inputTel = screen.getByTestId('paciente-telefono')
    const btnGuardar = screen.getByTestId('paciente-crear')

    // Botón deshabilitado si falta teléfono
    fireEvent.change(inputNombre, { target: { value: 'Francisca Lagos' } })
    fireEvent.change(inputRut, { target: { value: '12.345.678-5' } })
    expect(btnGuardar).toBeDisabled()

    // Con teléfono válido se habilita y guarda
    fireEvent.change(inputTel, { target: { value: '+56 9 8765 4321' } })
    expect(btnGuardar).not.toBeDisabled()

    fireEvent.click(btnGuardar)
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Francisca Lagos',
        rut: '12.345.678-5',
        telefono: '+56 9 8765 4321',
      })
    )
  })

  it('navega por pestañas clínicas de FichaClinica y monta módulos', async () => {
    const pacienteMock: Paciente = {
      id: 'pac-e2e',
      nombre: 'Francisca Lagos',
      rut: '12.345.678-5',
      telefono: '+56 9 8765 4321',
      alergias: 'Penicilina',
      estado: 'activo',
    }

    render(<FichaClinica paciente={pacienteMock} pacienteId="pac-e2e" />)

    // Alerta severa en header
    expect(screen.getByTestId('badge-alergia-severa')).toBeInTheDocument()

    // Cambiar a pestaña Recetas + Consentimientos + Docs
    const btnDocs = screen.getByRole('button', { name: /Recetas \+ Consentimientos \+ Docs/i })
    fireEvent.click(btnDocs)
    const subtabFotos = screen.getByTestId('subtab-adjuntos')
    fireEvent.click(subtabFotos)
    await waitFor(() => {
      expect(screen.getByTestId('adjuntos-section')).toBeInTheDocument()
    })
  })

  it('emite presupuesto con convenio ISAPRE y luego registra pago manual', () => {
    const onGuardarPresupuesto = vi.fn()
    render(
      <ModalNuevoPresupuesto
        pacienteId="pac-e2e"
        pacienteNombre="Francisca Lagos"
        onGuardar={onGuardarPresupuesto}
        onCerrar={vi.fn()}
      />
    )

    // Seleccionar previsión Banmédica (20% convenio)
    const selectPrevision = screen.getByRole('combobox')
    fireEvent.change(selectPrevision, { target: { value: 'banmedica' } })
    expect(screen.getAllByText(/20%/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId('btn-guardar-presupuesto'))
    expect(onGuardarPresupuesto).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: 'borrador',
        prevision: 'banmedica',
      })
    )

    // Registrar pago para liquidar presupuesto
    const onRegistrarPago = vi.fn()
    render(
      <ModalRegistrarPago
        saldoPendiente={300000}
        totalPresupuesto={300000}
        folioPresupuesto="PRE-2026-0042"
        onRegistrarPago={onRegistrarPago}
        onCerrar={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('btn-confirmar-registro-pago'))
    expect(onRegistrarPago).toHaveBeenCalledWith(
      expect.objectContaining({
        monto: 300000,
        nuevoEstado: 'completado',
      })
    )
  })
})
