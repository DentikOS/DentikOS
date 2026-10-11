import { describe, it, expect } from 'vitest'
import {
  calcularCAL,
  calcularClasificacionAAP,
  calcularIndicesPeriodontales,
} from './periodontalCalculations'

describe('calcularCAL', () => {
  it('suma profundidad de sondaje y recesión cuando ambos son válidos', () => {
    expect(calcularCAL(4, 2)).toBe(6)
  })

  it('trata la recesión ausente/inválida como 0, no como dato faltante', () => {
    expect(calcularCAL(4, undefined)).toBe(4)
    expect(calcularCAL('4', '')).toBe(4)
  })

  it('retorna cadena vacía si el sondaje no es un número (dato crítico faltante)', () => {
    expect(calcularCAL(undefined, 2)).toBe('')
    expect(calcularCAL('', 2)).toBe('')
    expect(calcularCAL('abc', 2)).toBe('')
  })
})

describe('calcularClasificacionAAP', () => {
  it('clasifica como Salud Periodontal cuando no hay sondaje profundo ni sangrado relevante', () => {
    const r = calcularClasificacionAAP(2, 5, { fumador: false, diabetes: false })
    expect(r.etapa).toBe('Salud Periodontal')
    expect(r.grado).toBe('Grado A (Bajo Riesgo)')
  })

  it('clasifica Gingivitis cuando el sangrado supera 10% sin bolsas profundas', () => {
    const r = calcularClasificacionAAP(3, 15)
    expect(r.etapa).toBe('Gingivitis Inducida por Placa Bacteriana')
  })

  it.each([
    [4, 'Periodontitis Inicial (Etapa I)'],
    [5, 'Periodontitis Moderada (Etapa II)'],
    [6, 'Periodontitis Severa / Avanzada (Etapa III / IV)'],
    [9, 'Periodontitis Severa / Avanzada (Etapa III / IV)'],
  ])('con maxSondaje=%i clasifica etapa como "%s"', (sondaje, etapaEsperada) => {
    expect(calcularClasificacionAAP(sondaje, 0).etapa).toBe(etapaEsperada)
  })

  it('fumador o diabetes eleva el grado a C independiente del sangrado/sondaje', () => {
    const r = calcularClasificacionAAP(2, 0, { fumador: true, diabetes: false })
    expect(r.grado).toBe('Grado C (Riesgo Elevado de Progresión Rápida)')
  })

  it('sangrado >30% o sondaje >=5 sin factores de riesgo eleva a grado B', () => {
    expect(calcularClasificacionAAP(2, 35).grado).toBe('Grado B (Riesgo Moderado de Progresión)')
    expect(calcularClasificacionAAP(5, 0).grado).toBe('Grado B (Riesgo Moderado de Progresión)')
  })

  it('usa valores por defecto seguros (0) cuando no se informan parámetros', () => {
    const r = calcularClasificacionAAP()
    expect(r.etapa).toBe('Salud Periodontal')
    expect(r.grado).toBe('Grado A (Bajo Riesgo)')
  })
})

