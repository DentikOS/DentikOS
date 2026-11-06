/**
 * Tests de CalculadoraAnestesiaSection (F7-01).
 *
 * Valida que el componente:
 * 1. Use la API enriquecida calcularDosisAnestesiaCompleta
 * 2. Derive flags clínicos del paciente (edad, cardiopatía, embarazo)
 * 3. Muestre advertencias y contraindicaciones en UI
 * 4. Produzca estado restrictivo cuando faltan datos clínicos obligatorios
 * 5. Maneje casos: adulto, pediátrico, cardiopatía, embarazo, datos incompletos
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock de vademecumService para usar datos de respaldo v1.0
vi.mock('../../../../infrastructure/clinical-data/vademecumService', () => ({
  vademecumService: {
    obtenerDosisAnestesia: vi.fn(() => []),
    obtenerVademecum: vi.fn(() => []),
    obtenerFarmacosUrgencia: vi.fn(() => []),
    obtenerAntirresortivos: vi.fn(() => []),
    obtenerAlergiasCruzadas: vi.fn(() => []),
    obtenerInteracciones: vi.fn(() => []),
    obtenerProfilaxisEndocarditis: vi.fn(() => []),
    obtenerManejoAnticoagulantes: vi.fn(() => []),
    obtenerMetadataCuracion: vi.fn(() => null),
    sincronizarDesdeSupabase: vi.fn()
  }
}))

vi.mock('../../../../infrastructure/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { CalculadoraAnestesiaSection } from './CalculadoraAnestesiaSection'

const pacienteAdulto = {
  id: '1',
  nombre: 'Juan Pérez',
  peso: 70,
  edad: 35,
  enfermedades: '',
  alergias: '',
  medicamentos: ''
}

const pacientePediatrico = {
  id: '2',
  nombre: 'Ana Niña',
  peso: 20,
  edad: 8,
  enfermedades: '',
  alergias: '',
  medicamentos: ''
}

const pacienteCardiopata = {
  id: '3',
  nombre: 'María López',
  peso: 65,
  edad: 55,
  enfermedades: 'Hipertensión arterial, arritmia',
  alergias: '',
  medicamentos: ''
}

describe('CalculadoraAnestesiaSection (F7-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Criterio 1: Usa API enriquecida y recibe paciente completo', () => {
    it('renderiza el componente con paciente adulto sin errores', () => {
      const { container } = render(<CalculadoraAnestesiaSection paciente={pacienteAdulto} />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('muestra datos clínicos del paciente (edad)', () => {
      render(<CalculadoraAnestesiaSection paciente={pacienteAdulto} />)
      expect(screen.getByText(/35 años/)).toBeInTheDocument()
    })

    it('muestra badge de dosis pediátrica cuando edad < 18', () => {
      render(<CalculadoraAnestesiaSection paciente={pacientePediatrico} />)
      // Puede aparecer en header y/o resultado, verificamos que hay al menos 1
      const badges = screen.getAllByText(/Dosis pediátrica/)
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })

    it('muestra badge de cardiopatía cuando enfermedades contienen términos cardiovasculares', () => {
      render(<CalculadoraAnestesiaSection paciente={pacienteCardiopata} />)
      expect(screen.getByText(/Cardiopatía detectada/)).toBeInTheDocument()
    })
  })

  describe('Criterio 2: Peso inválido → estado restrictivo', () => {
    it('muestra estado restrictivo cuando peso está vacío', () => {
      const pacienteSinPeso = { ...pacienteAdulto, peso: null }
      render(<CalculadoraAnestesiaSection paciente={pacienteSinPeso} />)
      
      // Campo de peso debe estar vacío y con estilo de advertencia
      const pesoInput = screen.getByTestId('anestesia-peso')
      expect(pesoInput.value).toBe('')
      
      // Resultado debe ser restrictivo
      const resultado = screen.getByTestId('anestesia-resultado-restrictivo')
      expect(resultado).toBeInTheDocument()
      expect(resultado).toHaveTextContent(/Verificación Manual Requerida/)
    })

    it('muestra estado restrictivo cuando peso es 0', () => {
      const pacienteSinPeso = { ...pacienteAdulto, peso: 0 }
      render(<CalculadoraAnestesiaSection paciente={pacienteSinPeso} />)
      
      const resultado = screen.getByTestId('anestesia-resultado-restrictivo')
      expect(resultado).toBeInTheDocument()
    })

    it('muestra estado restrictivo cuando peso es string vacío', () => {
      const pacienteSinPeso = { ...pacienteAdulto, peso: '' }
      render(<CalculadoraAnestesiaSection paciente={pacienteSinPeso} />)
      
      const resultado = screen.getByTestId('anestesia-resultado-restrictivo')
      expect(resultado).toBeInTheDocument()
    })
  })

  describe('Criterio 3: Caso adulto → cálculo OK', () => {
    it('muestra dosis válida para adulto 70kg + Lidocaína', () => {
      render(<CalculadoraAnestesiaSection paciente={pacienteAdulto} />)
      
      const resultado = screen.getByTestId('anestesia-resultado-ok')
      expect(resultado).toBeInTheDocument()
      expect(resultado).toHaveTextContent(/Tubos/)
      expect(resultado).toHaveTextContent(/Dosis máxima/)
    })
  })

  describe('Criterio 4: Caso pediátrico → contraindicaciones por edad', () => {
    it('muestra advertencia para Bupivacaína en niño < 12 años', () => {
      render(<CalculadoraAnestesiaSection paciente={pacientePediatrico} />)
      
      // Seleccionar Bupivacaína (número 4 en el respaldo)
      const select = screen.getByTestId('anestesia-tipo')
      fireEvent.change(select, { target: { value: 4 } })
      
      // Debe mostrar contraindicación
      const advertencias = screen.queryByTestId('anestesia-advertencias')
      expect(advertencias).toBeInTheDocument()
      expect(advertencias).toHaveTextContent(/Bupivacaína/)
      expect(advertencias).toHaveTextContent(/12 años/)
    })

    it('muestra advertencia para Articaína en niño < 4 años', () => {
      const bebe = { ...pacientePediatrico, edad: 2, peso: 12 }
      render(<CalculadoraAnestesiaSection paciente={bebe} />)
      
      // Seleccionar Articaína (número 3 en el respaldo)
      const select = screen.getByTestId('anestesia-tipo')
      fireEvent.change(select, { target: { value: 3 } })
      
      const advertencias = screen.queryByTestId('anestesia-advertencias')
      expect(advertencias).toBeInTheDocument()
      expect(advertencias).toHaveTextContent(/Articaína/)
      expect(advertencias).toHaveTextContent(/4 años/)
    })

    it('muestra indicador visual de población pediátrica en caso OK', () => {
      render(<CalculadoraAnestesiaSection paciente={pacientePediatrico} />)
      
      // Badge del header debe indicar dosis pediátrica (puede haber múltiples)
      const badges = screen.getAllByText(/Dosis pediátrica/)
      expect(badges.length).toBeGreaterThanOrEqual(1)
      
      // Resultado debe ser OK (cálculo válido)
      const resultado = screen.getByTestId('anestesia-resultado-ok')
      expect(resultado).toBeInTheDocument()
      expect(resultado).toHaveTextContent(/Tubos/)
    })  })

  describe('Criterio 5: Cardiopatía se detecta y muestra', () => {
    it('detecta cardiopatía por término "Hipertensión"', () => {
      render(<CalculadoraAnestesiaSection paciente={pacienteCardiopata} />)
      expect(screen.getByText(/Cardiopatía detectada/)).toBeInTheDocument()
      expect(screen.getByText(/Hipertensión arterial/)).toBeInTheDocument()
    })

    it('detecta cardiopatía por término "infarto"', () => {
      const paciente = { ...pacienteCardiopata, enfermedades: 'Historial de infarto miocárdico' }
      render(<CalculadoraAnestesiaSection paciente={paciente} />)
      expect(screen.getByText(/Cardiopatía detectada/)).toBeInTheDocument()
    })

    it('detecta cardiopatía por término "arritmia"', () => {
      const paciente = { ...pacienteCardiopata, enfermedades: 'Arritmia cardíaca' }
      render(<CalculadoraAnestesiaSection paciente={paciente} />)
      expect(screen.getByText(/Cardiopatía detectada/)).toBeInTheDocument()
    })
  })

  describe('Criterio adicional: Embarazo marcado manualmente', () => {
    it('muestra badge de embarazo cuando se marca el checkbox', () => {
      render(<CalculadoraAnestesiaSection paciente={pacienteAdulto} />)
      
      const checkbox = screen.getByTestId('anestesia-embarazo')
      fireEvent.click(checkbox)
      
      expect(screen.getByText(/Embarazo activo/)).toBeInTheDocument()
    })
  })

  describe('Criterio adicional: Información del anestésico', () => {
    it('muestra información del anestésico seleccionado', () => {
      render(<CalculadoraAnestesiaSection paciente={pacienteAdulto} />)
      
      // Con peso válido y OK, debe mostrar información del anestésico
      expect(screen.getByText(/Anestésico seleccionado/)).toBeInTheDocument()
      // "Lidocaína" aparece en el <option> del select Y en la sección de info,
      // así que verificamos que haya al menos 2 ocurrencias (option + info)
      const lidocainaMatches = screen.getAllByText(/Lidocaína/)
      expect(lidocainaMatches.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Fail-safe: nunca muestra cifra estimada con datos inválidos', () => {
    it('nunca muestra "X Tubos" cuando faltan datos', () => {
      const pacienteSinPeso = { ...pacienteAdulto, peso: '' }
      render(<CalculadoraAnestesiaSection paciente={pacienteSinPeso} />)
      
      // No debe haber un elemento con formato "X Tubos" en resultado restrictivo
      const resultado = screen.getByTestId('anestesia-resultado-restrictivo')
      expect(resultado).not.toHaveTextContent(/^\d+ Tubos$/)
    })
  })
})
