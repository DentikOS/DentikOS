import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectorSede } from './SelectorSede'
import { useSedes } from '../../domains/organization/clinic/hooks/useSedes'
import { notificationService } from '../../infrastructure/notification/notificationService'
import { playSound } from '../utils/soundEffects'

vi.mock('../../domains/organization/clinic/hooks/useSedes', () => ({
  useSedes: vi.fn(),
}))

vi.mock('../../app/stores/sesionStore', () => ({
  useSesionStore: vi.fn(() => vi.fn()),
}))

vi.mock('../../infrastructure/notification/notificationService', () => ({
  notificationService: {
    mostrar: vi.fn(),
  },
}))

vi.mock('../utils/soundEffects', () => ({
  playSound: vi.fn(),
}))

describe('SelectorSede (Blueprint 03 §04)', () => {
  const sedesMock = [
    { id: 'sede-1', nombre: 'Sede Providencia', direccion: 'Av. Providencia 123', activa: true },
    { id: 'sede-2', nombre: 'Sede Las Condes', direccion: 'Av. Las Condes 456', activa: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('con 0 sedes o 1 sede: selector ausente (retorna null)', () => {
    vi.mocked(useSedes).mockReturnValue({
      sedes: [sedesMock[0]],
      sedeActiva: sedesMock[0],
      sedeActivaId: 'sede-1',
      cambiarSede: vi.fn(),
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })

    const { rerender } = render(<SelectorSede />)
    expect(screen.queryByTestId('selector-sede')).not.toBeInTheDocument()

    vi.mocked(useSedes).mockReturnValue({
      sedes: [],
      sedeActiva: null,
      sedeActivaId: null,
      cambiarSede: vi.fn(),
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })
    rerender(<SelectorSede />)
    expect(screen.queryByTestId('selector-sede')).not.toBeInTheDocument()
  })

  it('con 2+ sedes: renderiza selector y abre/cierra dropdown custom al hacer click', () => {
    vi.mocked(useSedes).mockReturnValue({
      sedes: sedesMock,
      sedeActiva: sedesMock[0],
      sedeActivaId: 'sede-1',
      cambiarSede: vi.fn(),
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })

    render(<SelectorSede />)
    expect(screen.getByTestId('selector-sede')).toBeInTheDocument()
    expect(screen.getByText('Sede Providencia')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    // Abrir dropdown
    const triggerBtn = screen.getByRole('button', { name: /sede activa y sincronizada/i })
    fireEvent.click(triggerBtn)

    expect(screen.getByRole('listbox', { name: 'Lista de sedes' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('permite cambiar de sede al hacer click en una opcion con toast y sonido', async () => {
    const cambiarSedeMock = vi.fn()
    const onCambioSedeMock = vi.fn()

    vi.mocked(useSedes).mockReturnValue({
      sedes: sedesMock,
      sedeActiva: sedesMock[0],
      sedeActivaId: 'sede-1',
      cambiarSede: cambiarSedeMock,
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })

    render(<SelectorSede onCambioSede={onCambioSedeMock} />)

    // Abrir dropdown
    const triggerBtn = screen.getByRole('button', { name: /sede activa y sincronizada/i })
    fireEvent.click(triggerBtn)

    // Seleccionar segunda sede
    const opcion2 = screen.getByRole('option', { name: /sede las condes/i })
    fireEvent.click(opcion2)

    expect(cambiarSedeMock).toHaveBeenCalledWith('sede-2')
    expect(onCambioSedeMock).toHaveBeenCalledWith('sede-2')
    expect(notificationService.mostrar).toHaveBeenCalledWith('Sede cambiada a Sede Las Condes', { tipo: 'info' })
    expect(playSound).toHaveBeenCalledWith('save')
    await vi.waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('al seleccionar la sede ya activa no dispara cambio ni toast', async () => {
    const cambiarSedeMock = vi.fn()

    vi.mocked(useSedes).mockReturnValue({
      sedes: sedesMock,
      sedeActiva: sedesMock[0],
      sedeActivaId: 'sede-1',
      cambiarSede: cambiarSedeMock,
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })

    render(<SelectorSede />)
    const triggerBtn = screen.getByRole('button', { name: /sede activa y sincronizada/i })
    fireEvent.click(triggerBtn)

    const opcionActiva = screen.getByRole('option', { name: /sede providencia/i })
    fireEvent.click(opcionActiva)

    expect(cambiarSedeMock).not.toHaveBeenCalled()
    expect(notificationService.mostrar).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('cierra dropdown con tecla Escape y con click fuera', async () => {
    vi.mocked(useSedes).mockReturnValue({
      sedes: sedesMock,
      sedeActiva: sedesMock[0],
      sedeActivaId: 'sede-1',
      cambiarSede: vi.fn(),
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })

    render(<SelectorSede />)
    const triggerBtn = screen.getByRole('button', { name: /sede activa y sincronizada/i })

    // Abrir y cerrar con Escape
    fireEvent.click(triggerBtn)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await vi.waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    // Abrir y cerrar con click fuera
    fireEvent.click(triggerBtn)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    await vi.waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('estado sincronizado (default): punto verde (#0D9488) y fondo verde claro', () => {
    vi.mocked(useSedes).mockReturnValue({
      sedes: sedesMock,
      sedeActiva: sedesMock[0],
      sedeActivaId: 'sede-1',
      cambiarSede: vi.fn(),
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })

    render(<SelectorSede sincronizado={true} />)
    const triggerBtn = screen.getByRole('button', { name: /sede activa y sincronizada/i })
    expect(triggerBtn).toHaveClass('bg-[#ECFDF5]')

    const punto = screen.getByTestId('selector-sede-status')
    expect(punto).toBeInTheDocument()
    expect(punto).toHaveClass('bg-[#0D9488]')
    expect(punto).toHaveAttribute('aria-label', 'Sede activa y sincronizada')
  })

  it('estado no sincronizado: punto ambar (#D97706) y fondo ambar claro', () => {
    vi.mocked(useSedes).mockReturnValue({
      sedes: sedesMock,
      sedeActiva: sedesMock[0],
      sedeActivaId: 'sede-1',
      cambiarSede: vi.fn(),
      agregarSede: vi.fn(),
      editarSede: vi.fn(),
      eliminarSede: vi.fn(),
      recargar: vi.fn(),
    })

    render(<SelectorSede sincronizado={false} />)
    const triggerBtn = screen.getByRole('button', { name: /cambios pendientes de sincronizar/i })
    expect(triggerBtn).toHaveClass('bg-amber-50')

    const punto = screen.getByTestId('selector-sede-status')
    expect(punto).toBeInTheDocument()
    expect(punto).toHaveClass('bg-[#D97706]')
    expect(punto).toHaveAttribute('aria-label', 'Cambios pendientes de sincronizar')
  })
})
