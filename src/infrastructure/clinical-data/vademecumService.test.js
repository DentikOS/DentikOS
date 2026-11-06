/**
 * Tests unitarios de vademecumService (F4-03c).
 *
 * Cobertura:
 * - Lectura de fármacos regulares (con y sin caché)
 * - Filtrado por familia
 * - Búsqueda por número y nombre
 * - Fármacos de urgencia y antirresortivos
 * - Matriz de alergias cruzadas
 * - Evaluación de alergia cruzada específica
 * - Interacciones farmacológicas
 * - Protocolos de profilaxis endocarditis
 * - Manejo de anticoagulantes
 * - Metadata de curación
 * - Datos de anestesia
 * - Fallback a datos de respaldo mínimos
 * - Comportamiento con USE_SUPABASE=false
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock de supabaseClient
vi.mock('../supabase/supabaseClient', () => ({
  get USE_SUPABASE() {
    return globalThis.__mockUseSupabase ?? false
  },
  get supabase() {
    return globalThis.__mockSupabase ?? null
  }
}))

// Mock de localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('vademecumService', () => {
  let vademecumService

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorageMock.clear()

    // Por defecto: USE_SUPABASE=false para tests de fallback
    globalThis.__mockUseSupabase = false
    globalThis.__mockSupabase = null

    vi.resetModules()
    const module = await import('./vademecumService')
    vademecumService = module.vademecumService
    vademecumService.limpiarCache()
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete globalThis.__mockUseSupabase
    delete globalThis.__mockSupabase
  })

  describe('obtenerVademecum (fallback sin Supabase)', () => {
    it('debe retornar array de fármacos regulares', () => {
      const vademecum = vademecumService.obtenerVademecum()
      expect(Array.isArray(vademecum)).toBe(true)
      expect(vademecum.length).toBeGreaterThan(0)
    })

    it('debe retornar datos de respaldo mínimos si no hay datos en localStorage', () => {
      const vademecum = vademecumService.obtenerVademecum()
      // Debe tener al menos los 22 fármacos de respaldo
      expect(vademecum.length).toBeGreaterThanOrEqual(22)

      // Verificar que el primer fármaco es Lidocaína
      const lidocaina = vademecum.find(f => f.numero === 1)
      expect(lidocaina).toBeDefined()
      expect(lidocaina.nombre_generico).toContain('Lidocaína')
    })

    it('debe excluir fármacos con activo=false', () => {
      // Simular un fármaco desactivado en localStorage
      const datosLocal = [
        { numero: 1, familia: 'penicilina', nombre_generico: 'Test 1', activo: true },
        { numero: 2, familia: 'penicilina', nombre_generico: 'Test 2', activo: false },
        { numero: 3, familia: 'aine', nombre_generico: 'Test 3', activo: true }
      ]
      localStorageMock.setItem('studio_dental_vademecum_v2', JSON.stringify(datosLocal))

      // Limpiar caché para forzar lectura desde localStorage
      vademecumService.limpiarCache()

      const vademecum = vademecumService.obtenerVademecum()
      expect(vademecum.length).toBe(2) // Solo los activos
      expect(vademecum.some(f => f.numero === 2)).toBe(false)
    })
  })

  describe('obtenerFarmacosPorFamilia', () => {
    it('debe filtrar por familia correctamente', () => {
      const penicilinas = vademecumService.obtenerFarmacosPorFamilia('penicilina')
      expect(Array.isArray(penicilinas)).toBe(true)
      expect(penicilinas.length).toBeGreaterThan(0)
      expect(penicilinas.every(f => f.familia === 'penicilina')).toBe(true)
    })

    it('debe ser case-insensitive', () => {
      const penicilinas = vademecumService.obtenerFarmacosPorFamilia('PENICILINA')
      expect(penicilinas.length).toBeGreaterThan(0)
    })

    it('debe retornar array vacío si familia no existe', () => {
      const resultado = vademecumService.obtenerFarmacosPorFamilia('familia_inexistente')
      expect(resultado).toEqual([])
    })

    it('debe retornar array vacío si familia es null o vacía', () => {
      expect(vademecumService.obtenerFarmacosPorFamilia(null)).toEqual([])
      expect(vademecumService.obtenerFarmacosPorFamilia('')).toEqual([])
    })
  })

  describe('obtenerFarmacoPorNumero', () => {
    it('debe retornar fármaco específico por número', () => {
      const farmaco = vademecumService.obtenerFarmacoPorNumero(1)
      expect(farmaco).toBeDefined()
      expect(farmaco.numero).toBe(1)
    })

    it('debe retornar null si número no existe', () => {
      const farmaco = vademecumService.obtenerFarmacoPorNumero(99999)
      expect(farmaco).toBeNull()
    })
  })

  describe('buscarFarmacoPorNombre', () => {
    it('debe retornar coincidencias por texto parcial', () => {
      const resultados = vademecumService.buscarFarmacoPorNombre('amox')
      expect(Array.isArray(resultados)).toBe(true)
      expect(resultados.length).toBeGreaterThan(0)
      expect(resultados.some(f => f.nombre_generico.toLowerCase().includes('amox'))).toBe(true)
    })

    it('debe ser case-insensitive', () => {
      const resultados = vademecumService.buscarFarmacoPorNombre('AMOX')
      expect(resultados.length).toBeGreaterThan(0)
    })

    it('debe retornar array vacío si texto tiene menos de 2 caracteres', () => {
      expect(vademecumService.buscarFarmacoPorNombre('a')).toEqual([])
      expect(vademecumService.buscarFarmacoPorNombre('')).toEqual([])
      expect(vademecumService.buscarFarmacoPorNombre(null)).toEqual([])
    })

    it('debe retornar array vacío si no hay coincidencias', () => {
      const resultados = vademecumService.buscarFarmacoPorNombre('zzzzinexistente')
      expect(resultados).toEqual([])
    })
  })

  describe('obtenerFarmacosUrgencia', () => {
    it('debe retornar array de fármacos de urgencia', () => {
      const urgencia = vademecumService.obtenerFarmacosUrgencia()
      expect(Array.isArray(urgencia)).toBe(true)
    })
  })

  describe('obtenerAntirresortivos', () => {
    it('debe retornar array de antirresortivos', () => {
      const antirresortivos = vademecumService.obtenerAntirresortivos()
      expect(Array.isArray(antirresortivos)).toBe(true)
    })
  })

  describe('obtenerAlergiasCruzadas', () => {
    it('debe retornar matriz de alergias cruzadas', () => {
      const alergias = vademecumService.obtenerAlergiasCruzadas()
      expect(Array.isArray(alergias)).toBe(true)
      expect(alergias.length).toBeGreaterThan(0)
    })

    it('debe incluir reglas de fallback mínimo', () => {
      const alergias = vademecumService.obtenerAlergiasCruzadas()
      expect(alergias.some(a => a.familia_alergia === 'penicilina')).toBe(true)
      expect(alergias.some(a => a.familia_alergia === 'aine')).toBe(true)
    })
  })

  describe('evaluarAlergiaCruzada', () => {
    it('debe detectar incompatibilidad directa (misma familia)', () => {
      const resultado = vademecumService.evaluarAlergiaCruzada('penicilina', 'penicilina')
      expect(resultado.hayIncompatibilidad).toBe(true)
      expect(resultado.severidad).toBe('critica')
    })

    it('debe retornar hayIncompatibilidad: false si no hay regla', () => {
      const resultado = vademecumService.evaluarAlergiaCruzada('penicilina', 'paracetamol')
      expect(resultado.hayIncompatibilidad).toBe(false)
      expect(resultado.severidad).toBeNull()
    })

    it('debe retornar hayIncompatibilidad: false si parámetros son null', () => {
      expect(vademecumService.evaluarAlergiaCruzada(null, 'penicilina').hayIncompatibilidad).toBe(false)
      expect(vademecumService.evaluarAlergiaCruzada('penicilina', null).hayIncompatibilidad).toBe(false)
    })

    it('debe ser case-insensitive', () => {
      const resultado = vademecumService.evaluarAlergiaCruzada('PENICILINA', 'penicilina')
      expect(resultado.hayIncompatibilidad).toBe(true)
    })
  })

  describe('obtenerInteracciones', () => {
    it('debe retornar array de interacciones', () => {
      const interacciones = vademecumService.obtenerInteracciones()
      expect(Array.isArray(interacciones)).toBe(true)
    })
  })

  describe('obtenerInteraccionesDeFarmaco', () => {
    it('debe filtrar interacciones que involucran el fármaco', () => {
      // Primero agregar una interacción en localStorage
      const interaccionesLocal = [
        { farmaco_a: 'Metronidazol', farmaco_b: 'Warfarina', efecto: 'Potenciación', activo: true },
        { farmaco_a: 'Amoxicilina', farmaco_b: 'Alcohol', efecto: 'Ninguno', activo: true }
      ]
      localStorageMock.setItem('studio_dental_interacciones_v2', JSON.stringify(interaccionesLocal))
      vademecumService.limpiarCache()

      const interacciones = vademecumService.obtenerInteraccionesDeFarmaco('metronidazol')
      expect(interacciones.length).toBe(1)
      expect(interacciones[0].farmaco_b).toBe('Warfarina')
    })

    it('debe retornar array vacío si farmaco es null', () => {
      expect(vademecumService.obtenerInteraccionesDeFarmaco(null)).toEqual([])
    })
  })

  describe('obtenerProfilaxisEndocarditis', () => {
    it('debe retornar array de protocolos', () => {
      const protocolos = vademecumService.obtenerProfilaxisEndocarditis()
      expect(Array.isArray(protocolos)).toBe(true)
    })
  })

  describe('obtenerManejoAnticoagulantes', () => {
    it('debe retornar array de recomendaciones', () => {
      const manejo = vademecumService.obtenerManejoAnticoagulantes()
      expect(Array.isArray(manejo)).toBe(true)
    })
  })

  describe('obtenerMetadataCuracion', () => {
    it('debe retornar metadata de respaldo mínima', () => {
      const metadata = vademecumService.obtenerMetadataCuracion()
      expect(metadata).toBeDefined()
      expect(metadata.version).toBe('v1.0')
      expect(metadata.total_farmacos).toBeGreaterThan(0)
    })

    it('debe retornar metadata desde localStorage si existe', () => {
      const metadataLocal = { version: 'v1.1', curado_por: 'Dr. Test', total_farmacos: 111 }
      localStorageMock.setItem('studio_dental_vademecum_metadata_v2', JSON.stringify(metadataLocal))
      vademecumService.limpiarCache()

      const metadata = vademecumService.obtenerMetadataCuracion()
      expect(metadata.version).toBe('v1.1')
      expect(metadata.curado_por).toBe('Dr. Test')
    })
  })

  describe('obtenerDosisAnestesia', () => {
    it('debe retornar solo anestésicos del vademécum', () => {
      const dosis = vademecumService.obtenerDosisAnestesia()
      expect(Array.isArray(dosis)).toBe(true)
      expect(dosis.length).toBeGreaterThan(0)

      // Todos deben ser familias de anestésicos
      dosis.forEach(d => {
        expect(['anestesico_amida', 'anestesico_ester', 'anestesico_topico']).toContain(d.familia)
      })
    })

    it('debe incluir Lidocaína con datos de dosis', () => {
      const dosis = vademecumService.obtenerDosisAnestesia()
      const lidocaina = dosis.find(d => d.nombre.includes('Lidocaína') && !d.nombre.includes('Spray'))

      expect(lidocaina).toBeDefined()
      expect(lidocaina.dosisMaxAdulto_mgPorKg).toBeDefined()
      expect(lidocaina.contenidoPorUnidad_mg).toBeDefined()
      expect(lidocaina.concentracion_mgPorMl).toBeDefined()
    })
  })

  describe('sincronizarDesdeSupabase (sin Supabase configurado)', () => {
    it('no debe fallar si USE_SUPABASE=false', async () => {
      await expect(vademecumService.sincronizarDesdeSupabase()).resolves.not.toThrow()
    })

    it('debe marcar estaSincronizado como false si no hay Supabase', async () => {
      await vademecumService.sincronizarDesdeSupabase()
      expect(vademecumService.estaSincronizado()).toBe(false)
    })
  })

  describe('sincronizarDesdeSupabase (Realtime)', () => {
    it('emite el evento del vademécum cuando la caché remota queda actualizada', async () => {
      globalThis.__mockUseSupabase = true
      const respuestaPara = (tabla) => {
        const resultado = {
          data: tabla === 'vademecum'
            ? [{ numero: 999, familia: 'aine', nombre_generico: 'Fármaco sincronizado', activo: true }]
            : [],
          error: null
        }
        const query = {
          select: () => query,
          eq: () => query,
          limit: () => Promise.resolve(resultado),
          then: (resolve, reject) => Promise.resolve(resultado).then(resolve, reject)
        }
        return query
      }
      globalThis.__mockSupabase = { from: vi.fn((tabla) => respuestaPara(tabla)) }

      const evento = vi.fn()
      window.addEventListener('realtime:vademecum_changed', evento)

      try {
        await vademecumService.sincronizarDesdeSupabase()

        expect(evento).toHaveBeenCalledTimes(1)
        expect(vademecumService.obtenerVademecum()[0].nombre_generico).toBe('Fármaco sincronizado')
      } finally {
        window.removeEventListener('realtime:vademecum_changed', evento)
      }
    })
  })

  describe('limpiarCache', () => {
    it('debe limpiar la caché completamente', () => {
      // Primero cargar datos
      vademecumService.obtenerVademecum()
      expect(vademecumService.estaSincronizado()).toBe(false)

      // Limpiar y verificar
      vademecumService.limpiarCache()
      expect(vademecumService.estaSincronizado()).toBe(false)
    })
  })


  describe('Métodos CRUD (F4-03f-1)', () => {
    it('guardarFarmaco retorna error si Supabase no configurado', async () => {
      globalThis.__mockUseSupabase = false
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.guardarFarmaco({ numero: 1, familia: 'test' })
      
      expect(resultado.exito).toBe(false)
      expect(resultado.error).toContain('Supabase')
    })

    it('guardarFarmaco retorna error si datos inválidos', async () => {
      globalThis.__mockUseSupabase = true
      // Mockear supabase para que pase la primera validación
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      }
      globalThis.__mockSupabase = mockSupabase
      
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.guardarFarmaco(null)
      
      expect(resultado.exito).toBe(false)
      expect(resultado.error.toLowerCase()).toContain('inválidos')
    })

    it('guardarFarmaco inserta en Supabase cuando válido', async () => {
      globalThis.__mockUseSupabase = true
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { numero: 999, familia: 'test', nombre_generico: 'Test' },
          error: null
        })
      }
      globalThis.__mockSupabase = mockSupabase
      
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.guardarFarmaco({
        numero: 999,
        familia: 'test',
        nombre_generico: 'Test'
      })
      
      expect(mockSupabase.from).toHaveBeenCalledWith('vademecum')
      expect(mockSupabase.upsert).toHaveBeenCalled()
      expect(resultado.exito).toBe(true)
      expect(resultado.data.numero).toBe(999)
    })

    it('desactivarFarmaco retorna error si Supabase no configurado', async () => {
      globalThis.__mockUseSupabase = false
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.desactivarFarmaco(1)
      
      expect(resultado.exito).toBe(false)
    })

    it('desactivarFarmaco ejecuta UPDATE en Supabase', async () => {
      globalThis.__mockUseSupabase = true
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      }
      globalThis.__mockSupabase = mockSupabase
      
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.desactivarFarmaco(1)
      
      expect(mockSupabase.from).toHaveBeenCalledWith('vademecum')
      expect(mockSupabase.update).toHaveBeenCalledWith({ activo: false })
      expect(mockSupabase.eq).toHaveBeenCalledWith('numero', 1)
      expect(resultado.exito).toBe(true)
    })

    it('reactivarFarmaco setea activo=true', async () => {
      globalThis.__mockUseSupabase = true
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      }
      globalThis.__mockSupabase = mockSupabase
      
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.reactivarFarmaco(1)
      
      expect(mockSupabase.update).toHaveBeenCalledWith({ activo: true })
      expect(resultado.exito).toBe(true)
    })

    it('guardarAlergiaCruzada inserta en alergias_cruzadas', async () => {
      globalThis.__mockUseSupabase = true
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { familia_alergia: 'penicilina', familia_farmaco: 'penicilina', severidad: 'critica' },
          error: null
        })
      }
      globalThis.__mockSupabase = mockSupabase
      
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.guardarAlergiaCruzada({
        familia_alergia: 'penicilina',
        familia_farmaco: 'penicilina',
        severidad: 'critica'
      })
      
      expect(mockSupabase.from).toHaveBeenCalledWith('alergias_cruzadas')
      expect(resultado.exito).toBe(true)
    })

    it('guardarInteraccion inserta en interacciones_farmacologicas', async () => {
      globalThis.__mockUseSupabase = true
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null })
      }
      globalThis.__mockSupabase = mockSupabase
      
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.guardarInteraccion({
        farmaco_a: 'Metronidazol',
        farmaco_b: 'Warfarina',
        efecto: 'Potenciación'
      })
      
      expect(mockSupabase.from).toHaveBeenCalledWith('interacciones_farmacologicas')
      expect(resultado.exito).toBe(true)
    })

    it('maneja error de Supabase sin romper la app', async () => {
      globalThis.__mockUseSupabase = true
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Error de constraint' }
        })
      }
      globalThis.__mockSupabase = mockSupabase
      
      vi.resetModules()
      const { vademecumService: service } = await import('./vademecumService')
      
      const resultado = await service.guardarFarmaco({ numero: 1 })
      
      expect(resultado.exito).toBe(false)
      expect(resultado.error).toContain('constraint')
    })
  })

})
