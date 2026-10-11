/**
 * Lógica de cálculos de anestesia local (F4-03d).
 *
 * Este archivo contiene la implementación completa de los cálculos de dosis
 * máxima de anestesia local según el vademécum v1.1 curado por odontólogo.
 * El archivo `anestesiaCalc.ts` actúa como re-export delgado (wrapper) para
 * preservar la compatibilidad de imports existentes.
 *
 * APIs públicas:
 * - calcularTubosAnestesia(peso, tipoAnestesico) → API legada F1-03
 * - calcularDosisAnestesiaCompleta(params) → API enriquecida F4-03d
 * - listarAnestesicosDisponibles() → utilidad para selectores UI
 *
 * Fail-Safe Clinical Default (Constitución, Cap. V.2):
 * Si el peso no es válido, o si el anestésico no está en la tabla de referencia,
 * NUNCA se asume un valor por defecto ni se calcula una dosis "aproximada".
 *
 * Fuente de datos (doble fallback):
 * 1. vademecumService.obtenerDosisAnestesia() (v1.1 desde Supabase)
 * 2. DOSIS_RESPALDO_V10 (v1.0 hardcodeada, 4 anestésicos originales)
 */
import { vademecumService } from '../../infrastructure/clinical-data/vademecumService'
import type { DosisAnestesiaItem } from '../../infrastructure/clinical-data/vademecumAnestesia'
import { createLogger } from '../../infrastructure/logging/logger'
import { DOSIS_RESPALDO_V10, type DosisRespaldoItem } from './anestesiaDatos'

const log = createLogger('anestesiaCalculations')

export interface AnestesicoItem {
  clave?: string
  numero: number
  nombreGenerico: string
  familia: string
  presentacion?: string | null
  mgPorKgAdulto?: number | null
  topeAbsolutoAdulto?: number | null
  mgPorKgPediatrico?: number | null
  topeAbsolutoPediatrico?: number | null
  mgPorTubo?: number | null
  volumenPorTubo?: number | null
  concentracionMgPorMl?: number | null
  tieneVasoconstrictor: boolean
  concentracionVasoconstrictor: number
  contraindicaciones?: string | null
  notasEspeciales?: string | null
}

export interface CalcularTubosResultado {
  estado: 'OK' | 'DATOS_INCOMPLETOS' | 'ANESTESICO_DESCONOCIDO'
  mensaje: string | null
  mgMax: string | null
  tubos: number | null
}

export interface CalcularDosisParams {
  peso?: number | string
  tipoAnestesico?: string | number
  esPediatria?: boolean
  esCardiopata?: boolean
  esEmbarazo?: boolean
  edad?: number | null
}

export interface AnestesiaInfo {
  nombreGenerico: string
  familia: string
  presentacion?: string | null
  concentracion?: number | null
  tieneVasoconstrictor?: boolean
  contraindicaciones?: string | null
  notasEspeciales?: string | null
}

export interface CalculosDosisResultado {
  mgMaximo: number
  mlMaximo: number
  tubosMaximo: number
  dosisPorKgUsada: 'adulta' | 'pediatrica' | 'adulta_fallback'
  topeUsado: number | null
  epinefrinaMg: number
  epinefrinaCardioSeguro: boolean
}

export interface CalcularDosisCompletaResultado {
  estado: 'OK' | 'DATOS_INCOMPLETOS' | 'ANESTESICO_DESCONOCIDO'
  mensaje: string | null
  anestesiaInfo: AnestesiaInfo | null
  calculos: CalculosDosisResultado | null
  advertencias: string[]
}

export interface AnestesicoDisponible {
  numero: number
  nombreGenerico: string
  familia: string
  presentacion?: string | null
  contenidoPorUnidad_mg?: number | null
  dosisMaxAdulto_mgPorKg?: number | null
  concentracionMgPorMl?: number | null
  tieneVasoconstrictor: boolean
}

// ═══════════════════════════════════════════════════════════════
// HELPERS DE NORMALIZACIÓN DE TEXTO
// ═══════════════════════════════════════════════════════════════

/**
 * Normaliza texto: minúsculas + elimina tildes/diacríticos.
 * Útil para comparar nombres de fármacos ignorando tildes y case.
 */
export const normalizar = (texto: unknown): string => {
  if (texto === null || texto === undefined) return ''
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimina diacríticos (tildes, dieresis)
}

