import { describe, it, expect } from 'vitest'
import { validarTransicion, TRANSICIONES_PERMITIDAS } from './validarTransicionEstado'

describe('validarTransicionEstado (BP05 §03)', () => {
  it('permite transiciones válidas según el ciclo de vida', () => {
    expect(validarTransicion('Pendiente', 'Confirmada')).toBe(true)
    expect(validarTransicion('Confirmada', 'En sala de espera')).toBe(true)
    expect(validarTransicion('En sala de espera', 'En atención')).toBe(true)
    expect(validarTransicion('En atención', 'Completada')).toBe(true)
  })

  it('rechaza transiciones inválidas o no permitidas', () => {
    expect(validarTransicion('Completada', 'Pendiente')).toBe(false)
    expect(validarTransicion('Cancelada', 'En atención')).toBe(false)
    expect(validarTransicion('Pendiente', 'Completada')).toBe(false)
  })

  it('permite la misma transición de estado (idempotencia)', () => {
    expect(validarTransicion('Confirmada', 'Confirmada')).toBe(true)
  })

  it('exporta matriz completa de transiciones permitidas', () => {
    expect(TRANSICIONES_PERMITIDAS.Pendiente).toContain('Confirmada')
    expect(TRANSICIONES_PERMITIDAS.Completada).toEqual([])
  })
})
