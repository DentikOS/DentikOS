import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  WidgetAgenda,
  WidgetPacientesRecientes,
  WidgetSalaEspera,
  WidgetAlertasClinicas,
  WidgetEsterilizacion,
  WidgetInventarioCritico,
  WidgetPagosPendientes,
  WidgetComunicaciones,
  WidgetQuickResume
} from './index'

describe('Widgets CORE Dashboard (BP04 §03)', () => {
  it('WidgetAgenda renderiza citas y responde al click', () => {
    const handleVerFicha = vi.fn()
    const handleVerAgenda = vi.fn()
    render(
      <WidgetAgenda
        citas={[{ id: 'c1', pacienteId: 'p1', pacienteNombre: 'Carlos', horaInicio: '09:00', estado: 'Agendado' }]}
        pacientes={[{ id: 'p1', nombre: 'Carlos' }]}
        onVerFichaPaciente={handleVerFicha}
        onVerAgendaCompleta={handleVerAgenda}
      />
    )
    expect(screen.getByText(/Próximas Citas/i)).toBeInTheDocument()
    expect(screen.getByText('Carlos')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Carlos'))
    expect(handleVerFicha).toHaveBeenCalled()
    fireEvent.click(screen.getByText(/Ver agenda completa/i))
    expect(handleVerAgenda).toHaveBeenCalled()
  })

  it('WidgetPacientesRecientes renderiza pacientes y ejecuta onVerFichaPaciente', () => {
    const handleVerFicha = vi.fn()
    render(
      <WidgetPacientesRecientes
        pacientes={[{ id: 'p1', nombre: 'Ana Gómez', rut: '12.345.678-9' }]}
        onVerFichaPaciente={handleVerFicha}
      />
    )
    expect(screen.getByText(/Pacientes Recientes/i)).toBeInTheDocument()
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ana Gómez'))
    expect(handleVerFicha).toHaveBeenCalledWith({ id: 'p1', nombre: 'Ana Gómez', rut: '12.345.678-9' })
  })

  it('WidgetSalaEspera renderiza pacientes en espera y botón de llamada', () => {
    const handleLlamar = vi.fn()
    render(
      <WidgetSalaEspera
        enEspera={[{ id: 'c1', pacienteNombre: 'Mario Silva', box: 'Box 1', horaLlegadaEspera: '10:15' }]}
        onLlamarPaciente={handleLlamar}
      />
    )
    expect(screen.getByText(/Sala de Espera Virtual/i)).toBeInTheDocument()
    expect(screen.getByText(/Mario Silva/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Llamar/i))
    expect(handleLlamar).toHaveBeenCalled()
  })

  it('WidgetAlertasClinicas renderiza alertas críticas y precaución', () => {
    const handleVerAlerta = vi.fn()
    render(
      <WidgetAlertasClinicas
        alertas={[{ id: 'a1', pacienteNombre: 'Elena', tipo: 'alergia', mensaje: 'Alergia a Penicilina', severidad: 'critica' }]}
        onVerAlerta={handleVerAlerta}
      />
    )
    expect(screen.getByText(/Alertas Clínicas/i)).toBeInTheDocument()
    expect(screen.getByText('Elena')).toBeInTheDocument()
    expect(screen.getByText(/Alergia a Penicilina/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Alergia a Penicilina/i))
    expect(handleVerAlerta).toHaveBeenCalled()
  })

  it('WidgetEsterilizacion renderiza info de autoclave', () => {
    const handleIr = vi.fn()
    render(
      <WidgetEsterilizacion
        info={{ equipo: 'Autoclave #1', ciclo: 48, temperatura: '134°C', tiempoRestante: '10 min', estado: 'en_curso' }}
        onIrEsterilizacion={handleIr}
      />
    )
    expect(screen.getByText(/Control de Esterilización/i)).toBeInTheDocument()
    expect(screen.getByText(/Ciclo #48/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Abrir Módulo de Esterilización/i))
    expect(handleIr).toHaveBeenCalled()
  })

  it('WidgetInventarioCritico renderiza insumos con bajo stock', () => {
    const handleIr = vi.fn()
    render(
      <WidgetInventarioCritico
        items={[{ id: '1', nombre: 'Anestesia 2%', cantidad: 2, minimoCritico: 10, unidad: 'tubos' }]}
        onIrInventario={handleIr}
      />
    )
    expect(screen.getByText(/Inventario Crítico/i)).toBeInTheDocument()
    expect(screen.getByText('Anestesia 2%')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Gestionar Stock/i))
    expect(handleIr).toHaveBeenCalled()
  })

  it('WidgetPagosPendientes muestra recaudación y saldos pendientes', () => {
    const handleIr = vi.fn()
    render(<WidgetPagosPendientes porCobrarHoy={150000} recaudadoHoy={400000} onIrPagos={handleIr} />)
    expect(screen.getByText(/Pagos & Flujo de Caja/i)).toBeInTheDocument()
    expect(screen.getByText(/400.000 CLP/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Ver Detalle de Pagos/i))
    expect(handleIr).toHaveBeenCalled()
  })

  it('WidgetComunicaciones muestra pendientes de WhatsApp y recordatorios', () => {
    const handleIr = vi.fn()
    render(<WidgetComunicaciones sinLeerWhatsapp={4} onIrComunicaciones={handleIr} />)
    expect(screen.getByText(/Comunicaciones & Recall/i)).toBeInTheDocument()
    expect(screen.getByText(/4 pendientes/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Centro de Mensajes/i))
    expect(handleIr).toHaveBeenCalled()
  })

  it('WidgetQuickResume renderiza si hay ficha de menos de 30 minutos', () => {
    const handleRetomar = vi.fn()
    const data = { pacienteId: 'p1', pacienteNombre: 'Pedro Soto', tabActiva: 'Odontograma', timestamp: Date.now() - 60000 }
    render(<WidgetQuickResume data={data} onRetomar={handleRetomar} />)
    expect(screen.getByText(/Quick Resume/i)).toBeInTheDocument()
    expect(screen.getByText(/Pedro Soto/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Retomar atención/i))
    expect(handleRetomar).toHaveBeenCalledWith(data)
  })
})
