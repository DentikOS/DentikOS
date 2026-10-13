/**
 * Tests unitarios de anestesiaCalc (F4-03d — refactorización con vademécum v1.1).
 *
 * Cobertura:
 * - Tests existentes de F1-03 (preservados con ajuste de mgMax)
 * - Tests nuevos de API legada (búsqueda normalizada)
 * - Tests nuevos de API enriquecida (poblaciones, advertencias)
 * - Tests de integración con vademecumService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de vademecumService
vi.mock('../../infrastructure/clinical-data/vademecumService', () => ({
  vademecumService: {
    obtenerDosisAnestesia: vi.fn(() => [])
  }
}))

describe('anestesiaCalc', () => {
  let calcularTubosAnestesia
  let calcularDosisAnestesiaCompleta
  let listarAnestesicosDisponibles
  let vademecumService

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    const module = await import('./anestesiaCalc')
    const serviceModule = await import('../../infrastructure/clinical-data/vademecumService')

    calcularTubosAnestesia = module.calcularTubosAnestesia
    calcularDosisAnestesiaCompleta = module.calcularDosisAnestesiaCompleta
    listarAnestesicosDisponibles = module.listarAnestesicosDisponibles
    vademecumService = serviceModule.vademecumService

    // Por defecto: forzar uso de datos de respaldo v1.0
    vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([])
  })

  // ═══════════════════════════════════════════════════════════
  // TESTS DE F1-03 (preservados — regresión con tope absoluto F4-03d)
  // ═══════════════════════════════════════════════════════════

  describe('calcularTubosAnestesia (API legada F1-03 + tope F4-03d)', () => {
    it('REGRESIÓN F1-03: Lidocaína 70kg → 8 tubos (tope absoluto aplicado)', () => {
      const resultado = calcularTubosAnestesia(70, 'lidocaina')
      expect(resultado.estado).toBe('OK')
      expect(resultado.tubos).toBe(8)
      // 70×4.4=308, pero tope absoluto=300mg (vademécum v1.1 Chile conservador)
      expect(resultado.mgMax).toBe('300')
    })

    it('REGRESIÓN F1-03: peso inválido → DATOS_INCOMPLETOS', () => {
      expect(calcularTubosAnestesia(null, 'lidocaina').estado).toBe('DATOS_INCOMPLETOS')
      expect(calcularTubosAnestesia('', 'lidocaina').estado).toBe('DATOS_INCOMPLETOS')
      expect(calcularTubosAnestesia(0, 'lidocaina').estado).toBe('DATOS_INCOMPLETOS')
      expect(calcularTubosAnestesia(-10, 'lidocaina').estado).toBe('DATOS_INCOMPLETOS')
      expect(calcularTubosAnestesia('abc', 'lidocaina').estado).toBe('DATOS_INCOMPLETOS')
    })

    it('REGRESIÓN F1-03: anestésico desconocido → ANESTESICO_DESCONOCIDO', () => {
      const resultado = calcularTubosAnestesia(70, 'anestesico_inexistente')
      expect(resultado.estado).toBe('ANESTESICO_DESCONOCIDO')
      expect(resultado.tubos).toBeNull()
      expect(resultado.mgMax).toBeNull()
    })

    it('Mepivacaína 70kg → 7 tubos', () => {
      const resultado = calcularTubosAnestesia(70, 'mepivacaina')
      expect(resultado.estado).toBe('OK')
      expect(resultado.tubos).toBe(7)
    })

    it('Articaína 70kg → 6 tubos', () => {
      const resultado = calcularTubosAnestesia(70, 'articaina')
      expect(resultado.estado).toBe('OK')
      expect(resultado.tubos).toBe(6)
    })

    it('Bupivacaína 70kg → 10 tubos', () => {
      const resultado = calcularTubosAnestesia(70, 'bupivacaina')
      expect(resultado.estado).toBe('OK')
      expect(resultado.tubos).toBe(10)
    })

    it('Aplica tope absoluto en paciente con sobrepeso (120 kg)', () => {
      const resultado = calcularTubosAnestesia(120, 'lidocaina')
      expect(resultado.estado).toBe('OK')
      expect(resultado.mgMax).toBe('300')
      expect(resultado.tubos).toBe(8)
    })

    it('Acepta peso como string', () => {
      const resultado = calcularTubosAnestesia('70', 'lidocaina')
      expect(resultado.estado).toBe('OK')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TESTS NUEVOS F4-03d (API legada extendida)
  // ═══════════════════════════════════════════════════════════

  describe('calcularTubosAnestesia (F4-03d extensiones)', () => {
    it('Búsqueda por número de vademécum', () => {
      const resultado = calcularTubosAnestesia(70, 1)
      expect(resultado.estado).toBe('OK')
    })

    it('Búsqueda por texto en nombre genérico', () => {
      const resultado = calcularTubosAnestesia(70, 'lidoca')
      expect(resultado.estado).toBe('OK')
    })

    it('Búsqueda case-insensitive y sin tildes', () => {
      expect(calcularTubosAnestesia(70, 'LIDOCAINA').estado).toBe('OK')
      expect(calcularTubosAnestesia(70, 'Lidocaína').estado).toBe('OK')
      expect(calcularTubosAnestesia(70, 'ARTICAINA').estado).toBe('OK')
      expect(calcularTubosAnestesia(70, 'Articaína').estado).toBe('OK')
    })

    it('Búsqueda con tildes en el nombre', () => {
      const resultado = calcularTubosAnestesia(70, 'Lidocaína')
      expect(resultado.estado).toBe('OK')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TESTS NUEVOS F4-03d (API enriquecida)
  // ═══════════════════════════════════════════════════════════

  describe('calcularDosisAnestesiaCompleta (API nueva F4-03d)', () => {
    it('Caso adulto básico: 70kg + Lidocaína', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.anestesiaInfo).toBeDefined()
      expect(resultado.anestesiaInfo.nombreGenerico).toContain('Lidocaína')
      expect(resultado.calculos).toBeDefined()
      expect(resultado.calculos.mgMaximo).toBeLessThanOrEqual(300)
      expect(resultado.calculos.tubosMaximo).toBeGreaterThan(0)
      expect(resultado.calculos.mlMaximo).toBeGreaterThan(0)
      expect(resultado.calculos.epinefrinaMg).toBeGreaterThan(0)
      expect(Array.isArray(resultado.advertencias)).toBe(true)
    })

    it('Caso pediátrico: 20kg + Lidocaína (usa dosis pediátrica)', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 20,
        tipoAnestesico: 'lidocaina',
        esPediatria: true
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.calculos.mgMaximo).toBeCloseTo(88, 0)
      expect(resultado.calculos.dosisPorKgUsada).toBe('pediatrica')
    })

    it('Caso adulto con sobrepeso (120kg): aplica tope absoluto', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 120,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.calculos.mgMaximo).toBe(300)
      expect(resultado.calculos.topeUsado).toBe(300)
      expect(resultado.advertencias.some((a) => a.includes('tope absoluto'))).toBe(true)
    })

    it('Cardiopata + vasoconstrictor: advertencia de límite Epi', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina',
        esCardiopata: true
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.advertencias.some((a) =>
        a.toLowerCase().includes('cardiopatía') ||
        a.toLowerCase().includes('epinefrina')
      )).toBe(true)
    })

    it('Embarazo + Felipresina: advertencia específica', async () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([
        {
          id: 5,
          nombre: 'Prilocaína 3% + Felipresina 0.03 UI/ml',
          familia: 'anestesico_amida',
          presentacion: 'Tubos 1.8 ml',
          dosisMaxAdulto_mgPorKg: 6.0,
        dosisMaxPediatrico_mgPorKg: 4.4,
          topeAbsolutoAdulto_mg: 400,
        topeAbsolutoPediatrico_mg: null,
          mgPorKgAdultoPediatrico: 4.4,
          contenidoPorUnidad_mg: 54,
          volumenPorUnidad_ml: 1.8,
          concentracion_mgPorMl: 30,
          contraindicaciones: 'Metahemoglobinemia, embarazo (efecto oxitócico)',
          notas: null
        }
      ])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 60,
        tipoAnestesico: 'prilocaina',
        esEmbarazo: true
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.advertencias.some((a) =>
        a.toLowerCase().includes('felipresina') ||
        a.toLowerCase().includes('embarazo')
      )).toBe(true)
    })

    it('Paciente <12 años + Bupivacaína: DATOS_INCOMPLETOS con advertencia', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 35,
        tipoAnestesico: 'bupivacaina',
        edad: 10,
        esPediatria: true
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.mensaje).toContain('Bupivacaína')
      expect(resultado.mensaje).toContain('12 años')
      expect(resultado.advertencias.some((a) => a.includes('Bupivacaína contraindicada'))).toBe(true)
    })

    it('Paciente <4 años + Articaína: DATOS_INCOMPLETOS con advertencia', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 15,
        tipoAnestesico: 'articaina',
        edad: 3,
        esPediatria: true
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.mensaje).toContain('Articaína')
      expect(resultado.mensaje).toContain('4 años')
    })

    it('Peso inválido: DATOS_INCOMPLETOS (fail-safe preservado)', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: null,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.anestesiaInfo).toBeNull()
      expect(resultado.calculos).toBeNull()
    })

    it('Anestésico desconocido: ANESTESICO_DESCONOCIDO', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'anestesico_inexistente'
      })

      expect(resultado.estado).toBe('ANESTESICO_DESCONOCIDO')
      expect(resultado.anestesiaInfo).toBeNull()
    })

    it('Mepivacaína sin vaso: epinefrina debe ser 0', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'mepivacaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.calculos.epinefrinaMg).toBe(0)
    })

    it('Paciente de bajo peso (<50kg) genera advertencia', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 45,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.advertencias.some((a) => a.includes('50 kg'))).toBe(true)
    })

    it('Volumen máximo correcto (mgMax / concentracionMgPorMl)', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.calculos.mlMaximo).toBeCloseTo(15, 0)
    })

    it('Cálculo de tubos correcto (mlMax / volumenPorTubo)', () => {
      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.calculos.tubosMaximo).toBe(8)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TESTS NUEVOS F4-03d (integración con vademecumService)
  // ═══════════════════════════════════════════════════════════

  describe('Integración con vademecumService (F4-03d)', () => {
    it('Usa datos de vademecumService cuando están disponibles', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([
        {
          id: 1,
          nombre: 'Lidocaína 2% + Epinefrina 1:100.000',
          familia: 'anestesico_amida',
          presentacion: 'Tubos 1.8 ml',
          dosisMaxAdulto_mgPorKg: 4.4,
        dosisMaxPediatrico_mgPorKg: 4.4,
          topeAbsolutoAdulto_mg: 300,
        topeAbsolutoPediatrico_mg: null,
          mgPorKgAdultoPediatrico: 4.4,
          contenidoPorUnidad_mg: 36,
          volumenPorUnidad_ml: 1.8,
          concentracion_mgPorMl: 20,
          contraindicaciones: 'Test contraindicación',
          notas: 'Test notas'
        }
      ])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.anestesiaInfo.nombreGenerico).toContain('Lidocaína')
    })

    it('Fallback a datos hardcodeados si vademecumService retorna vacío', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.anestesiaInfo).toBeDefined()
    })

    it('Fallback a datos hardcodeados si vademecumService falla', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockImplementation(() => {
        throw new Error('Error de red')
      })

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina'
      })

      expect(resultado.estado).toBe('OK')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TESTS NUEVOS F4-03d (utilidades)
  // ═══════════════════════════════════════════════════════════

  describe('listarAnestesicosDisponibles (F4-03d)', () => {
    it('Retorna array con todos los anestésicos de respaldo', () => {
      const lista = listarAnestesicosDisponibles()

      expect(Array.isArray(lista)).toBe(true)
      expect(lista.length).toBeGreaterThanOrEqual(4)
      expect(lista.some((a) => a.nombreGenerico.toLowerCase().includes('lidocaína') || a.nombreGenerico.toLowerCase().includes('lidocaina'))).toBe(true)
      expect(lista.some((a) => a.nombreGenerico.toLowerCase().includes('mepivacaína') || a.nombreGenerico.toLowerCase().includes('mepivacaina'))).toBe(true)
    })

    it('Cada anestésico tiene los campos requeridos', () => {
      const lista = listarAnestesicosDisponibles()

      lista.forEach((a) => {
        expect(a).toHaveProperty('nombreGenerico')
        expect(a).toHaveProperty('familia')
        expect(a).toHaveProperty('concentracionMgPorMl')
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // F7-03: Tests de validación de campos obligatorios (cero defaults silenciosos)
  // ═══════════════════════════════════════════════════════════════
  describe('F7-03: Cero defaults numéricos silenciosos', () => {
    it('concentracionMgPorMl = null → DATOS_INCOMPLETOS (no asume 1 mg/ml)', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([{
        id: 1,
        nombre: 'Lidocaína 2%',
        familia: 'anestesico_amida',
        presentacion: 'Tubo 1.8ml',
        dosisMaxAdulto_mgPorKg: 4.28,
        dosisMaxPediatrico_mgPorKg: 4.4,
        topeAbsolutoAdulto_mg: 300,
        topeAbsolutoPediatrico_mg: null,
        contenidoPorUnidad_mg: 36,
        volumenPorUnidad_ml: 1.8,
        concentracion_mgPorMl: null,  // FALTANTE
        contraindicaciones: '',
        notas: ''
      }])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina',
        esPediatria: false
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.mensaje).toMatch(/concentracionMgPorMl/)
      expect(resultado.calculos).toBeNull()
    })

    it('volumenPorTubo = 0 → DATOS_INCOMPLETOS (no asume 1.8ml)', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([{
        id: 1,
        nombre: 'Lidocaína 2%',
        familia: 'anestesico_amida',
        presentacion: 'Tubo 1.8ml',
        dosisMaxAdulto_mgPorKg: 4.28,
        dosisMaxPediatrico_mgPorKg: 4.4,
        topeAbsolutoAdulto_mg: 300,
        topeAbsolutoPediatrico_mg: null,
        contenidoPorUnidad_mg: 36,
        volumenPorUnidad_ml: 0,  // FALTANTE (cero es inválido)
        concentracion_mgPorMl: 20,
        contraindicaciones: '',
        notas: ''
      }])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina',
        esPediatria: false
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.mensaje).toMatch(/volumenPorTubo/)
      expect(resultado.calculos).toBeNull()
    })

    it('mgPorTubo = undefined → DATOS_INCOMPLETOS', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([{
        id: 1,
        nombre: 'Lidocaína 2%',
        familia: 'anestesico_amida',
        presentacion: 'Tubo 1.8ml',
        dosisMaxAdulto_mgPorKg: 4.28,
        dosisMaxPediatrico_mgPorKg: 4.4,
        topeAbsolutoAdulto_mg: 300,
        topeAbsolutoPediatrico_mg: null,
        contenidoPorUnidad_mg: undefined,  // FALTANTE
        volumenPorUnidad_ml: 1.8,
        concentracion_mgPorMl: 20,
        contraindicaciones: '',
        notas: ''
      }])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina',
        esPediatria: false
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.mensaje).toMatch(/mgPorTubo/)
      expect(resultado.calculos).toBeNull()
    })

    it('múltiples campos faltantes → lista todos en el mensaje', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([{
        id: 1,
        nombre: 'Lidocaína 2%',
        familia: 'anestesico_amida',
        presentacion: 'Tubo 1.8ml',
        dosisMaxAdulto_mgPorKg: 4.28,
        dosisMaxPediatrico_mgPorKg: 4.4,
        topeAbsolutoAdulto_mg: 300,
        topeAbsolutoPediatrico_mg: null,
        contenidoPorUnidad_mg: null,
        volumenPorUnidad_ml: null,
        concentracion_mgPorMl: null,
        contraindicaciones: '',
        notas: ''
      }])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina',
        esPediatria: false
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.mensaje).toMatch(/concentracionMgPorMl/)
      expect(resultado.mensaje).toMatch(/volumenPorTubo/)
      expect(resultado.mensaje).toMatch(/mgPorTubo/)
      expect(resultado.calculos).toBeNull()
    })

    it('mgPorKgPediatrico = null en paciente pediátrico → DATOS_INCOMPLETOS (no fallback silencioso a adulto)', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([{
        id: 2,
        nombre: 'Mepivacaína 3%',
        familia: 'anestesico_amida',
        presentacion: 'Tubo 1.8ml',
        dosisMaxAdulto_mgPorKg: 5.71,
        dosisMaxPediatrico_mgPorKg: null,  // FALTANTE (ejemplo hipotético)
        topeAbsolutoAdulto_mg: 400,
        topeAbsolutoPediatrico_mg: null,
        contenidoPorUnidad_mg: 54,
        volumenPorUnidad_ml: 1.8,
        concentracion_mgPorMl: 30,
        contraindicaciones: '',
        notas: ''
      }])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 20,
        tipoAnestesico: 'mepivacaina',
        esPediatria: true,
        edad: 10
      })

      expect(resultado.estado).toBe('DATOS_INCOMPLETOS')
      expect(resultado.mensaje).toMatch(/Dosis pediátrica no disponible/)
      expect(resultado.mensaje).toMatch(/No se aplica dosis adulta a pacientes pediátricos/)
      expect(resultado.calculos).toBeNull()
    })

    it('campos válidos → OK (todos los campos obligatorios presentes)', () => {
      vi.mocked(vademecumService.obtenerDosisAnestesia).mockReturnValue([{
        id: 1,
        nombre: 'Lidocaína 2%',
        familia: 'anestesico_amida',
        presentacion: 'Tubo 1.8ml',
        dosisMaxAdulto_mgPorKg: 4.28,
        dosisMaxPediatrico_mgPorKg: 4.4,
        topeAbsolutoAdulto_mg: 300,
        topeAbsolutoPediatrico_mg: null,
        contenidoPorUnidad_mg: 36,
        volumenPorUnidad_ml: 1.8,
        concentracion_mgPorMl: 20,
        contraindicaciones: '',
        notas: ''
      }])

      const resultado = calcularDosisAnestesiaCompleta({
        peso: 70,
        tipoAnestesico: 'lidocaina',
        esPediatria: false
      })

      expect(resultado.estado).toBe('OK')
      expect(resultado.calculos).not.toBeNull()
      expect(resultado.calculos.tubosMaximo).toBeGreaterThan(0)
    })
  })

})
