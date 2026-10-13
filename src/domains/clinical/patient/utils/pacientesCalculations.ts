import { finanzasStorageService } from '../../../../domains/billing/cash-register/services/finanzasStorageService'
import { vademecumService, type FarmacoVademecum, type AlergiaCruzadaItem } from '../../../../infrastructure/clinical-data/vademecumService'
import {
  detectarFamiliaFarmaco,
  detectarFamiliasAlergia,
  generarMensajeDinamico,
  evaluarIncompatibilidadLegacy,
  type IncompatibilidadLegacyResultado
} from './pacientesAlergiaCalculations'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('pacientesCalculations')

export interface AlternativaSegura {
  nombre: string
  familia: string
  familia_legible: string
}

export interface IncompatibilidadFarmacoResultado {
  tipo: 'critica' | 'advertencia' | 'sin_datos' | string
  mensaje: string
  sugerencia: string
  familiaFarmaco?: string
  familiaAlergia?: string
  porcentajeCruzado?: string | number | null
  notaClinica?: string | null
  alternativas?: AlternativaSegura[]
}

export const obtenerDescuentoConvenio = (nombreConvenio?: string | null): number => {
  if (!nombreConvenio || typeof nombreConvenio !== 'string') return 0
  try {
    const convenios = finanzasStorageService.obtenerConvenios([])
    if (!Array.isArray(convenios) || convenios.length === 0) return 0
    
    const encontrado = convenios.find((c) => 
      c.nombre.toLowerCase().includes(nombreConvenio.toLowerCase()) ||
      String(c.id).toLowerCase().includes(nombreConvenio.toLowerCase())
    )
    return encontrado ? (encontrado.descuentoDefecto || 0) : 0
  } catch {
    return 0
  }
}

/**
 * F4-03h: Obtiene hasta 3 fármacos del vademécum que son seguros para el paciente
 * (sin reactividad cruzada con sus alergias).
 */
export const obtenerAlternativasSeguras = (familiasAlergia: string[] = []): AlternativaSegura[] => {
  try {
    const vademecum: FarmacoVademecum[] = vademecumService.obtenerVademecum() || []
    const alergiasCruzadas: AlergiaCruzadaItem[] = vademecumService.obtenerAlergiasCruzadas() || []
    
    // Construir set de familias incompatibles para todas las alergias del paciente
    const familiasIncompatibles = new Set<string>()
    for (const regla of alergiasCruzadas) {
      if (familiasAlergia.includes(regla.familia_alergia) && 
          (regla.severidad === 'critica' || regla.severidad === 'advertencia')) {
        familiasIncompatibles.add(regla.familia_farmaco)
      }
    }
    
    // Filtrar fármacos seguros (que no están en familias incompatibles)
    const seguros = vademecum.filter((f) => 
      f.activo !== false && 
      !familiasIncompatibles.has(f.familia) &&
      Boolean(f.familia)
    )
    
    // Agrupar por familia para variedad (1 por familia, máx 3)
    const familiasVistas = new Set<string>()
    const alternativas: AlternativaSegura[] = []
    for (const f of seguros) {
      if (!familiasVistas.has(f.familia) && alternativas.length < 3) {
        familiasVistas.add(f.familia)
        alternativas.push({
          nombre: f.nombre_generico || (f as { nombreGenerico?: string }).nombreGenerico || '',
          familia: f.familia || '',
          familia_legible: (f.familia || '').replace(/_/g, ' ')
        })
      }
    }
    return alternativas
  } catch {
    return []
  }
}

/**
 * Evalúa si un medicamento a recetar es potencialmente incompatible con
 * las alergias registradas del paciente.
 *
 * ESTRATEGIA DE DOBLE CAPA (F4-03e):
 * 1. Capa principal: consulta matriz de alergias cruzadas desde vademecumService
 * 2. Capa de fallback: reglas legacy F1-04a (si vademecumService falla)
 *
 * REGLA DE SEGURIDAD CLÍNICA (Constitución, Cap. V.2):
 * Si alergias no informadas → tipo: 'sin_datos' (nunca null)
 *
 * @param textoMedicamento - Texto del fármaco que se está por recetar.
 * @param alergiasTexto - Texto libre de alergias registradas del paciente.
 */
export const evaluarIncompatibilidadFarmaco = (
  textoMedicamento?: string | null,
  alergiasTexto?: string | null
): IncompatibilidadFarmacoResultado | IncompatibilidadLegacyResultado | null => {
  const alergiasLimpias = String(alergiasTexto || '').trim()

  // Fail-safe: si alergias no informadas
  if (!alergiasLimpias) {
    return {
      tipo: 'sin_datos',
      mensaje: 'Alergias no registradas para este paciente.',
      sugerencia: 'Verifique manualmente los antecedentes alérgicos con el paciente antes de prescribir.'
    }
  }

  // Intentar detección vía vademecumService (matriz de alergias cruzadas)
  try {
    const familiaFarmaco = detectarFamiliaFarmaco(textoMedicamento)
    
    if (familiaFarmaco) {
      const familiasAlergia = detectarFamiliasAlergia(alergiasLimpias)
      
      // Consultar matriz de alergias cruzadas para cada familia detectada
      for (const familiaAlergia of familiasAlergia) {
        const resultado = vademecumService.evaluarAlergiaCruzada(familiaAlergia, familiaFarmaco)
        
        if (resultado.hayIncompatibilidad) {
          const { mensaje, sugerencia } = generarMensajeDinamico(familiaAlergia, familiaFarmaco, resultado)
          const alternativas = obtenerAlternativasSeguras(familiasAlergia)
          return {
            tipo: resultado.severidad === 'critica' ? 'critica' : 'advertencia',
            mensaje,
            sugerencia,
            familiaFarmaco,
            familiaAlergia,
            porcentajeCruzado: resultado.porcentaje_cruzado || null,
            notaClinica: resultado.nota_clinica || null,
            alternativas
          }
        }
      }
    }
  } catch (error: unknown) {
    // vademecumService falló, usar fallback legacy
    const msg = error instanceof Error ? error.message : String(error)
    log.warn('vademecumService falló, usando reglas legacy:', msg)
  }

  // Fallback: reglas legacy F1-04a (2 categorías hardcodeadas)
  return evaluarIncompatibilidadLegacy(textoMedicamento, alergiasLimpias)
}
