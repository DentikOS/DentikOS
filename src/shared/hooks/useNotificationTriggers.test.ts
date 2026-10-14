import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotificationTriggers } from './useNotificationTriggers'
import { usePacientesStore } from '../../app/stores/usePacientesStore'
import { useSesionStore } from '../../app/stores/sesionStore'
import { useSidebarCounters } from './useSidebarCounters'
import { notificationGenerators } from '../../infrastructure/notification/notificationGenerators'
import { finanzasStorageService } from '../../domains/billing/cash-register/services/finanzasStorageService'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { inventarioStorageService } from '../../domains/operations/inventory/services/inventarioStorageService'

vi.mock('../../app/stores/usePacientesStore', () => ({
  usePacientesStore: vi.fn(),
}))

vi.mock('../../app/stores/sesionStore', () => ({
  useSesionStore: vi.fn(),
}))

vi.mock('./useSidebarCounters', () => ({
  useSidebarCounters: vi.fn(),
}))

vi.mock('../../infrastructure/notification/notificationGenerators', () => ({
  notificationGenerators: {
    alergiaDetectada: vi.fn().mockResolvedValue({ id: 'notif-1', deduplicado: false }),
    stockCritico: vi.fn().mockResolvedValue({ id: 'notif-2', deduplicado: false }),
    cumpleanosPaciente: vi.fn().mockResolvedValue({ id: 'notif-3', deduplicado: false }),
    pagoVencido: vi.fn().mockResolvedValue({ id: 'notif-4', deduplicado: false }),
    recordatorioCita: vi.fn().mockResolvedValue({ id: 'notif-5', deduplicado: false }),
  },
}))

