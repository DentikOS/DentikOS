import { describe, expect, it } from 'vitest'
import { fechaClinica, inicioSemanaClinica } from './esterilizacionDate'

describe('esterilizacionDate', () => {
  it('evalúa el día en la zona horaria de la clínica', () => {
    expect(fechaClinica('2026-11-05T02:30:00.000Z', 'America/Santiago')).toBe('2026-11-04')
  })

  it('calcula la semana de lunes a domingo según la fecha local', () => {
    expect(inicioSemanaClinica('2026-11-05T02:30:00.000Z', 'America/Santiago')).toBe('2026-11-02')
  })
})
