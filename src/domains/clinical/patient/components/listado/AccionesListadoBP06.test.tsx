import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccionesFilaPaciente } from './AccionesFilaPaciente'
import { VistaTabla } from './VistaTabla'
import { VistaLista } from './VistaLista'
import { timelineService } from '../../services/timelineService'
import { useSesionStore } from '../../../../../app/stores/sesionStore'
import type { Paciente } from '../../schemas/pacienteSchema'

const mockPacienteActivo: Paciente = {
  id: 'pac-1',
  nombre: 'Ignacio Valenzuela',
  rut: '17.654.321-9',
  edad: 34,
  telefono: '+56 9 8765 4321',
  email: 'ignacio@dental.cl',
  estado: 'activo',
  doctorTratante: 'Martínez',
  proximaCita: '22 Oct 2026 10:00',
  fechaUltimaVisita: '2026-09-15',
}

const mockPacienteBloqueado: Paciente = {
  id: 'pac-2',
  nombre: 'Constanza Silva',
  rut: '18.987.654-3',
  edad: 29,
  estado: 'bloqueado',
  bloqueado: true,
  motivoBloqueo: 'Inasistencias reiteradas sin aviso',
  bloqueadoPor: 'Admin Central',
  bloqueadoAt: '2026-10-01',
}

describe('Acciones Rápidas y Menú Contextual (BP06 §01 + §05 + §06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSesionStore.setState({ userProfile: { rol: 'admin', email: 'admin@dental.cl' } })
  })

  it('muestra exactamente los 4 iconos rápidos [📋] [📅] [📞] [⋮] por fila', () => {
    render(
      <AccionesFilaPaciente
        paciente={mockPacienteActivo}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    expect(screen.getByTestId('btn-ficha-pac-1')).toBeInTheDocument()
    expect(screen.getByTestId('btn-agendar-pac-1')).toBeInTheDocument()
    expect(screen.getByTestId('btn-llamar-pac-1')).toBeInTheDocument()
    expect(screen.getByTestId('btn-menu-contextual-pac-1')).toBeInTheDocument()
  })

  it('oculta el botón agendar [📅] para rol asistente', () => {
    useSesionStore.setState({ userProfile: { rol: 'asistente', email: 'asistente@dental.cl' } })
    render(
      <AccionesFilaPaciente
        paciente={mockPacienteActivo}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    expect(screen.getByTestId('btn-ficha-pac-1')).toBeInTheDocument()
    expect(screen.queryByTestId('btn-agendar-pac-1')).not.toBeInTheDocument()
  })

  it('al intentar agendar [📅] en paciente bloqueado, muestra alerta BP06 §04 con motivo', () => {
    render(
      <AccionesFilaPaciente
        paciente={mockPacienteBloqueado}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('btn-agendar-pac-2'))

    expect(screen.getByTestId('alerta-bloqueo-pac-2')).toBeInTheDocument()
    expect(screen.getByText(/Inasistencias reiteradas sin aviso/)).toBeInTheDocument()
    expect(screen.getByText('Contactar Admin')).toBeInTheDocument()
  })

  it('abre el menú contextual [⋮] con las 9 acciones de BP06 §05', () => {
    render(
      <AccionesFilaPaciente
        paciente={mockPacienteActivo}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('btn-menu-contextual-pac-1'))

    expect(screen.getByText('Editar datos completos')).toBeInTheDocument()
    expect(screen.getByText('Imprimir ficha resumen')).toBeInTheDocument()
    expect(screen.getByText('Exportar ficha (PDF)')).toBeInTheDocument()
    expect(screen.getByText('Crear ficha de derivación')).toBeInTheDocument()
    expect(screen.getByText('Asignar etiqueta')).toBeInTheDocument()
    expect(screen.getByText('Cambiar doctor tratante')).toBeInTheDocument()
    expect(screen.getByText('Ver documentos adjuntos')).toBeInTheDocument()
    expect(screen.getByText('Desactivar paciente')).toBeInTheDocument()
    expect(screen.getByText('Bloquear paciente (Admin)')).toBeInTheDocument()
  })

  it('click-to-call en desktop abre popover y registra llamada en Timeline', () => {
    render(
      <AccionesFilaPaciente
        paciente={mockPacienteActivo}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    const btnLlamar = screen.getByTestId('btn-llamar-pac-1')
    fireEvent.click(btnLlamar)

    expect(screen.getByTestId('popover-llamada-pac-1')).toBeInTheDocument()
    expect(screen.getByText('+56 9 8765 4321')).toBeInTheDocument()

    // Copiar número
    fireEvent.click(screen.getByText('Copiar'))
    const eventos = timelineService.obtenerTimeline('pac-1')
    expect(eventos.some((e) => e.titulo.includes('Llamada saliente a Ignacio Valenzuela'))).toBe(true)
  })

  it('VistaTabla renderiza las 6 columnas fijas y botón de configuración ⚙ Columnas', () => {
    render(
      <VistaTabla
        pacientes={[mockPacienteActivo]}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    expect(screen.getByText('Nombre completo')).toBeInTheDocument()
    expect(screen.getByText('RUT')).toBeInTheDocument()
    expect(screen.getByText('Edad')).toBeInTheDocument()
    expect(screen.getByText('Teléfono')).toBeInTheDocument()
    expect(screen.getByText('Última visita')).toBeInTheDocument()
    expect(screen.getByText('Próxima cita')).toBeInTheDocument()
    expect(screen.getByTestId('btn-configurar-columnas')).toBeInTheDocument()

    // Abrir configurador de columnas
    fireEvent.click(screen.getByTestId('btn-configurar-columnas'))
    expect(screen.getByTestId('popover-columnas-personalizables')).toBeInTheDocument()
  })

  it('VistaLista no tiene botón 🗑 de papelera directo', () => {
    render(
      <VistaLista
        pacientes={[mockPacienteActivo]}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    expect(screen.queryByLabelText(/Eliminar/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('btn-eliminar-pac-1')).not.toBeInTheDocument()
  })

  it('WS-E: renderiza doctor tratante real o "Sin asignar" sin placeholder duplicado', () => {
    const pacienteSinDoc: Paciente = {
      id: 'pac-sin-doc',
      nombre: 'Pedro Pascal',
      rut: '12.345.678-5',
      doctorTratante: undefined,
    }
    const { unmount } = render(
      <VistaLista
        pacientes={[mockPacienteActivo, pacienteSinDoc]}
        alSeleccionarPaciente={vi.fn()}
      />
    )

    // Doctor real mostrado
    expect(screen.getByText('Martínez')).toBeInTheDocument()
    expect(screen.queryByText(/Dr\. Dr/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Dr\. Tratante/i)).not.toBeInTheDocument()

    // Sin asignar mostrado
    expect(screen.getByText('Sin asignar')).toBeInTheDocument()
    unmount()
  })
})

