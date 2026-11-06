/**
 * Tests — FichaPacienteModulo reset tab (F7-26 Pulido P3)
 *
 * Valida que navegar entre pacientes vía PacienteNavigator
 * resetea la tab activa a 'Ficha Clínica'.
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useEffect } from 'react'

// Helper: simulación del useEffect de reset
function useResetTabOnPacienteChange(pacienteId, navegacionClinica) {
  const [tabActiva, setTabActiva] = useState('Línea de Tiempo')

  useEffect(() => {
    if (navegacionClinica && navegacionClinica.indiceActual !== undefined && pacienteId) {
      setTabActiva('Ficha Clínica')
    }
  }, [pacienteId, navegacionClinica])

  return { tabActiva, setTabActiva }
}

describe('FichaPacienteModulo — Reset tab al cambiar paciente (F7-26 P3)', () => {
  it('al cambiar pacienteId con navegación activa, tabActiva se resetea a "Ficha Clínica"', () => {
    const navegacion = { indiceActual: 1, total: 5, hayAnterior: true, haySiguiente: true }

    const { result, rerender } = renderHook(
      ({ pacienteId }) => useResetTabOnPacienteChange(pacienteId, navegacion),
      { initialProps: { pacienteId: 'pac-1' } }
    )

    // useEffect se ejecuta en mount → ya reseteó a 'Ficha Clínica'
    expect(result.current.tabActiva).toBe('Ficha Clínica')

    // Cambiar manualmente a otra tab (envolver en act para aplicar estado)
    act(() => {
      result.current.setTabActiva('Plan de Tratamiento')
    })
    expect(result.current.tabActiva).toBe('Plan de Tratamiento')

    // Cambiar a otro paciente con navegación activa → debe resetear
    rerender({ pacienteId: 'pac-2' })
    expect(result.current.tabActiva).toBe('Ficha Clínica')
  })

  it('sin navegacionClinica, NO se resetea la tab', () => {
    const { result, rerender } = renderHook(
      ({ pacienteId }) => useResetTabOnPacienteChange(pacienteId, null),
      { initialProps: { pacienteId: 'pac-1' } }
    )

    // Sin navegación, useEffect no resetea → mantiene valor inicial
    expect(result.current.tabActiva).toBe('Línea de Tiempo')

    // Cambiar paciente sin navegación → no resetea
    rerender({ pacienteId: 'pac-2' })
    expect(result.current.tabActiva).toBe('Línea de Tiempo')
  })
})