describe('calcularIndicesPeriodontales', () => {
  it('retorna todo en cero para piezasData vacío o indefinido, diagnóstico concluyente por defecto', () => {
    const r = calcularIndicesPeriodontales({})
    expect(r.sitiosTotales).toBe(0)
    expect(r.sitiosRegistrados).toBe(0)
    expect(r.sitiosSinRegistrar).toBe(0)
    expect(r.porcentajeSangrado).toBe(0)
    expect(r.indiceOLeary).toBe(0)
    expect(r.maxSondaje).toBe(0)
    expect(r.diagnosticoConcluyente).toBe(true) // sin piezas evaluables no hay "cobertura insuficiente" que señalar
    expect(calcularIndicesPeriodontales(undefined).sitiosTotales).toBe(0)
  })

  it('excluye piezas marcadas como ausentes del conteo de sitios', () => {
    const piezasData = {
      11: { ausente: true, vestibular: { sondaje: [5, 5, 5] } },
    }
    expect(calcularIndicesPeriodontales(piezasData).sitiosTotales).toBe(0)
  })

  it('cuenta 3 sitios por cara evaluada (vestibular + palatino) y calcula porcentajes sobre sitios registrados', () => {
    const piezasData = {
      11: {
        vestibular: { sondaje: [3, 3, 3], sangrado: [true, false, false], placa: [true, true, false] },
        palatino: { sondaje: [2, 2, 2], sangrado: [false, false, false], placa: [false, false, false] },
      },
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sitiosTotales).toBe(6)
    expect(r.sitiosRegistrados).toBe(6)
    expect(r.sitiosSinRegistrar).toBe(0)
    expect(r.sitiosSangrado).toBe(1)
    expect(r.sitiosPlaca).toBe(2)
    expect(r.maxSondaje).toBe(3)
    expect(r.porcentajeSangrado).toBe(Math.round((1 / 6) * 100))
    expect(r.indiceOLeary).toBe(Math.round((2 / 6) * 100))
    expect(r.diagnosticoConcluyente).toBe(true)
  })

  // ===========================================================================
  // COMPORTAMIENTO CORREGIDO (F1-04b) — Fail-Safe Clinical Default
  // Sitios sin registrar NUNCA se cuentan como sanos (0mm). Se excluyen de
  // los promedios y se contabilizan en sitiosSinRegistrar. Antes de F1-04b,
  // este mismo caso se trataba como 3 sitios sanos y podía arrojar
  // "Salud Periodontal" con un examen que en realidad nunca se completó.
  // ===========================================================================
  it('sondaje no registrado (null/undefined/inválido) se excluye de los promedios, no se cuenta como sano', () => {
    const piezasData = {
      11: {
        vestibular: { sondaje: ['x', null, undefined], sangrado: [false, false, false], placa: [false, false, false] },
      },
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sitiosTotales).toBe(3)
    expect(r.sitiosRegistrados).toBe(0)
    expect(r.sitiosSinRegistrar).toBe(3)
    expect(r.maxSondaje).toBe(0)
    // Cobertura 0% → diagnóstico NO concluyente, no "Salud Periodontal"
    expect(r.diagnosticoConcluyente).toBe(false)
    expect(r.diagnosticoSugerido).toMatch(/Sondaje Incompleto/i)
  })

  it('con cobertura de sondaje exactamente en el umbral (80%), el diagnóstico SÍ es concluyente', () => {
    // 15 sitios totales (5 caras x 3), 12 registrados = 80% exacto
    const piezasData = {
      11: { vestibular: { sondaje: [2, 2, 2] }, palatino: { sondaje: [2, 2, 2] } },
      12: { vestibular: { sondaje: [2, 2, 2] }, palatino: { sondaje: [2, 2, 2] } },
      13: { vestibular: { sondaje: [null, null, null] } },
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sitiosTotales).toBe(15)
    expect(r.sitiosRegistrados).toBe(12)
    expect(r.sitiosSinRegistrar).toBe(3)
    expect(r.diagnosticoConcluyente).toBe(true)
  })

  it('con cobertura de sondaje por debajo del 80%, el diagnóstico no es concluyente', () => {
    // 6 sitios totales, 4 registrados (66.6%) → por debajo del umbral de 80%
    const piezasData = {
      11: { vestibular: { sondaje: [2, 2, 2] } }, // 3 sitios, todos registrados
      12: { vestibular: { sondaje: [2, null, null] } }, // 3 sitios, 1 registrado, 2 sin registrar
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sitiosTotales).toBe(6)
    expect(r.sitiosRegistrados).toBe(4)
    expect(r.sitiosSinRegistrar).toBe(2)
    expect(r.diagnosticoConcluyente).toBe(false)
    expect(r.diagnosticoSugerido).toMatch(/Sondaje Incompleto/i)
  })

  it('con cobertura de sondaje completa, emite un diagnóstico AAP normal basado en los sitios registrados', () => {
    const piezasData = {
      11: {
        vestibular: { sondaje: [6, 6, 6], sangrado: [true, true, true], placa: [true, true, true] },
      },
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sitiosSinRegistrar).toBe(0)
    expect(r.diagnosticoConcluyente).toBe(true)
    expect(r.diagnosticoSugerido).toBe('Periodontitis Severa / Avanzada (Etapa III / IV)')
  })

  // ===========================================================================
  // COMPORTAMIENTO CORREGIDO (F1-04b) — parámetro factoresRiesgo conectado
  // Antes de F1-04b, la función solo declaraba `piezasData` como parámetro;
  // el `factoresRiesgo` que le pasa PeriodontogramaModulo.jsx se descartaba
  // en silencio y el Grado AAP se calculaba SIEMPRE como si el paciente no
  // fuera fumador ni diabético, sin importar lo que el profesional marcara
  // en la UI.
  // ===========================================================================
  it('factoresRiesgo (fumador/diabetes) se conecta correctamente al Grado AAP calculado', () => {
    const piezasData = {
      11: { vestibular: { sondaje: [2, 2, 2] } },
    }
    const sinFactores = calcularIndicesPeriodontales(piezasData, { fumador: false, diabetes: false })
    const conFumador = calcularIndicesPeriodontales(piezasData, { fumador: true, diabetes: false })

    expect(sinFactores.gradoAAP).not.toBe('Grado C (Riesgo Elevado de Progresión Rápida)')
    expect(conFumador.gradoAAP).toBe('Grado C (Riesgo Elevado de Progresión Rápida)')
  })

  it('sin factoresRiesgo explícito, usa el default seguro (no fumador, no diabético)', () => {
    const piezasData = { 11: { vestibular: { sondaje: [2, 2, 2] } } }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.gradoAAP).not.toBe('Grado C (Riesgo Elevado de Progresión Rápida)')
  })
})


