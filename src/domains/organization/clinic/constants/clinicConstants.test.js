import { describe, it, expect } from 'vitest'
import {
  CLINICA_DEFAULT,
  PARAMETROS_AGENDA_DEFAULT,
  TRAMOS_DURACION
} from './clinicConstants'

describe('clinicConstants', () => {
  it('contiene la configuracion por defecto de la clinica con todos los campos', () => {
    expect(CLINICA_DEFAULT.nombreClinica).toBe('DentikOS')
    expect(CLINICA_DEFAULT.rutClinica).toBe('77.854.320-K')
    expect(CLINICA_DEFAULT.emailContacto).toBe('contacto@dentikos.cl')
  })

  it('contiene parametros validos para la agenda por defecto', () => {
    expect(PARAMETROS_AGENDA_DEFAULT.duracionBloqueMinutos).toBe(30)
    expect(PARAMETROS_AGENDA_DEFAULT.horaInicio).toBe('08:30')
    expect(PARAMETROS_AGENDA_DEFAULT.horaFin).toBe('19:30')
    expect(PARAMETROS_AGENDA_DEFAULT.diasLaborales).toContain('Lunes')
  })

  it('define tramos de duracion crecientes y validos', () => {
    expect(TRAMOS_DURACION).toEqual([15, 30, 45, 60, 90, 120])
  })
})
