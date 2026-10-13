import { describe, it, expect } from 'vitest'
import { pacienteSchema, listaPacientesSchema, validarListaPacientes, rutDuplicado } from './pacienteSchema'

describe('pacienteSchema (F6-G)', () => {
  const pacienteValido = {
    id: 1,
    nombre: 'Juan Pérez',
    rut: '12.345.678-5'
  }

  describe('pacienteSchema básico', () => {
    it('acepta paciente válido con RUT de módulo 11', () => {
      const result = pacienteSchema.safeParse(pacienteValido)
      expect(result.success).toBe(true)
    })

    it('rechaza paciente sin RUT', () => {
      const result = pacienteSchema.safeParse({ ...pacienteValido, rut: '' })
      expect(result.success).toBe(false)
    })

    it('rechaza RUT con dígito verificador inválido', () => {
      const result = pacienteSchema.safeParse({ ...pacienteValido, rut: '12.345.678-0' })
      expect(result.success).toBe(false)
      expect(result.error.issues[0].message).toContain('RUT inválido')
    })

    it('acepta RUT con K mayúscula y minúscula', () => {
      const conK = { ...pacienteValido, rut: '12.345.670-K' }
      const conk = { ...pacienteValido, rut: '12.345.670-k' }
      expect(pacienteSchema.safeParse(conK).success).toBe(true)
      expect(pacienteSchema.safeParse(conk).success).toBe(true)
    })

    it('rechaza RUT demasiado corto', () => {
      const result = pacienteSchema.safeParse({ ...pacienteValido, rut: '1-9' })
      expect(result.success).toBe(false)
    })

    it('acepta RUT de 7 dígitos (mínimo válido)', () => {
      const result = pacienteSchema.safeParse({ ...pacienteValido, rut: '7.654.321-6' })
      expect(result.success).toBe(true)
    })

    it('passthrough: acepta campos adicionales de anamnesis', () => {
      const conAnamnesis = {
        ...pacienteValido,
        alergias: 'Polen',
        enfermedades: 'Ninguna',
        campoNoCatalogado: 'valor'
      }
      const result = pacienteSchema.safeParse(conAnamnesis)
      expect(result.success).toBe(true)
      expect(result.data.campoNoCatalogado).toBe('valor')
    })

    it('acepta null en campos opcionales de BP06 (como los devueltos por Supabase)', () => {
      const conNulls = {
        ...pacienteValido,
        estado: null,
        fechaCreacion: null,
        fechaUltimaVisita: null,
        doctorTratanteId: null,
        doctorTratante: null,
        bloqueado: null,
        motivoBloqueo: null,
        etiquetas: null,
        diasSinVisita: null,
        tutorLegal: null
      }
      const result = pacienteSchema.safeParse(conNulls)
      expect(result.success).toBe(true)
    })
  })

  describe('validarListaPacientes', () => {
    it('valida lista de pacientes válidos', () => {
      const lista = [pacienteValido, { ...pacienteValido, id: 2, rut: '11.111.111-1' }]
      const result = validarListaPacientes(lista)
      expect(result.valido).toBe(true)
      expect(result.datos).toHaveLength(2)
    })

    it('rechaza lista con RUT inválido', () => {
      const lista = [pacienteValido, { ...pacienteValido, id: 2, rut: '12.345.678-0' }]
      const result = validarListaPacientes(lista)
      expect(result.valido).toBe(false)
      expect(result.error).not.toBeNull()
    })
  })

  describe('rutDuplicado (F6-G)', () => {
    const pacientes = [
      { id: 1, rut: '12.345.678-5', nombre: 'Juan' },
      { id: 2, rut: '11.111.111-1', nombre: 'María' }
    ]

    it('detecta RUT duplicado con formato idéntico', () => {
      expect(rutDuplicado('12.345.678-5', pacientes)).toBe(true)
    })

    it('detecta RUT duplicado con formato diferente (normalización)', () => {
      expect(rutDuplicado('12345678-5', pacientes)).toBe(true)
      expect(rutDuplicado('123456785', pacientes)).toBe(true)
    })

    it('excluye paciente actual en modo edición', () => {
      expect(rutDuplicado('12.345.678-5', pacientes, 1)).toBe(false)
    })

    it('retorna false para RUT nuevo', () => {
      expect(rutDuplicado('7.654.321-6', pacientes)).toBe(false)
    })

    it('maneja RUT vacío', () => {
      expect(rutDuplicado('', pacientes)).toBe(false)
      expect(rutDuplicado(null, pacientes)).toBe(false)
    })

    it('maneja pacientes sin RUT', () => {
      const conSinRut = [...pacientes, { id: 3, nombre: 'Sin RUT' }]
      expect(rutDuplicado('12.345.678-5', conSinRut)).toBe(true)
    })
  })
})