vi.mock('../../infrastructure/logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('../../domains/billing/cash-register/services/finanzasStorageService', () => ({
  finanzasStorageService: {
    obtenerMovimientos: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('../../domains/operations/agenda/services/agendaStorageService', () => ({
  agendaStorageService: {
    obtenerCitas: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('../../domains/operations/inventory/services/inventarioStorageService', () => ({
  inventarioStorageService: {
    obtenerItems: vi.fn().mockReturnValue([]),
  },
}))

describe('useNotificationTriggers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    vi.mocked(useSesionStore).mockImplementation((selector: any) =>
      selector({ userProfile: { id: 'user-1', clinicaId: 'clinic-1' } })
    )

    vi.mocked(usePacientesStore).mockImplementation((selector: any) =>
      selector({ pacienteActivo: null, pacientes: [] })
    )

    vi.mocked(useSidebarCounters).mockReturnValue({
      agenda: 0,
      agendaSinConfirmar: 0,
      esterilizacionPendiente: 0,
      inventario: 0,
      inventarioBajo: 0,
      mensajesNoLeidos: 0,
      pagosVencidos: 0,
      papelera: 0,
      refrescar: vi.fn(),
      refrescarPapelera: vi.fn().mockResolvedValue(undefined),
    })

    vi.mocked(notificationGenerators.alergiaDetectada).mockResolvedValue({ id: 'notif-1', deduplicado: false })
    vi.mocked(notificationGenerators.stockCritico).mockResolvedValue({ id: 'notif-2', deduplicado: false })
    vi.mocked(notificationGenerators.cumpleanosPaciente).mockResolvedValue({ id: 'notif-3', deduplicado: false })
    vi.mocked(notificationGenerators.pagoVencido).mockResolvedValue({ id: 'notif-4', deduplicado: false })
    vi.mocked(notificationGenerators.recordatorioCita).mockResolvedValue({ id: 'notif-5', deduplicado: false })
    vi.mocked(finanzasStorageService.obtenerMovimientos).mockReturnValue([])
    vi.mocked(agendaStorageService.obtenerCitas).mockReturnValue([])
    vi.mocked(inventarioStorageService.obtenerItems).mockReturnValue([])
  })

  it('se monta sin errores', () => {
    const { unmount } = renderHook(() => useNotificationTriggers())
    expect(unmount).not.toThrow()
  })

  it('no dispara triggers sin userProfile', () => {
    vi.mocked(useSesionStore).mockImplementation((selector: any) =>
      selector({ userProfile: null })
    )

    renderHook(() => useNotificationTriggers())

    expect(notificationGenerators.alergiaDetectada).not.toHaveBeenCalled()
    expect(notificationGenerators.stockCritico).not.toHaveBeenCalled()
    expect(notificationGenerators.cumpleanosPaciente).not.toHaveBeenCalled()
    expect(notificationGenerators.pagoVencido).not.toHaveBeenCalled()
    expect(notificationGenerators.recordatorioCita).not.toHaveBeenCalled()
  })

  it('trigger alergia: dispara alergiaDetectada cuando el paciente activo tiene alergia', async () => {
    vi.mocked(usePacientesStore).mockImplementation((selector: any) =>
      selector({
        pacienteActivo: { id: 10, nombre: 'Camila Silva', alergias: 'Penicilina' },
        pacientes: [],
      })
    )

    renderHook(() => useNotificationTriggers())

    expect(notificationGenerators.alergiaDetectada).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: '10',
        pacienteNombre: 'Camila Silva',
        alergeno: 'Penicilina',
        gravedad: 'moderada',
      })
    )
  })

  it('trigger alergia: no dispara si el paciente tiene "Ninguna" o está vacío', () => {
    vi.mocked(usePacientesStore).mockImplementation((selector: any) =>
      selector({
        pacienteActivo: { id: 11, nombre: 'Carlos Mendoza', alergias: 'Ninguna' },
        pacientes: [],
      })
    )

    renderHook(() => useNotificationTriggers())

    expect(notificationGenerators.alergiaDetectada).not.toHaveBeenCalled()
  })

  it('trigger stock: dispara stockCritico cuando inventarioBajo > 0 y hay productos', () => {
    vi.mocked(useSidebarCounters).mockReturnValue({
      agenda: 0,
      agendaSinConfirmar: 0,
      esterilizacionPendiente: 0,
      inventario: 1,
      inventarioBajo: 1,
      productosBajoStock: [
        { id: 'prod-1', nombre: 'Guantes Nitrilo', stock: 2, minimo: 10 },
      ],
      mensajesNoLeidos: 0,
      pagosVencidos: 0,
      papelera: 0,
      refrescar: vi.fn(),
      refrescarPapelera: vi.fn().mockResolvedValue(undefined),
    } as any)

    renderHook(() => useNotificationTriggers())

    expect(notificationGenerators.stockCritico).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        clinicId: 'clinic-1',
        productoId: 'prod-1',
        productoNombre: 'Guantes Nitrilo',
        stockActual: 2,
        stockMinimo: 10,
      })
    )
  })

  it('trigger cumpleaños: dispara cumpleanosPaciente para pacientes que cumplen hoy', () => {
    const hoy = new Date()
    const mes = String(hoy.getMonth() + 1).padStart(2, '0')
    const dia = String(hoy.getDate()).padStart(2, '0')
    const nacimiento = `1990-${mes}-${dia}`

    vi.mocked(usePacientesStore).mockImplementation((selector: any) =>
      selector({
        pacienteActivo: null,
        pacientes: [
          { id: 25, nombre: 'Ana Soto', fechaNacimiento: nacimiento },
        ],
      })
    )

    renderHook(() => useNotificationTriggers())

    expect(notificationGenerators.cumpleanosPaciente).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: '25',
        pacienteNombre: 'Ana Soto',
      })
    )
  })

  it('trigger pago vencido: dispara pagoVencido cuando hay movimiento con >30 días vencido', () => {
    const fechaVencida = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    vi.mocked(finanzasStorageService.obtenerMovimientos).mockReturnValue([
      {
        id: 'mov-1',
        tipo: 'ingreso_pendiente',
        estado: 'pendiente',
        pacienteId: 'pac-99',
        pacienteNombre: 'Pedro Pascal',
        monto: 85000,
        fechaVencimiento: fechaVencida,
      } as any,
    ])

    renderHook(() => useNotificationTriggers())

    expect(notificationGenerators.pagoVencido).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        clinicId: 'clinic-1',
        pacienteId: 'pac-99',
        pacienteNombre: 'Pedro Pascal',
        monto: 85000,
        facturaId: 'mov-1',
      })
    )
  })

  it('trigger recordatorio cita: dispara recordatorioCita para citas sin confirmar en las próximas 24h', () => {
    const ahora = new Date()
    const manana = new Date(ahora.getTime() + 12 * 60 * 60 * 1000)
    const fechaManana = manana.toISOString().split('T')[0]
    const horaManana = manana.toTimeString().slice(0, 5)

    vi.mocked(agendaStorageService.obtenerCitas).mockReturnValue([
      {
        id: 'cita-77',
        pacienteNombre: 'Lucía Méndez',
        fecha: fechaManana,
        horaInicio: horaManana,
        estado: 'Agendado',
      } as any,
    ])

    renderHook(() => useNotificationTriggers())

    expect(notificationGenerators.recordatorioCita).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        clinicId: 'clinic-1',
        citaId: 'cita-77',
        pacienteNombre: 'Lucía Méndez',
        fecha: fechaManana,
        hora: horaManana,
      })
    )
  })
})
