import { describe, it, expect } from 'vitest'
import {
  EQUIPOS_AUTOCLAVE,
  PROGRAMAS_ESTERILIZACION,
  INDICADORES_QUIMICOS,
  INDICADORES_BIOLOGICOS,
  RESULTADOS_BOWIE_DICK,
  CARGAS_DEFAULT,
  PRUEBAS_BIOLOGICAS_DEFAULT,
  TEST_BOWIE_DICK_DEFAULT
} from './esterilizacionConstants'

describe('esterilizacionConstants', () => {
  it('no incluye autoclaves ni programas ficticios como configuración clínica', () => {
    expect(EQUIPOS_AUTOCLAVE).toEqual([])
    expect(PROGRAMAS_ESTERILIZACION).toEqual([])
  })

  it('contiene indicadores químicos, biológicos y resultados bowie-dick', () => {
    expect(INDICADORES_QUIMICOS.length).toBe(3)
    expect(INDICADORES_BIOLOGICOS.length).toBe(3)
    expect(RESULTADOS_BOWIE_DICK.length).toBe(2)
  })

  it('no fabrica cargas ni resultados por defecto', () => {
    expect(CARGAS_DEFAULT).toEqual([])
    expect(PRUEBAS_BIOLOGICAS_DEFAULT).toEqual([])
    expect(TEST_BOWIE_DICK_DEFAULT).toEqual([])
  })
})
