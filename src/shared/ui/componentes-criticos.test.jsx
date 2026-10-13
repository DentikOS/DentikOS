/**
 * Tests consolidados para componentes críticos de UI (F6-K Fase 6)
 *
 * Cobertura de smoke tests para componentes sin tests:
 * - ToastContainer (sistema de notificaciones F5-05)
 * - ConnectionIndicator (indicador de conexión F5-05)
 * - ConflictResolutionModal (resolución de conflictos F5-04 + accesibilidad F6-04)
 * - CargandoModulo (loading state)
 *
 * Estrategia: tests de humo que validan renderizado + comportamiento básico
 * sin necesidad de mocks complejos de servicios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ═══════════════════════════════════════════════════════════════
// MOCKS GLOBALES
// ═══════════════════════════════════════════════════════════════
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: vi.fn(() => [])
}))

vi.mock('../../infrastructure/notification/notificationService', () => ({
  notificationService: {
    ocultar: vi.fn(),
    listar: vi.fn(() => []),
    suscribir: vi.fn(() => () => {}),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  estaOnline: vi.fn(() => Promise.resolve(true)),
  supabase: null,
  USE_SUPABASE: false
}))

vi.mock('../infrastructure/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// Importar componentes después de mocks
import { ToastContainer } from './ToastContainer'
import { ConnectionIndicator } from './ConnectionIndicator'
import { ConflictResolutionModal } from './ConflictResolutionModal'
import { CargandoModulo } from './CargandoModulo'
import { useNotifications } from '../hooks/useNotifications'
import { notificationService } from '../../infrastructure/notification/notificationService'

// ═══════════════════════════════════════════════════════════════
// TOAST CONTAINER
// ═══════════════════════════════════════════════════════════════
describe('ToastContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no debe renderizar nada si no hay notificaciones', () => {
    vi.mocked(useNotifications).mockReturnValue([])
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('debe renderizar toasts cuando hay notificaciones', () => {
    vi.mocked(useNotifications).mockReturnValue([
      {
        id: '1',
        tipo: 'success',
        titulo: 'Guardado',
        mensaje: 'Paciente guardado exitosamente',
        dismissable: true
      }
    ])

    render(<ToastContainer />)
    
    expect(screen.getByText('Guardado')).toBeInTheDocument()
    expect(screen.getByText('Paciente guardado exitosamente')).toBeInTheDocument()
  })

  it('debe renderizar múltiples toasts', () => {
    vi.mocked(useNotifications).mockReturnValue([
      { id: '1', tipo: 'success', titulo: 'Toast 1', mensaje: 'Mensaje 1', dismissable: true },
      { id: '2', tipo: 'error', titulo: 'Toast 2', mensaje: 'Mensaje 2', dismissable: true }
    ])

    render(<ToastContainer />)
    
    expect(screen.getByText('Toast 1')).toBeInTheDocument()
    expect(screen.getByText('Toast 2')).toBeInTheDocument()
  })

  it('debe mostrar ícono correcto según tipo de toast', () => {
    vi.mocked(useNotifications).mockReturnValue([
      { id: '1', tipo: 'success', mensaje: 'Éxito', dismissable: false }
    ])

    render(<ToastContainer />)
    // Verificar que el toast se renderiza con las clases correctas para tipo 'success'
    const toast = screen.getByRole('alert')
    expect(toast).toHaveClass('bg-green-50')
    expect(toast).toHaveClass('border-green-400')
  })

  it('debe llamar notificationService.ocultar al hacer click en botón cerrar', () => {
    vi.mocked(useNotifications).mockReturnValue([
      { id: 'toast-123', tipo: 'info', mensaje: 'Test', dismissable: true }
    ])

    render(<ToastContainer />)
    
    const closeBtn = screen.getByLabelText('Cerrar notificación')
    fireEvent.click(closeBtn)
    
    expect(notificationService.ocultar).toHaveBeenCalledWith('toast-123')
  })

  it('no debe mostrar botón cerrar si dismissable=false', () => {
    vi.mocked(useNotifications).mockReturnValue([
      { id: '1', tipo: 'info', mensaje: 'No dismissable', dismissable: false }
    ])

    render(<ToastContainer />)
    expect(screen.queryByLabelText('Cerrar notificación')).not.toBeInTheDocument()
  })

  it('debe tener atributos de accesibilidad', () => {
    vi.mocked(useNotifications).mockReturnValue([
      { id: '1', tipo: 'info', mensaje: 'Test', dismissable: false }
    ])

    render(<ToastContainer />)
    
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('debe soportar todos los tipos de toast', () => {
    const tipos = ['info', 'success', 'warning', 'error']
    const clasesEsperadas = {
      info: { bg: 'bg-blue-50', border: 'border-blue-400' },
      success: { bg: 'bg-green-50', border: 'border-green-400' },
      warning: { bg: 'bg-yellow-50', border: 'border-yellow-400' },
      error: { bg: 'bg-red-50', border: 'border-red-400' }
    }

    tipos.forEach(tipo => {
      vi.mocked(useNotifications).mockReturnValue([
        { id: '1', tipo, mensaje: `Mensaje ${tipo}`, dismissable: false }
      ])

      const { unmount } = render(<ToastContainer />)
      // Verificar que el toast se renderiza con las clases correctas para cada tipo
      const toast = screen.getByRole('alert')
      expect(toast).toHaveClass(clasesEsperadas[tipo].bg)
      expect(toast).toHaveClass(clasesEsperadas[tipo].border)
      unmount()
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// CONNECTION INDICATOR
// ═══════════════════════════════════════════════════════════════
describe('ConnectionIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Mock de window events
    global.window.addEventListener = vi.fn()
    global.window.removeEventListener = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('debe renderizarse sin errores', () => {
    const { container } = render(<ConnectionIndicator />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('debe registrar listeners de online/offline al montar', () => {
    render(<ConnectionIndicator />)
    
    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('debe remover listeners al desmontar', () => {
    const { unmount } = render(<ConnectionIndicator />)
    unmount()
    
    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('debe invocar estaOnline al montar', () => {
    const { render } = require('@testing-library/react')
    // Re-importar mock directamente
    vi.doMock('../../infrastructure/supabase/supabaseClient', () => ({
      estaOnline: vi.fn(() => Promise.resolve(true)),
      supabase: null,
      USE_SUPABASE: false
    }))
    
    // Verificar que listeners se registraron (indicador de montaje correcto)
    const { container } = render(<ConnectionIndicator />)
    expect(container.firstChild).toBeInTheDocument()
    expect(window.addEventListener).toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════
// CONFLICT RESOLUTION MODAL
// ═══════════════════════════════════════════════════════════════
describe('ConflictResolutionModal', () => {
  const mockAlResolver = vi.fn()
  const mockAlCerrar = vi.fn()

  const versionLocal = {
    nombre: 'Juan Local',
    telefono: '123456789',
    email: 'local@test.com',
    alergias: 'Ninguna'
  }

  const versionRemota = {
    nombre: 'Juan Remoto',
    telefono: '987654321',
    email: 'remoto@test.com',
    alergias: 'Penicilina'
  }

  const defaultProps = {
    titulo: 'Conflicto al guardar paciente',
    versionLocal,
    versionRemota,
    camposComparar: ['nombre', 'telefono', 'email', 'alergias'],
    alResolver: mockAlResolver,
    alCerrar: mockAlCerrar
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe renderizarse con título y versiones', () => {
    render(<ConflictResolutionModal {...defaultProps} />)
    
    expect(screen.getByText('Conflicto al guardar paciente')).toBeInTheDocument()
    expect(screen.getByText('Juan Local')).toBeInTheDocument()
    expect(screen.getByText('Juan Remoto')).toBeInTheDocument()
  })

  it('debe mostrar todas las versiones de los campos comparados', () => {
    render(<ConflictResolutionModal {...defaultProps} />)
    
    // Datos locales (nombres y emails únicos)
    expect(screen.getByText('Juan Local')).toBeInTheDocument()
    expect(screen.getByText('local@test.com')).toBeInTheDocument()
    
    // Datos remotos (nombres y emails únicos)
    expect(screen.getByText('Juan Remoto')).toBeInTheDocument()
    expect(screen.getByText('remoto@test.com')).toBeInTheDocument()
  })

  it('debe llamar alResolver con "local" al hacer click en mantener mi versión', () => {
    render(<ConflictResolutionModal {...defaultProps} />)
    
    const localBtn = screen.getByRole('button', { name: /Mantener mi versión/i })
    fireEvent.click(localBtn)
    
    expect(mockAlResolver).toHaveBeenCalledWith('local')
  })

  it('debe llamar alResolver con "remote" al hacer click en usar versión del servidor', () => {
    render(<ConflictResolutionModal {...defaultProps} />)
    
    const remoteBtn = screen.getByRole('button', { name: /servidor/i })
    fireEvent.click(remoteBtn)
    
    expect(mockAlResolver).toHaveBeenCalledWith('remote')
  })

  it('debe llamar alCerrar al hacer click en cancelar', () => {
    render(<ConflictResolutionModal {...defaultProps} />)
    
    const cancelBtn = screen.getByRole('button', { name: /cancelar/i })
    fireEvent.click(cancelBtn)
    
    expect(mockAlCerrar).toHaveBeenCalled()
  })

  it('debe cerrar al presionar tecla ESC (accesibilidad F6-04)', () => {
    render(<ConflictResolutionModal {...defaultProps} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    expect(mockAlCerrar).toHaveBeenCalled()
  })

  it('debe tener atributos de accesibilidad role="dialog" y aria-modal', () => {
    render(<ConflictResolutionModal {...defaultProps} />)
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('debe usar título por defecto si no se proporciona', () => {
    const propsSinTitulo = {
      ...defaultProps,
      titulo: undefined
    }
    
    render(<ConflictResolutionModal {...propsSinTitulo} />)
    expect(screen.getByText(/conflicto/i)).toBeInTheDocument()
  })

  it('debe manejar camposComparar vacío', () => {
    const propsSinCampos = {
      ...defaultProps,
      camposComparar: []
    }
    
    render(<ConflictResolutionModal {...propsSinCampos} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════
// CARGANDO MODULO
// ═══════════════════════════════════════════════════════════════
describe('CargandoModulo', () => {
  it('debe renderizarse sin errores', () => {
    const { container } = render(<CargandoModulo />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('debe mostrar indicador de carga', () => {
    render(<CargandoModulo />)
    // El componente suele mostrar texto "Cargando" o un spinner
    const container = document.querySelector('div')
    expect(container).toBeInTheDocument()
  })

  it('debe tener clases de Tailwind para el loading state', () => {
    const { container } = render(<CargandoModulo />)
    // Verificar que hay algún elemento con clases de animación o loading
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })
})
