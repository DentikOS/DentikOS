import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useFiltrosGuardados } from './useFiltrosGuardados'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'

describe('useFiltrosGuardados', () => {
  beforeEach(() => {
    localStorage.clear()
    useSesionStore.setState({ userProfile: { id: 'usr-1', email: 'test@clinic.com', rol: 'dentista', clinicaId: 'clinica-1', nombreCompleto: 'Dr Test' } as any })
    usePacientesStore.setState({
      filtros: {
        estado: ['activo'],
        doctor: [],
        ultimaVisita: '',
        proximaCita: '',
        edadMin: '18',
        edadMax: '65',
        prevision: ['Fonasa'],
        etiquetas: ['VIP'],
        tratamiento: 'Ortodoncia',
      },
    })
  })

  it('guarda, aplica y elimina filtros favoritos correctamente', () => {
    const { result } = renderHook(() => useFiltrosGuardados())
    expect(result.current.filtrosGuardados).toEqual([])

    act(() => {
      result.current.guardarFiltro('VIP Activos')
    })

    expect(result.current.filtrosGuardados.length).toBe(1)
    expect(result.current.filtrosGuardados[0].nombre).toBe('VIP Activos')
    expect(result.current.filtrosGuardados[0].filtros.estado).toEqual(['activo'])
    const filtroId = result.current.filtrosGuardados[0].id

    // Modificar store y luego aplicar el filtro guardado
    act(() => {
      usePacientesStore.getState().setFiltros({ estado: ['bloqueado'] })
    })
    expect(usePacientesStore.getState().filtros.estado).toEqual(['bloqueado'])

    act(() => {
      result.current.aplicarFiltro(filtroId)
    })
    expect(usePacientesStore.getState().filtros.estado).toEqual(['activo'])
    expect(usePacientesStore.getState().filtros.tratamiento).toBe('Ortodoncia')

    // Eliminar filtro
    act(() => {
      result.current.eliminarFiltro(filtroId)
    })
    expect(result.current.filtrosGuardados).toEqual([])
  })
})