// ═══════════════════════════════════════════════════════════════
// MAPA DE CLAVES (compatibilidad con API legada)
// Las claves usan versiones normalizadas (sin tildes, en minúsculas)
// ═══════════════════════════════════════════════════════════════
const MAPA_CLAVES: Record<string, { patron: RegExp }> = {
  lidocaina: { patron: /lidoca/i },
  mepivacaina: { patron: /mepivaca/i },
  articaina: { patron: /articaina/i },
  bupivacaina: { patron: /bupivaca/i },
  prilocaina: { patron: /prilocaina/i }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIÓN INTERNA: obtener datos de anestesia (con fallback)
// ═══════════════════════════════════════════════════════════════

/**
 * Obtiene datos de anestesia desde vademecumService.
 * Si falla o retorna vacío, usa DOSIS_RESPALDO_V10.
 */
export const obtenerDatosAnestesia = (): AnestesicoItem[] => {
  try {
    const desdeService: DosisAnestesiaItem[] | undefined = vademecumService?.obtenerDosisAnestesia?.()
    if (Array.isArray(desdeService) && desdeService.length > 0) {
      return desdeService.map((d: DosisAnestesiaItem): AnestesicoItem => ({
        numero: d.id,
        nombreGenerico: d.nombre,
        familia: d.familia,
        presentacion: d.presentacion,
        
        // F7-02: Usar nombres con unidades explícitas del servicio
        mgPorKgAdulto: d.dosisMaxAdulto_mgPorKg,
        mgPorKgPediatrico: d.dosisMaxPediatrico_mgPorKg,
        topeAbsolutoAdulto: d.topeAbsolutoAdulto_mg,
        topeAbsolutoPediatrico: d.topeAbsolutoPediatrico_mg,
        
        mgPorTubo: d.contenidoPorUnidad_mg,
        volumenPorTubo: d.volumenPorUnidad_ml,  // F7-03: sin default, null si falta
        concentracionMgPorMl: d.concentracion_mgPorMl,
        tieneVasoconstrictor: normalizar(d.nombre || '').includes('epinefrina') || normalizar(d.nombre || '').includes('felipresina'),
        concentracionVasoconstrictor:
          (d.nombre || '').includes('1:100.000') ? 0.01
          : (d.nombre || '').includes('1:200.000') ? 0.005
          : 0,
        contraindicaciones: d.contraindicaciones,
        notasEspeciales: d.notas
      }))
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log.warn('[anestesiaCalc] vademecumService no disponible, usando respaldo v1.0:', msg)
  }

  // Fallback: datos hardcodeados v1.0
  return Object.entries(DOSIS_RESPALDO_V10).map(([clave, datos]: [string, DosisRespaldoItem]): AnestesicoItem => ({
    clave,
    ...datos
  }))
}

/**
 * Busca anestésico por clave corta (API legada) o por número/nombre.
 * Usa normalización (sin tildes, case-insensitive) para robustez.
 */
export const buscarAnestesico = (tipoAnestesico: unknown): AnestesicoItem | null => {
  const datos = obtenerDatosAnestesia()

  // Búsqueda por clave corta normalizada (legada: lidocaina, mepivacaina, etc.)
  if (typeof tipoAnestesico === 'string') {
    const claveNormalizada = normalizar(tipoAnestesico)
    if (MAPA_CLAVES[claveNormalizada]) {
      const patron = MAPA_CLAVES[claveNormalizada].patron
      const encontrado = datos.find((d) => patron.test(normalizar(d.nombreGenerico || '')))
      if (encontrado) return encontrado
    }
  }

  // Búsqueda por número de vademécum
  if (typeof tipoAnestesico === 'number') {
    const encontrado = datos.find((d) => d.numero === tipoAnestesico)
    if (encontrado) return encontrado
  }

  // Búsqueda por texto en nombre genérico (normalizado)
  if (typeof tipoAnestesico === 'string') {
    const textoNormalizado = normalizar(tipoAnestesico)
    const encontrado = datos.find((d) =>
      normalizar(d.nombreGenerico || '').includes(textoNormalizado)
    )
    if (encontrado) return encontrado
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// GENERADOR DE ADVERTENCIAS CLÍNICAS (Sección 1 del vademécum v1.1)
// ═══════════════════════════════════════════════════════════════

/**
 * Genera advertencias clínicas automáticas según Sección 1 del vademécum v1.1.
 */
export const generarAdvertencias = (
  anestesia: AnestesicoItem,
  params: { esPediatria?: boolean; esCardiopata?: boolean; esEmbarazo?: boolean; peso?: number | null }
): string[] => {
  const { esPediatria = false, esCardiopata = false, esEmbarazo = false, peso } = params
  const advertencias: string[] = []
  const nombreNorm = normalizar(anestesia.nombreGenerico || '')

  // 1. Embarazo + Felipresina
  if (esEmbarazo && nombreNorm.includes('felipresina')) {
    advertencias.push('Felipresina: evitar en embarazo por estructura análoga a oxitocina (riesgo controvertido)')
  }

  // 2. Embarazo + vasoconstrictor
  if (esEmbarazo && anestesia.tieneVasoconstrictor) {
    advertencias.push('Vasoconstrictor en embarazo: limitar a máximo 2 tubos por precaución')
  }

  // 3. Cardiopata + vasoconstrictor
  if (esCardiopata && anestesia.tieneVasoconstrictor) {
    const epiPorTubo = (anestesia.concentracionVasoconstrictor || 0) * (anestesia.volumenPorTubo || 0)
    if (epiPorTubo > 0) {
      const tubosMaximoEpi = Math.floor(0.04 / epiPorTubo)
      advertencias.push(`Cardiopatía: limitar Epinefrina a 0.04 mg por sesión (≈ ${tubosMaximoEpi} tubos)`)
    }
  }

  // 4. Cardiopata: sugerencia de alternativas
  if (esCardiopata && anestesia.tieneVasoconstrictor) {
    if (!nombreNorm.includes('mepivacaina') && !nombreNorm.includes('prilocaina')) {
      advertencias.push('ℹ En cardiopatías descompensadas considerar Mepivacaína 3% sin vaso o Prilocaína + Felipresina')
    }
  }

  // 5. Pediátrica: Bupivacaína contraindicada <12 años
  if (esPediatria && nombreNorm.includes('bupivacaina')) {
    advertencias.push('Bupivacaína NO recomendada en niños <12 años')
  }

  // 6. Pediátrica: Articaína contraindicada <4 años
  if (esPediatria && nombreNorm.includes('articaina')) {
    advertencias.push('Articaína contraindicada en niños <4 años')
  }

  // 7. Paciente de bajo peso (<50 kg) con vasoconstrictor
  if (peso && peso < 50 && anestesia.tieneVasoconstrictor) {
    advertencias.push('ℹ Paciente <50 kg: calcular SIEMPRE dosis antes del procedimiento y registrar en ficha')
  }

  // 8. Contraindicaciones específicas del fármaco
  if (anestesia.contraindicaciones) {
    const contra = normalizar(anestesia.contraindicaciones)
    if (contra.includes('metahemoglobinemia') && (contra.includes('sulfito') || contra.includes('sulf'))) {
      advertencias.push('ℹ Precaución con pacientes que reciben sulfas (riesgo metahemoglobinemia)')
    }
  }

  return advertencias
}

// ═══════════════════════════════════════════════════════════════
// API PÚBLICA LEGADA (F1-03 — preservada para compatibilidad)
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula la dosis máxima (mg) y el número máximo de tubos de anestesia local
 * seguros para un paciente, según su peso corporal y el anestésico elegido.
 */
export const calcularTubosAnestesia = (peso: unknown, tipoAnestesico: unknown): CalcularTubosResultado => {
  const pesoNumerico = parseFloat(String(peso))
  const pesoValido = Number.isFinite(pesoNumerico) && pesoNumerico > 0

  if (!pesoValido) {
    return {
      estado: 'DATOS_INCOMPLETOS',
      mensaje: 'Peso no informado o inválido — Verificación manual requerida antes de administrar anestesia.',
      mgMax: null,
      tubos: null
    }
  }

  const anestesia = buscarAnestesico(tipoAnestesico)
  if (!anestesia) {
    return {
      estado: 'ANESTESICO_DESCONOCIDO',
      mensaje: `Tipo de anestésico "${String(tipoAnestesico)}" no reconocido — Verificación manual requerida.`,
      mgMax: null,
      tubos: null
    }
  }

  const mgPorKg = anestesia.mgPorKgAdulto
  const topeAbsoluto = anestesia.topeAbsolutoAdulto

  if (!mgPorKg || !anestesia.mgPorTubo) {
    return {
      estado: 'ANESTESICO_DESCONOCIDO',
      mensaje: `Datos de dosis incompletos para "${anestesia.nombreGenerico}" — Verificación manual requerida.`,
      mgMax: null,
      tubos: null
    }
  }

  // Fórmula Sección 1B: Dosis máxima (mg) = mg/kg × peso
  let mgMaximo = pesoNumerico * mgPorKg

  // Aplicar tope absoluto (relevante en pacientes con sobrepeso)
  if (topeAbsoluto && mgMaximo > topeAbsoluto) {
    mgMaximo = topeAbsoluto
  }

  // Número de tubos = mg máximo / mg por tubo
  const tubos = Math.floor(mgMaximo / anestesia.mgPorTubo)

  return {
    estado: 'OK',
    mensaje: null,
    mgMax: mgMaximo.toFixed(0),
    tubos
  }
}

// ═══════════════════════════════════════════════════════════════
// API PÚBLICA NUEVA (F4-03d — vademécum v1.1 enriquecido)
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula dosis máxima COMPLETA de anestesia con todos los parámetros
 * del vademécum v1.1 curado por odontólogo.
 */
export const calcularDosisAnestesiaCompleta = (params: CalcularDosisParams = {}): CalcularDosisCompletaResultado => {
  const {
    peso,
    tipoAnestesico,
    esPediatria = false,
    esCardiopata = false,
    esEmbarazo = false,
    edad = null
  } = params

  // ─── Validación de peso (Fail-Safe Clinical Default) ───
  const pesoNumerico = parseFloat(String(peso))
  const pesoValido = Number.isFinite(pesoNumerico) && pesoNumerico > 0

  if (!pesoValido) {
    return {
      estado: 'DATOS_INCOMPLETOS',
      mensaje: 'Peso no informado o inválido — Verificación manual requerida antes de administrar anestesia.',
      anestesiaInfo: null,
      calculos: null,
      advertencias: []
    }
  }

  // ─── Búsqueda del anestésico ───
  const anestesia = buscarAnestesico(tipoAnestesico)
  if (!anestesia) {
    return {
      estado: 'ANESTESICO_DESCONOCIDO',
      mensaje: `Tipo de anestésico "${String(tipoAnestesico)}" no reconocido — Verificación manual requerida.`,
      anestesiaInfo: null,
      calculos: null,
      advertencias: []
    }
  }

  const nombreNorm = normalizar(anestesia.nombreGenerico || '')

  // ─── Validación específica por edad ───
  // Bupivacaína contraindicada <12 años
  if (edad !== null && edad < 12 && nombreNorm.includes('bupivacaina')) {
    return {
      estado: 'DATOS_INCOMPLETOS',
      mensaje: 'Bupivacaína NO recomendada en niños <12 años — Verificación manual requerida.',
      anestesiaInfo: {
        nombreGenerico: anestesia.nombreGenerico,
        familia: anestesia.familia,
        presentacion: anestesia.presentacion
      },
      calculos: null,
      advertencias: ['Bupivacaína contraindicada en menores de 12 años']
    }
  }

  // Articaína contraindicada <4 años
  if (edad !== null && edad < 4 && nombreNorm.includes('articaina')) {
    return {
      estado: 'DATOS_INCOMPLETOS',
      mensaje: 'Articaína contraindicada en niños <4 años — Verificación manual requerida.',
      anestesiaInfo: {
        nombreGenerico: anestesia.nombreGenerico,
        familia: anestesia.familia,
        presentacion: anestesia.presentacion
      },
      calculos: null,
      advertencias: ['Articaína contraindicada en menores de 4 años']
    }
  }

  // ─── Determinar dosis según población ───
  let mgPorKg: number | null | undefined
  let topeAbsoluto: number | null | undefined
  let dosisPorKgUsada: 'adulta' | 'pediatrica'

  if (esPediatria) {
    mgPorKg = anestesia.mgPorKgPediatrico
    topeAbsoluto = anestesia.topeAbsolutoPediatrico || anestesia.topeAbsolutoAdulto
    dosisPorKgUsada = 'pediatrica'

    // F7-03: Si falta dosis pediátrica, retornar estado restrictivo (no fallback silencioso a adulta)
    if (!mgPorKg) {
      return {
        estado: 'DATOS_INCOMPLETOS',
        mensaje: `Dosis pediátrica no disponible para "${anestesia.nombreGenerico}" — Verificación manual requerida. No se aplica dosis adulta a pacientes pediátricos.`,
        anestesiaInfo: {
          nombreGenerico: anestesia.nombreGenerico,
          familia: anestesia.familia,
          presentacion: anestesia.presentacion
        },
        calculos: null,
        advertencias: ['Dosis pediátrica faltante, cálculo bloqueado por seguridad']
      }
    }
  } else {
    mgPorKg = anestesia.mgPorKgAdulto
    topeAbsoluto = anestesia.topeAbsolutoAdulto
    dosisPorKgUsada = 'adulta'
  }

  if (!mgPorKg) {
    return {
      estado: 'ANESTESICO_DESCONOCIDO',
      mensaje: `Datos de dosis no disponibles para "${anestesia.nombreGenerico}" en población ${esPediatria ? 'pediátrica' : 'adulta'} — Verificación manual requerida.`,
      anestesiaInfo: {
        nombreGenerico: anestesia.nombreGenerico,
        familia: anestesia.familia,
        presentacion: anestesia.presentacion
      },
      calculos: null,
      advertencias: []
    }
  }

  // ─── F7-03: Validación de campos obligatorios (sin defaults numéricos) ───
  const concentracion = anestesia.concentracionMgPorMl
  const volumenPorTubo = anestesia.volumenPorTubo
  const mgPorTubo = anestesia.mgPorTubo

  const camposInvalidos: string[] = []
  if (!concentracion || concentracion <= 0) {
    camposInvalidos.push('concentracionMgPorMl')
  }
  if (!volumenPorTubo || volumenPorTubo <= 0) {
    camposInvalidos.push('volumenPorTubo')
  }
  if (!mgPorTubo || mgPorTubo <= 0) {
    camposInvalidos.push('mgPorTubo')
  }

  if (camposInvalidos.length > 0) {
    return {
      estado: 'DATOS_INCOMPLETOS',
      mensaje: `Datos incompletos del anestésico: ${camposInvalidos.join(', ')} — Verificación manual requerida.`,
      anestesiaInfo: {
        nombreGenerico: anestesia.nombreGenerico,
        familia: anestesia.familia,
        presentacion: anestesia.presentacion
      },
      calculos: null,
      advertencias: []
    }
  }

  // ─── Cálculos (fórmulas Sección 1B) ───
  let mgMaximo = pesoNumerico * mgPorKg

  let topeUsado: number | null = null
  if (topeAbsoluto && mgMaximo > topeAbsoluto) {
    mgMaximo = topeAbsoluto
    topeUsado = topeAbsoluto
  }

  const mlMaximo = mgMaximo / concentracion!
  const tubosMaximo = Math.floor(mlMaximo / volumenPorTubo!)

  let epinefrinaMg = 0
  if (anestesia.tieneVasoconstrictor && anestesia.concentracionVasoconstrictor > 0) {
    epinefrinaMg = anestesia.concentracionVasoconstrictor * mlMaximo
  }

  const epinefrinaCardioSeguro = !esCardiopata || epinefrinaMg <= 0.04

  // ─── Generar advertencias clínicas ───
  const advertencias = generarAdvertencias(anestesia, {
    esPediatria,
    esCardiopata,
    esEmbarazo,
    peso: pesoNumerico
  })

  if (topeUsado !== null) {
    advertencias.unshift(`ℹ Se aplicó tope absoluto de ${topeUsado} mg (cálculo por peso excedía el límite del fármaco)`)
  }

  return {
    estado: 'OK',
    mensaje: null,
    anestesiaInfo: {
      nombreGenerico: anestesia.nombreGenerico,
      familia: anestesia.familia,
      presentacion: anestesia.presentacion,
      concentracion: anestesia.concentracionMgPorMl,
      tieneVasoconstrictor: anestesia.tieneVasoconstrictor,
      contraindicaciones: anestesia.contraindicaciones,
      notasEspeciales: anestesia.notasEspeciales
    },
    calculos: {
      mgMaximo: Math.round(mgMaximo * 10) / 10,
      mlMaximo: Math.round(mlMaximo * 100) / 100,
      tubosMaximo,
      dosisPorKgUsada,
      topeUsado,
      epinefrinaMg: Math.round(epinefrinaMg * 1000) / 1000,
      epinefrinaCardioSeguro
    },
    advertencias
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILIDAD PÚBLICA
// ═══════════════════════════════════════════════════════════════

/**
 * Lista todos los anestésicos disponibles (desde vademécum o respaldo).
 */
export const listarAnestesicosDisponibles = (): AnestesicoDisponible[] => {
  const datos = obtenerDatosAnestesia()
  return datos.map((d: AnestesicoItem): AnestesicoDisponible => ({
    numero: d.numero,
    nombreGenerico: d.nombreGenerico,
    familia: d.familia,
    presentacion: d.presentacion,
    contenidoPorUnidad_mg: d.mgPorTubo,
    dosisMaxAdulto_mgPorKg: d.mgPorKgAdulto,
    concentracionMgPorMl: d.concentracionMgPorMl,
    tieneVasoconstrictor: d.tieneVasoconstrictor
  }))
}

export { DOSIS_RESPALDO_V10 }
