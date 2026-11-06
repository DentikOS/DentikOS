import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BootstrapClinica } from './BootstrapClinica'

// Mock del hook useBootstrapClinica
vi.mock('../hooks/useBootstrapClinica', () => ({
  useBootstrapClinica: vi.fn(),
}))

// Mock del hook useAppDialog
vi.mock('../hooks/useAppDialog', () => ({
  useAppDialog: vi.fn(() => ({
    confirm: vi.fn().mockResolvedValue(true),
    alert: vi.fn(),
  })),
}))

import { useBootstrapClinica } from '../hooks/useBootstrapClinica'
import { useAppDialog } from '../hooks/useAppDialog'

describe('BootstrapClinica - 8 Pasos Onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe renderizar el título del wizard y opciones de tipo en paso 1', () => {
    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 1,
      tipoActividad: 'clinica',
      datos: { nombre: '', rutEmpresa: '', direccion: '', telefono: '', emailContacto: '' },
      sedes: [],
      equipo: [],
      errores: {},
      procesando: false,
      errorGeneral: null,
      completado: false,
      setTipoActividad: vi.fn(),
      actualizarCampo: vi.fn(),
      agregarSede: vi.fn(),
      eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(),
      eliminarMiembro: vi.fn(),
      avanzarPaso: vi.fn(),
      retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(),
      handleSubmit: vi.fn(),
      finalizarBienvenida: vi.fn(),
    })

    render(<BootstrapClinica onComplete={vi.fn()} />)

    expect(screen.getByText('Crear tu Clínica')).toBeInTheDocument()
    expect(screen.getByText('Consulta individual')).toBeInTheDocument()
    expect(screen.getByText('Clínica dental')).toBeInTheDocument()
  })

  it('debe mostrar datos requeridos de la clínica en paso 1', () => {
    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 1,
      tipoActividad: 'clinica',
      datos: { nombre: '', rutEmpresa: '', direccion: '', telefono: '', emailContacto: '' },
      sedes: [],
      equipo: [],
      errores: {},
      procesando: false,
      errorGeneral: null,
      completado: false,
      setTipoActividad: vi.fn(),
      actualizarCampo: vi.fn(),
      agregarSede: vi.fn(),
      eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(),
      eliminarMiembro: vi.fn(),
      avanzarPaso: vi.fn(),
      retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(),
      handleSubmit: vi.fn(),
      finalizarBienvenida: vi.fn(),
    })

    render(<BootstrapClinica onComplete={vi.fn()} />)

    expect(screen.getByLabelText(/nombre de la clínica o consulta/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('76.123.456-7')).toBeInTheDocument()
    expect(screen.getByLabelText(/giro comercial/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email de contacto/i)).toBeInTheDocument()
  })

  it('debe mostrar preferencias regionales en paso 2', () => {
    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 2,
      tipoActividad: 'clinica',
      datos: { nombre: 'Clínica Dental Sonrisas', zonaHoraria: 'America/Santiago', moneda: 'CLP', idiomaDocumentos: 'es-CL' },
      sedes: [], equipo: [], errores: {}, procesando: false, errorGeneral: null, completado: false,
      setTipoActividad: vi.fn(), actualizarCampo: vi.fn(), agregarSede: vi.fn(), eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(), eliminarMiembro: vi.fn(), avanzarPaso: vi.fn(), retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(), handleSubmit: vi.fn(), finalizarBienvenida: vi.fn(),
    })

    render(<BootstrapClinica onComplete={vi.fn()} />)

    expect(screen.getByLabelText(/zona horaria/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/idioma de documentos/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/moneda de la clínica/i)).toBeInTheDocument()
  })

  it('debe mostrar plantillas de catálogo en paso 3', () => {
    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 3, tipoActividad: 'clinica', datos: {}, sedes: [], equipo: [], errores: {},
      procesando: false, errorGeneral: null, completado: false,
      setTipoActividad: vi.fn(), actualizarCampo: vi.fn(), agregarSede: vi.fn(), eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(), eliminarMiembro: vi.fn(), avanzarPaso: vi.fn(), retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(), handleSubmit: vi.fn(), finalizarBienvenida: vi.fn(),
      seleccionarPlantilla: vi.fn(), plantillaSeleccionada: null,
    })

    render(<BootstrapClinica onComplete={vi.fn()} />)
    expect(screen.getByText('Clínica General')).toBeInTheDocument()
    expect(screen.getByText('Ortodoncia')).toBeInTheDocument()
    expect(screen.getByText('Cirugía + Rehabilitación')).toBeInTheDocument()
    expect(screen.getByText('Configurar desde cero')).toBeInTheDocument()
  })

  it('debe mostrar sedes en paso 4', () => {
    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 4,
      tipoActividad: 'clinica',
      datos: { nombre: 'Clínica Dental Sonrisas', direccion: 'Av. Providencia 123' },
      sedes: [{ nombre: 'Sede Central', direccion: 'Av. Providencia 123', comuna: 'Providencia', region: 'RM', activa: true }],
      equipo: [],
      errores: {},
      procesando: false,
      errorGeneral: null,
      completado: false,
      setTipoActividad: vi.fn(),
      actualizarCampo: vi.fn(),
      agregarSede: vi.fn(),
      eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(),
      eliminarMiembro: vi.fn(),
      avanzarPaso: vi.fn(),
      retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(),
      handleSubmit: vi.fn(),
      finalizarBienvenida: vi.fn(),
    })

    render(<BootstrapClinica onComplete={vi.fn()} />)

    expect(screen.getByText('Sedes registradas')).toBeInTheDocument()
    expect(screen.getByText('Sede Central')).toBeInTheDocument()
  })

  it('debe mostrar equipo en paso 5 y el cierre en paso 7', () => {
    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 5,
      tipoActividad: 'clinica',
      datos: { nombre: 'Clínica Dental Sonrisas' },
      sedes: [{ nombre: 'Sede Central', direccion: 'Av. Providencia 123', comuna: 'Providencia', region: 'RM', activa: true }],
      equipo: [{ email: 'doctor@sonrisas.cl', rol: 'dentista', sedes: [] }],
      errores: {},
      procesando: false,
      errorGeneral: null,
      completado: false,
      setTipoActividad: vi.fn(),
      actualizarCampo: vi.fn(),
      agregarSede: vi.fn(),
      eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(),
      eliminarMiembro: vi.fn(),
      avanzarPaso: vi.fn(),
      retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(),
      handleSubmit: vi.fn(),
      finalizarBienvenida: vi.fn(),
    })

    const { unmount } = render(<BootstrapClinica onComplete={vi.fn()} />)

    expect(screen.getByText(/invitar colaboradores/i)).toBeInTheDocument()
    unmount()

    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 7, tipoActividad: 'clinica', datos: {}, sedes: [], equipo: [], errores: {},
      procesando: false, errorGeneral: null, completado: false,
      setTipoActividad: vi.fn(), actualizarCampo: vi.fn(), agregarSede: vi.fn(), eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(), eliminarMiembro: vi.fn(), avanzarPaso: vi.fn(), retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(), handleSubmit: vi.fn(), finalizarBienvenida: vi.fn(),
    })
    render(<BootstrapClinica onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /crear y sincronizar clínica/i })).toBeInTheDocument()
  })

  it('debe mostrar PantallaBienvenida al completar el flujo', () => {
    vi.mocked(useBootstrapClinica).mockReturnValue({
      paso: 8,
      tipoActividad: 'clinica',
      datos: { nombre: 'Clínica Dental Sonrisas' },
      sedes: [{ nombre: 'Sede Central', direccion: 'Av. Providencia 123', comuna: 'Providencia', region: 'RM', activa: true }],
      equipo: [],
      errores: {},
      procesando: false,
      errorGeneral: null,
      completado: true,
      setTipoActividad: vi.fn(),
      actualizarCampo: vi.fn(),
      agregarSede: vi.fn(),
      eliminarSede: vi.fn(),
      agregarMiembro: vi.fn(),
      eliminarMiembro: vi.fn(),
      avanzarPaso: vi.fn(),
      retrocederPaso: vi.fn(),
      cancelarConfiguracion: vi.fn(),
      handleSubmit: vi.fn(),
      finalizarBienvenida: vi.fn(),
    })

    render(<BootstrapClinica onComplete={vi.fn()} />)

    expect(screen.getByText(/¡Bienvenido a DentikOS!/i)).toBeInTheDocument()
    expect(screen.getByText(/Ir al Dashboard/i)).toBeInTheDocument()
  })
})

