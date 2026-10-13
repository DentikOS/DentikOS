import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDoctorTratante } from './useDoctorTratante'
import * as doctoresModule from './useDoctoresClinica'

describe('useDoctorTratante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(doctoresModule, 'useDoctoresClinica').mockReturnValue({
      doctores: [
        { id: 'doc-uuid-1', nombre: 'Dra. Ana López', rol: 'dentista' },
        { id: 'doc-uuid-2', nombre: 'Dr. Carlos Mendoza', rol: 'dentista' },
      ],
      loading: false,
      error: null,
      refrescar: vi.fn(),
    })
  })

  it('resuelve el nombre del doctor usando doctorTratanteId cuando coincide', () => {
    const { result } = renderHook(() => useDoctorTratante('doc-uuid-1', undefined))
    expect(result.current).toEqual({ texto: 'Dra. Ana López', asignado: true })
  })

  it('retorna "Sin asignar" cuando no hay id ni fallback válido', () => {
    const { result } = renderHook(() => useDoctorTratante(null, undefined))
    expect(result.current).toEqual({ texto: 'Sin asignar', asignado: false })
  })

  it('utiliza doctorFallback cuando no hay id pero sí nombre válido', () => {
    const { result } = renderHook(() => useDoctorTratante(null, 'Dr. Especialista Externo'))
    expect(result.current).toEqual({ texto: 'Dr. Especialista Externo', asignado: true })
  })
})
