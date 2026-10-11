import { describe, it, expect } from 'vitest'
import {
  validarAlergiasMedicamentos,
  debePreguntarEmbarazo,
  validarAnticoagulantesCirugia,
} from './validacionesCruzadasClinicas'

describe('validacionesCruzadasClinicas (BP06 §10 Parte 2)', () => {
  describe('Validación 3: Alergias + Recetas', () => {
    it('bloquea amoxicilina si el paciente es alérgico a penicilina', () => {
      const res = validarAlergiasMedicamentos(['Amoxicilina 500mg'], 'Alergia severa a Penicilina')
      expect(res.contraindicado).toBe(true)
      expect(res.medicamentoConflictivo).toBe('Amoxicilina 500mg')
      expect(res.mensaje).toContain('penicilinas')
    })

    it('bloquea cuando las alergias están en un array', () => {
      const res = validarAlergiasMedicamentos(['Ampicilina'], ['Polen', 'Penicilina'])
      expect(res.contraindicado).toBe(true)
    })

    it('permite analgésicos si no tienen relación con la alergia', () => {
      const res = validarAlergiasMedicamentos(['Paracetamol 500mg', 'Ibuprofeno 400mg'], 'Penicilina')
      expect(res.contraindicado).toBe(false)
    })

    it('permite prescripción cuando el paciente no tiene alergias registradas', () => {
      const res = validarAlergiasMedicamentos(['Amoxicilina 500mg'], undefined)
      expect(res.contraindicado).toBe(false)
    })
  })

  describe('Validación 1: Embarazo + Sexo + Edad', () => {
    it('debe preguntar si es mujer entre 12 y 55 años sin registro previo', () => {
      expect(debePreguntarEmbarazo({ sexo: 'femenino', edad: 25, embarazo: undefined })).toBe(true)
      expect(debePreguntarEmbarazo({ genero: 'f', edad: 12, embarazo: undefined })).toBe(true)
      expect(debePreguntarEmbarazo({ sexo: 'mujer', edad: 55, embarazo: undefined })).toBe(true)
    })

    it('NO debe preguntar si ya fue respondido', () => {
      expect(debePreguntarEmbarazo({ sexo: 'femenino', edad: 25, embarazo: false })).toBe(false)
      expect(debePreguntarEmbarazo({ sexo: 'femenino', edad: 25, embarazo: true })).toBe(false)
    })

    it('NO debe preguntar si es menor de 12 o mayor de 55', () => {
      expect(debePreguntarEmbarazo({ sexo: 'femenino', edad: 10, embarazo: undefined })).toBe(false)
      expect(debePreguntarEmbarazo({ sexo: 'femenino', edad: 58, embarazo: undefined })).toBe(false)
    })

    it('NO debe preguntar a pacientes masculinos', () => {
      expect(debePreguntarEmbarazo({ sexo: 'masculino', edad: 25, embarazo: undefined })).toBe(false)
    })
  })

  describe('Validación 2: Anticoagulantes + Cirugía', () => {
    it('emite alerta crítica si paciente anticoagulado tiene cirugía', () => {
      const res = validarAnticoagulantesCirugia(true, true)
      expect(res.alertaQuirurgica).toBe(true)
      expect(res.mensaje).toContain('ALERTA CRÍTICA')
    })

    it('no emite alerta quirúrgica si el paciente no toma anticoagulantes', () => {
      const res = validarAnticoagulantesCirugia(false, true)
      expect(res.alertaQuirurgica).toBe(false)
    })

    it('no emite alerta quirúrgica si no es procedimiento quirúrgico', () => {
      const res = validarAnticoagulantesCirugia(true, false)
      expect(res.alertaQuirurgica).toBe(false)
    })
  })
})
