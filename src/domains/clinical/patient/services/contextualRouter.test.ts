import { describe, it, expect } from 'vitest'
import { determinarPestanaDefault } from './contextualRouter'

describe('Contextual Router (BP06 §09)', () => {
  it('Caso 1: Cita activa en box clínico dirige prioritariamente a Odontograma', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: false, diasSinVisita: 10, presupuestoPendienteDias: 0 },
      { citaActiva: true }
    )
    expect(pestana).toBe('odontograma')
  })

  it('Caso 2: Paciente nuevo sin ficha previa abre pestaña Datos', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: true, diasSinVisita: 0, presupuestoPendienteDias: 0 },
      { citaActiva: false }
    )
    expect(pestana).toBe('datos')
  })

  it('Caso 3: Presupuesto pendiente por más de 7 días abre pestaña Presupuestos', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: false, diasSinVisita: 20, presupuestoPendienteDias: 8 },
      { citaActiva: false }
    )
    expect(pestana).toBe('presupuestos')
  })

  it('Caso 4: Cita con prestación periodontal abre Periodontograma', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: false, diasSinVisita: 30, presupuestoPendienteDias: 0 },
      { citaActiva: false, prestacion: { categoria: 'periodoncia' } }
    )
    expect(pestana).toBe('periodontograma')
  })

  it('Caso 5: Paciente sin visita por más de 180 días abre Resumen Ejecutivo', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: false, diasSinVisita: 181, presupuestoPendienteDias: 0 },
      { citaActiva: false }
    )
    expect(pestana).toBe('resumen-ejecutivo')
  })

  it('Caso 6: Restaura última pestaña usada cuando no hay condiciones prioritarias (Evoluciones)', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: false, diasSinVisita: 45, presupuestoPendienteDias: 0, ultimaPestanaUsada: 'evoluciones' },
      { citaActiva: false }
    )
    expect(pestana).toBe('evoluciones')
  })

  it('Caso 7: Restaura última pestaña usada (Timeline)', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: false, diasSinVisita: 45, presupuestoPendienteDias: 0, ultimaPestanaUsada: 'timeline' },
      { citaActiva: false }
    )
    expect(pestana).toBe('timeline')
  })

  it('Caso 8: Fallback predeterminado es Resumen Ejecutivo', () => {
    const pestana = determinarPestanaDefault(
      { esNuevo: false, diasSinVisita: 60, presupuestoPendienteDias: 0 },
      { citaActiva: false }
    )
    expect(pestana).toBe('resumen-ejecutivo')
  })
})
