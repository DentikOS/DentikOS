import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MorningBrief } from './MorningBrief'

describe('MorningBrief (BP04 §02)', () => {
  const mockData = {
    lineas: [
      { id: 'agenda', icono: 'calendar', texto: '8 citas · 1 cancelación', seccion: 'Agenda', severidad: 'info' },
      { id: 'alertas', icono: 'alert', texto: 'Juan Pérez tiene alergia', seccion: 'Pacientes', severidad: 'alerta' },
    ],
    fechaActualizacion: '09:00',
  }

  it('renderiza título y líneas inteligentes', () => {
    render(<MorningBrief data={mockData} />)
    expect(screen.getByText(/Tu día en 30 segundos/i)).toBeInTheDocument()
    expect(screen.getByText(/8 citas · 1 cancelación/i)).toBeInTheDocument()
    expect(screen.getByText(/Juan Pérez tiene alergia/i)).toBeInTheDocument()
    expect(screen.getByText(/Actualizado 09:00/i)).toBeInTheDocument()
  })

  it('llama a onNavegar al hacer click en una línea', () => {
    const handleNavegar = vi.fn()
    render(<MorningBrief data={mockData} onNavegar={handleNavegar} />)

    fireEvent.click(screen.getByText(/8 citas · 1 cancelación/i))
    expect(handleNavegar).toHaveBeenCalledWith('Agenda')
  })

  it('no renderiza nada si no hay líneas', () => {
    const { container } = render(<MorningBrief data={{ lineas: [], fechaActualizacion: '' }} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza iconos Lucide (no texto literal) para cada línea del brief', () => {
    const fullMockData = {
      lineas: [
        { id: 'agenda', icono: 'calendar', texto: '8 citas hoy', seccion: 'Agenda', severidad: 'info' },
        { id: 'alertas', icono: 'alert', texto: 'Alerta clínica', seccion: 'Pacientes', severidad: 'alerta' },
        { id: 'finanzas', icono: 'wallet', texto: '$180.000 por cobrar', seccion: 'Pagos', severidad: 'info' },
        { id: 'esterilizacion', icono: 'lab', texto: 'Autoclave #1', seccion: 'Esterilización', severidad: 'info' },
        { id: 'inventario', icono: 'package', texto: 'Stock crítico', seccion: 'Inventario', severidad: 'advertencia' },
      ],
      fechaActualizacion: '09:30',
    }

    const { container } = render(<MorningBrief data={fullMockData} />)

    // NO debe haber texto literal "calendar", "wallet", "alert", "lab", "package"
    expect(screen.queryByText('calendar')).not.toBeInTheDocument()
    expect(screen.queryByText('wallet')).not.toBeInTheDocument()
    expect(screen.queryByText('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('lab')).not.toBeInTheDocument()
    expect(screen.queryByText('package')).not.toBeInTheDocument()

    // SÍ debe haber SVGs renderizados por Lucide (5 botones con su icono SVG + flecha ArrowUpRight = al menos 10 SVGs)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(5)
  })
})
