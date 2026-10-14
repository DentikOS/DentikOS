import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetPagosPendientes } from './WidgetPagosPendientes'

describe('WidgetPagosPendientes (BP04 §03)', () => {
  it('renderiza montos recaudados, por cobrar y saldos vencidos', () => {
    render(
      <WidgetPagosPendientes
        recaudadoHoy={500000}
        porCobrarHoy={120000}
        pagosVencidos={80000}
      />
    )

    expect(screen.getByText(/Pagos & Flujo de Caja/i)).toBeInTheDocument()
    expect(screen.getByText(/Admin exclusivo/i)).toBeInTheDocument()
    expect(screen.getByText(/500\.000/)).toBeInTheDocument()
    expect(screen.getByText(/120\.000/)).toBeInTheDocument()
    expect(screen.getByText(/80\.000/)).toBeInTheDocument()
  })

  it('navega a detalle al presionar el botón de footer', () => {
    const handleIrPagos = vi.fn()
    render(<WidgetPagosPendientes onIrPagos={handleIrPagos} />)

    fireEvent.click(screen.getByText(/Ver Detalle de Pagos y Caja/i))
    expect(handleIrPagos).toHaveBeenCalled()
  })

  it('navega al hacer click en el contenedor de recaudación', () => {
    const handleIrPagos = vi.fn()
    render(<WidgetPagosPendientes onIrPagos={handleIrPagos} />)

    fireEvent.click(screen.getByText(/Recaudado Hoy/i))
    expect(handleIrPagos).toHaveBeenCalled()
  })

  it('renderiza métricas reales (no valores hardcodeados)', () => {
    render(
      <WidgetPagosPendientes
        porCobrarHoy={250000}
        pagosVencidos={180000}
        recaudadoHoy={420000}
        onIrPagos={() => {}}
      />
    )

    // Debe mostrar valores reales
    expect(screen.getByText(/\$250\.000/)).toBeInTheDocument()
    expect(screen.getByText(/\$180\.000/)).toBeInTheDocument()
    expect(screen.getByText(/\$420\.000/)).toBeInTheDocument()

    // NO debe mostrar valores hardcodeados antiguos
    expect(screen.queryByText(/\$350\.000/)).not.toBeInTheDocument()
  })
})
