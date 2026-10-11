import { describe, it, expect } from 'vitest'
import { fichaClinicaSchema } from './fichaClinicaSchema'
import { pacienteSchema } from './pacienteSchema'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'

describe('BP06 Schemas & Store Zustand', () => {
  it('valida fichaClinicaSchema con valores por defecto', () => {
    const data = {
      id: 'ficha-123',
      pacienteId: 'pac-456'
    }
    const res = fichaClinicaSchema.safeParse(data)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.odontograma).toEqual([])
      expect(res.data.evoluciones).toEqual([])
      expect(res.data.recetas).toEqual([])
      expect(res.data.consentimientos).toEqual([])
      expect(res.data.version).toBe(1)
    }
  })

  it('valida pacienteSchema con los nuevos campos demográficos de BP06', () => {
    const paciente = {
      id: 'pac-1',
      nombre: 'María Valenzuela',
      rut: '12.345.678-5',
      nombreCompleto: 'María Ignacia Valenzuela Soto',
      estado: 'activo',
      alergiasSeveras: ['Látex', 'Penicilina'],
      enfermedadesCronicas: ['Hipertensión'],
      anticoagulantes: true,
      diasSinVisita: 15
    }
    const res = pacienteSchema.safeParse(paciente)
    expect(res.success).toBe(true)
  })

  it('usePacientesStore permite cambiar vista y seleccionar pacientes', () => {
    const { setVista, toggleSeleccion, limpiarSeleccion } = usePacientesStore.getState()
    
    setVista('tarjetas')
    expect(usePacientesStore.getState().vistaActual).toBe('tarjetas')

    toggleSeleccion(1)
    expect(usePacientesStore.getState().seleccion).toContain(1)

    limpiarSeleccion()
    expect(usePacientesStore.getState().seleccion).toEqual([])
  })

  it('usePacientesStore permite abrir y cerrar ficha clínica activa', () => {
    const { abrirFicha, cerrarFicha } = usePacientesStore.getState()

    abrirFicha(1)
    expect(usePacientesStore.getState().fichaActiva).not.toBeNull()
    expect(usePacientesStore.getState().fichaActiva?.pacienteId).toBe(1)

    cerrarFicha()
    expect(usePacientesStore.getState().fichaActiva).toBeNull()
  })
})
