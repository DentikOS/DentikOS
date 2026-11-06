import { describe, expect, it } from 'vitest'
import { PROTOCOLOS_URGENCIA_GES } from './protocolosUrgenciaGes'
import { PATOLOGIAS_GES_ODONTO } from '../constants/urgenciasGesConstants'

describe('protocolos GES editables', () => {
  it('presenta los ocho textos validados y los vincula a las patologías del módulo', () => {
    expect(PROTOCOLOS_URGENCIA_GES).toHaveLength(8)
    expect(PROTOCOLOS_URGENCIA_GES.every((protocolo) => protocolo.estado === 'validado'
      && protocolo.pasos.length > 0
      && PATOLOGIAS_GES_ODONTO.some((patologia) => patologia.id === protocolo.id))).toBe(true)
  })

  it('no contiene enlaces de acción, dosis calculadas ni casillas de ejecución', () => {
    expect(PROTOCOLOS_URGENCIA_GES.some((protocolo) => 'acciones' in protocolo || 'calculadora' in protocolo)).toBe(false)
    expect(PROTOCOLOS_URGENCIA_GES.every((protocolo) => protocolo.pasos.every((paso) => typeof paso === 'string'))).toBe(true)
  })
})
