/**
 * Persistencia aislada en LocalStorage para Esterilización (Cargas, Biológicos y Test Diarios)
 */
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import type {
  CargaEsterilizacion,
  PruebaBiologica,
  TestBowieDick
} from '../constants/esterilizacionConstants'

const STORAGE_KEY_CARGAS = 'studio_dental_esterilizacion_cargas'
const STORAGE_KEY_BIOLOGICOS = 'studio_dental_esterilizacion_biologicos'
const STORAGE_KEY_TEST_DIARIOS = 'studio_dental_esterilizacion_test_diarios'

// F7-36 FASE 1 (Commit 1.5d): migrados a createTenantRepository para aislamiento multi-tenant.
// Claves legacy ahora: sd_<clinicaId>_studio_dental_esterilizacion_*
const cargasRepo = createTenantRepository<CargaEsterilizacion[]>(STORAGE_KEY_CARGAS, [])
const biologicosRepo = createTenantRepository<PruebaBiologica[]>(STORAGE_KEY_BIOLOGICOS, [])
const testDiariosRepo = createTenantRepository<TestBowieDick[]>(STORAGE_KEY_TEST_DIARIOS, [])

export const esterilizacionStorageService = {
  obtenerCargas: (defaults?: CargaEsterilizacion[]): CargaEsterilizacion[] => cargasRepo.obtener(defaults),
  guardarCargas: (cargas: CargaEsterilizacion[]): boolean => cargasRepo.guardar(cargas),

  obtenerBiologicos: (defaults?: PruebaBiologica[]): PruebaBiologica[] => biologicosRepo.obtener(defaults),
  guardarBiologicos: (biologicos: PruebaBiologica[]): boolean => biologicosRepo.guardar(biologicos),

  obtenerTestDiarios: (defaults?: TestBowieDick[]): TestBowieDick[] => testDiariosRepo.obtener(defaults),
  guardarTestDiarios: (tests: TestBowieDick[]): boolean => testDiariosRepo.guardar(tests),

  /**
   * Obtiene información del autoclave activo para el widget de Esterilización del Dashboard.
   * Retorna null si no hay ciclos activos.
   */
  obtenerInfoEsterilizacionDashboard: (): {
    equipo: string
    ciclo: number
    temperatura: string
    tiempoRestante: string
    estado: 'en_curso' | 'validado' | 'espera'
  } | null => {
    try {
      const cargas = esterilizacionStorageService.obtenerCargas() || []

      // Buscar carga activa (no aprobada / no conforme)
      const cargaActiva = cargas.find((c) => c.estado !== 'Aprobado' && c.estado !== 'Conforme')

      if (!cargaActiva) {
        // Buscar última carga validada
        const ultimaValidada = cargas
          .filter((c) => c.estado === 'Aprobado' || c.estado === 'Conforme')
          .sort((a, b) => {
            const tA = (a as unknown as { fechaInicio?: string }).fechaInicio
              ? new Date((a as unknown as { fechaInicio?: string }).fechaInicio!).getTime()
              : (typeof a.id === 'number' ? a.id : 0)
            const tB = (b as unknown as { fechaInicio?: string }).fechaInicio
              ? new Date((b as unknown as { fechaInicio?: string }).fechaInicio!).getTime()
              : (typeof b.id === 'number' ? b.id : 0)
            return tB - tA
          })[0]

        if (ultimaValidada) {
          return {
            equipo: ultimaValidada.equipo || 'Autoclave Principal #01',
            ciclo: Number(ultimaValidada.lote?.replace(/\D/g, '')) || Number(ultimaValidada.lote) || 0,
            temperatura: `${ultimaValidada.temperatura || 134}°C`,
            tiempoRestante: 'Completado',
            estado: 'validado'
          }
        }

        return null // No hay datos reales
      }

      // Calcular tiempo restante si está en curso
      let tiempoRestante = 'En proceso'
      const fechaInicio = (cargaActiva as unknown as { fechaInicio?: string }).fechaInicio
      const inicio = fechaInicio ? new Date(fechaInicio).getTime() : (typeof cargaActiva.id === 'number' ? cargaActiva.id : 0)
      if (inicio) {
        const duracionMin = cargaActiva.tiempoMinutos || 45 // duración típica de autoclave
        const transcurrido = Math.floor((Date.now() - inicio) / 60000)
        const restante = Math.max(0, duracionMin - transcurrido)
        tiempoRestante = restante > 0 ? `${restante} min` : 'Finalizando'
      }

      return {
        equipo: cargaActiva.equipo || 'Autoclave Principal #01',
        ciclo: Number(cargaActiva.lote?.replace(/\D/g, '')) || Number(cargaActiva.lote) || 0,
        temperatura: `${cargaActiva.temperatura || 134}°C`,
        tiempoRestante,
        estado: 'en_curso'
      }
    } catch (e) {
      console.error('Error obteniendo info esterilización:', e)
      return null
    }
  }
}
