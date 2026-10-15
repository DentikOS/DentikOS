import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalConfirmacionCita } from './ModalConfirmacionCita'

import { confirmacionWhatsAppService, PLANTILLA_WHATSAPP_OFICIAL } from '../services/confirmacionWhatsAppService'

const mockAlert = vi.fn().mockResolvedValue(undefined)
const mockConfirm = vi.fn().mockResolvedValue({ confirmed: true, inputValue: 'Paciente con gripe' })

vi.mock('../../../../shared/hooks/useAppDialog', () => ({
  useAppDialog: () => ({
    confirm: mockConfirm,
    alert: mockAlert,
  }),
}))

vi.mock('../services/confirmacionWhatsAppService', () => ({
  confirmacionWhatsAppService: {
    obtenerHistorialCita: vi.fn(),
    registrarConfirmacion: vi.fn(),
    prepararMensajeWhatsApp: vi.fn().mockReturnValue('https://wa.me/56912345678?text=test'),
  },
  PLANTILLA_WHATSAPP_OFICIAL: vi.fn().mockReturnValue('Mensaje prueba'),
}))

const citaMock = {
  id: '1',
  pacienteNombre: 'Juan Pérez',
  pacienteTelefono: '912345678',
  fecha: '2026-10-15',
  horaInicio: '10:00',
  doctor: 'Dr. Martínez',
  boxAsignado: 'Box 2',
  trataMiento: 'Restauración composite',
  confirmation_status: 'pendiente',
}

describe('ModalConfirmacionCita (BP05 §04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(PLANTILLA_WHATSAPP_OFICIAL).mockReturnValue('Mensaje prueba')
    vi.mocked(confirmacionWhatsAppService.obtenerHistorialCita).mockResolvedValue([])
    vi.mocked(confirmacionWhatsAppService.registrarConfirmacion).mockResolvedValue({ id: 'conf-1' })
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    window.open = vi.fn().mockReturnValue({})
  })

  it('renderiza los 4 botones oficiales', () => {
    render(
      <ModalConfirmacionCita
        isOpen={true}
        cita={citaMock}
        alCerrar={() => {}}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    )

    expect(screen.getByText('Enviar WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Confirmé por teléfono')).toBeInTheDocument()
    expect(screen.getByText('Confirmó en persona')).toBeInTheDocument()
    expect(screen.getByText('Canceló')).toBeInTheDocument()
  })

  it('muestra información de la cita', () => {
    render(
      <ModalConfirmacionCita
        isOpen={true}
        cita={citaMock}
        alCerrar={() => {}}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    )

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Dr. Martínez · Box 2')).toBeInTheDocument()
    expect(screen.getByText('Restauración composite')).toBeInTheDocument()
  })

  it('llama a alConfirmar al hacer click en "Confirmé por teléfono"', async () => {
    const alConfirmar = vi.fn()
    render(
      <ModalConfirmacionCita
        isOpen={true}
        cita={citaMock}
        alCerrar={() => {}}
        alConfirmar={alConfirmar}
        alCancelar={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Confirmé por teléfono'))
    await vi.waitFor(() => {
      expect(alConfirmar).toHaveBeenCalledWith('1', 'telefono')
    })
  })

  it('con teléfono de 9 dígitos envía a wa.me con prefijo 56', async () => {
    const alConfirmar = vi.fn()
    const alCerrar = vi.fn()

    render(
      <ModalConfirmacionCita
        isOpen={true}
        cita={{ ...citaMock, pacienteTelefono: '912345678' }}
        alCerrar={alCerrar}
        alConfirmar={alConfirmar}
        alCancelar={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Enviar WhatsApp'))

    await vi.waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/56912345678?text='),
        '_blank',
        'noopener,noreferrer'
      )
      expect(alConfirmar).toHaveBeenCalledWith('1', 'whatsapp_enviado')
      expect(alCerrar).toHaveBeenCalled()
    })
  })

  it('sin teléfono copia al portapapeles y alerta al usuario sin abrir ventana', async () => {
    const alConfirmar = vi.fn()
    const alCerrar = vi.fn()

    render(
      <ModalConfirmacionCita
        isOpen={true}
        cita={{ ...citaMock, pacienteTelefono: '' }}
        alCerrar={alCerrar}
        alConfirmar={alConfirmar}
        alCancelar={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Enviar WhatsApp'))

    await vi.waitFor(() => {
      expect(window.open).not.toHaveBeenCalled()
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Mensaje prueba')
      expect(mockAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Paciente sin teléfono',
          variant: 'warning',
        })
      )
      expect(alConfirmar).toHaveBeenCalledWith('1', 'whatsapp_enviado')
      expect(alCerrar).toHaveBeenCalled()
    })
  })

  it('muestra aviso de Core vs Add-On Connect', () => {
    render(
      <ModalConfirmacionCita
        isOpen={true}
        cita={citaMock}
        alCerrar={() => {}}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />
    )

    expect(screen.getByText(/Add-On DentikOS Connect/i)).toBeInTheDocument()
  })
})
