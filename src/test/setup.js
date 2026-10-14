/**
 * Setup global de testing — Studio Dental OS (F3-04)
 *
 * Este archivo se ejecuta antes de cada suite de tests.
 * Está referenciado en vitest.config.js vía `setupFiles`.
 *
 * Qué hace:
 * 1. Importa los matchers extendidos de @testing-library/jest-dom
 *    (ej: .toBeInTheDocument(), .toHaveTextContent(), etc.)
 * 2. Limpia el localStorage entre tests para evitar contaminación
 *    de estado entre suites (los hooks usan servicios que tocan localStorage)
 * 3. Silencia los console.error esperados en tests de error handling
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Limpieza automática de localStorage entre tests.
// Esto previene que datos de un test contaminen el siguiente,
// especialmente importante para hooks que usan servicios de persistencia.
// Polyfill básico para PointerEvent en jsdom
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
      this.width = params.width ?? 0
      this.height = params.height ?? 0
      this.pressure = params.pressure ?? 0
      this.tangentialPressure = params.tangentialPressure ?? 0
      this.tiltX = params.tiltX ?? 0
      this.tiltY = params.tiltY ?? 0
      this.twist = params.twist ?? 0
      this.pointerType = params.pointerType ?? 'mouse'
      this.isPrimary = params.isPrimary ?? false
    }
  }
  window.PointerEvent = PointerEvent
}

afterEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear()
  }
  vi.restoreAllMocks()
})

// Suprimir logs de error esperados durante tests de manejo de errores.
// Vitest ya captura estos errores en los assertions; no necesitamos verlos duplicados.
const originalConsoleError = console.error
console.error = (...args) => {
  const message = args[0]?.toString?.() || ''
  if (
    message.includes('Error al leer') ||
    message.includes('localStorageRepository') ||
    message.includes('act(')
  ) {
    return
  }
  originalConsoleError.apply(console, args)
}