import { describe, expect, it } from 'vitest'
import { obtenerAreasBP15 } from './treasuryPermissions'

describe('permisos de BP15', () => {
  it('administra entrega todas las áreas CORE a admin', () => {
    expect(obtenerAreasBP15('admin')).toEqual([
      'caja', 'conciliacion', 'cartera', 'gastos', 'bonos', 'libros', 'flujo', 'reportes'
    ])
  })

  it('limita recepción exclusivamente a la caja', () => {
    expect(obtenerAreasBP15('recepcion')).toEqual(['caja'])
  })

  it('niega acceso BP15 a dentista, asistente y roles inválidos', () => {
    expect(obtenerAreasBP15('dentista')).toEqual([])
    expect(obtenerAreasBP15('asistente')).toEqual([])
    expect(obtenerAreasBP15('owner')).toEqual([])
  })
})
