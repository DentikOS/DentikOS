import { describe, expect, it } from 'vitest'
import { CONFIGURACION_MEMBRETE_DEFAULT, normalizarConfiguracionMembrete } from './configuracionMembreteSchema'

describe('normalizarConfiguracionMembrete', () => {
  it('combina campos parciales con defaults y conserva booleanos explícitos', () => {
    const configuracion = normalizarConfiguracionMembrete({
      diseno: 'moderno',
      colorTitulos: '#123456',
      mostrar: { email: true, rut: false },
    })

    expect(configuracion).toMatchObject({
      diseno: 'moderno',
      colorTitulos: '#123456',
      colorLinea: CONFIGURACION_MEMBRETE_DEFAULT.colorLinea,
      mostrar: { email: true, rut: false, telefono: true },
    })
  })

  it('rechaza formato de color inválido y diseño desconocido sin propagarlo al documento', () => {
    const configuracion = normalizarConfiguracionMembrete({
      diseno: 'con-estilos-del-navegador',
      colorLinea: 'red; background:url(javascript:alert(1))',
    })

    expect(configuracion.diseno).toBe('clasico')
    expect(configuracion.colorLinea).toBe(CONFIGURACION_MEMBRETE_DEFAULT.colorLinea)
  })
})