describe('Ruta de escape del onboarding', () => {
  const mockCancelarConfiguracion = vi.fn()
  const mockConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockResolvedValue(true)
    mockCancelarConfiguracion.mockResolvedValue(undefined)

    vi.mocked(useAppDialog).mockReturnValue({
      confirm: mockConfirm,
      alert: vi.fn(),
    })

    // Mock dinámico con estado para simular avance y retroceso de pasos
    vi.mocked(useBootstrapClinica).mockImplementation(() => {
      const [paso, setPaso] = useState(1)
      const [tipoActividad, setTipoActividad] = useState('clinica')
      return {
        paso,
        tipoActividad,
        datos: { nombre: 'Clínica Test', rutEmpresa: '76.123.456-7', giroComercial: 'Servicios odontológicos', direccion: 'Av. Test 123', comuna: 'Central', region: 'RM', telefono: '+56912345678', emailContacto: 'test@clinica.cl' },
        sedes: [{ nombre: 'Sede Principal', direccion: 'Av. Test 123', comuna: 'Central', region: 'RM', activa: true }],
        equipo: [],
        errores: {},
        procesando: false,
        errorGeneral: null,
        completado: false,
        setTipoActividad,
        actualizarCampo: vi.fn(),
        agregarSede: vi.fn(),
        eliminarSede: vi.fn(),
        agregarMiembro: vi.fn(),
        eliminarMiembro: vi.fn(),
        avanzarPaso: () => setPaso((prev) => Math.min(prev + 1, 7)),
        retrocederPaso: () => setPaso((prev) => Math.max(prev - 1, 1)),
        cancelarConfiguracion: mockCancelarConfiguracion,
        handleSubmit: vi.fn(),
        finalizarBienvenida: vi.fn(),
      }
    })
  })

  it('muestra botón Cancelar en el paso 1', () => {
    render(<BootstrapClinica />)
    expect(screen.getByTestId('bootstrap-cancelar')).toBeInTheDocument()
    expect(screen.getByText(/Cancelar y cerrar sesión/i)).toBeInTheDocument()
  })

  it('no muestra botón Anterior en el paso 1', () => {
    render(<BootstrapClinica />)
    expect(screen.queryByText(/Anterior/i)).not.toBeInTheDocument()
  })

  it('muestra botón Anterior desde el paso 2', async () => {
    render(<BootstrapClinica />)

    // Seleccionar tipo y avanzar a paso 2
    fireEvent.click(screen.getByText(/Clínica dental/i))
    fireEvent.click(screen.getByText(/Continuar/i))

    expect(screen.getByText(/Anterior/i)).toBeInTheDocument()
  })

  it('permite retroceder con el botón Anterior al paso 1', async () => {
    render(<BootstrapClinica />)

    // Avanzar a paso 2
    fireEvent.click(screen.getByText(/Continuar/i))
    expect(screen.getByText(/Anterior/i)).toBeInTheDocument()

    // Retroceder a paso 1
    fireEvent.click(screen.getByText(/Anterior/i))
    expect(screen.queryByText(/Anterior/i)).not.toBeInTheDocument()
  })

  it('cancelar con confirmación cierra sesión', async () => {
    render(<BootstrapClinica />)

    const btnCancelar = screen.getByTestId('bootstrap-cancelar')
    fireEvent.click(btnCancelar)

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/cancelar/i),
        variant: 'warning',
      })
    )

    await waitFor(() => {
      expect(mockCancelarConfiguracion).toHaveBeenCalled()
    })
  })

  it('no cancela ni cierra sesión si el usuario rechaza la confirmación', async () => {
    mockConfirm.mockResolvedValue(false)
    render(<BootstrapClinica />)

    const btnCancelar = screen.getByTestId('bootstrap-cancelar')
    fireEvent.click(btnCancelar)

    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(mockCancelarConfiguracion).not.toHaveBeenCalled()
    })
  })
})