// ========================================
// Tests F1-04e: nuevas métricas (sacos, supuración, promedio, ausentes)
// ========================================

describe('calcularIndicesPeriodontales - F1-04e métricas adicionales', () => {
  it('cuenta sacos moderados (4-5mm) y severos (≥6mm)', () => {
    const piezasData = {
      '1.1': {
        vestibular: {
          sondaje: [3, 4, 5], // 0 moderados, 2 moderados
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        },
        palatino: {
          sondaje: [6, 7, 2], // 2 severos
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        }
      }
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sacosModerados).toBe(2) // 4mm y 5mm
    expect(r.sacosSeveros).toBe(2) // 6mm y 7mm
  })

  it('calcula porcentaje de supuración correctamente', () => {
    const piezasData = {
      '1.1': {
        vestibular: {
          sondaje: [3, 3, 3],
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [true, false, true] // 2 de 3 con supuración
        },
        palatino: {
          sondaje: [3, 3, 3],
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, true] // 1 de 3 con supuración
        }
      }
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sitiosSupuracion).toBe(3) // 2 + 1
    expect(r.porcentajeSupuracion).toBe(50) // 3/6 = 50%
  })

  it('calcula promedio de sondaje con 1 decimal', () => {
    const piezasData = {
      '1.1': {
        vestibular: {
          sondaje: [2, 3, 4],
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        },
        palatino: {
          sondaje: [5, 3, 1],
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        }
      }
    }
    const r = calcularIndicesPeriodontales(piezasData)
    // (2+3+4+5+3+1) / 6 = 18/6 = 3.0
    expect(r.promedioSondaje).toBe('3.0')
  })

  it('retorna promedioSondaje como string "0.0" cuando no hay sitios registrados', () => {
    const piezasData = {
      '1.1': {
        vestibular: {
          sondaje: [null, null, null],
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        }
      }
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.promedioSondaje).toBe('0.0')
  })

  it('cuenta dientes ausentes correctamente', () => {
    const piezasData = {
      '1.1': { ausente: true },
      '1.2': { ausente: true },
      '1.3': {
        vestibular: {
          sondaje: [3, 3, 3],
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        },
        palatino: {
          sondaje: [3, 3, 3],
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        }
      }
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.dientesAusentes).toBe(2)
    // Las piezas ausentes no cuentan como sitios
    expect(r.sitiosTotales).toBe(6) // solo 1.3 tiene vestibular+palatino
  })

  it('excluye sitios sin registrar del promedio y conteos de sacos', () => {
    const piezasData = {
      '1.1': {
        vestibular: {
          sondaje: [null, 5, 7], // null no cuenta
          sangrado: [false, false, false],
          placa: [false, false, false],
          supuracion: [false, false, false]
        }
      }
    }
    const r = calcularIndicesPeriodontales(piezasData)
    expect(r.sitiosSinRegistrar).toBe(1)
    expect(r.sitiosRegistrados).toBe(2)
    expect(r.sacosModerados).toBe(1) // 5mm
    expect(r.sacosSeveros).toBe(1) // 7mm
    expect(r.maxSondaje).toBe(7)
    // (5+7) / 2 = 6.0
    expect(r.promedioSondaje).toBe('6.0')
  })
})