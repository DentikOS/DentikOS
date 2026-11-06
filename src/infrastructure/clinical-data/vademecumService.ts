/**
 * Servicio de Vademécum Odontológico (F4-03c).
 *
 * Centraliza la lectura de datos de referencia clínicos curados por
 * profesional odontólogo (v1.1). Implementa caché en memoria con
 * sincronización asíncrona desde Supabase y fallback a localStorage.
 *
 * Tablas Supabase que lee:
 * - vademecum (94 fármacos regulares)
 * - vademecum_urgencia (11 carro reanimación)
 * - vademecum_antirresortivos (6 MRONJ)
 * - alergias_cruzadas (matriz de reactividad)
 * - interacciones_farmacologicas (15 interacciones)
 * - profilaxis_endocarditis (7 protocolos AHA)
 * - manejo_anticoagulantes (5 grupos)
 * - reference_data_meta (metadata de curación)
 *
 * Patrón de diseño (F4-02d):
 * - Lectura síncrona desde caché en memoria
 * - Sincronización asíncrona desde Supabase en background
 * - Fallback a localStorage si Supabase no disponible
 * - Datos de respaldo mínimos si todo falla (22 fármacos originales)
 */
import { supabase, USE_SUPABASE } from '../supabase/supabaseClient'
import { notificationService } from '../notification/notificationService'
import { REALTIME_EVENTS } from '../realtime/realtimeEvents'
import { createLogger } from '../logging/logger'
import { obtenerDosisAnestesia } from './vademecumAnestesia'
import type { Farmaco, FarmacoUrgencia, Antirresortivo } from '../../domains/organization/vademecum/schemas/vademecumSchema'
import type { AlergiaCruzada } from '../../domains/organization/vademecum/schemas/alergiaCruzadaSchema'
import type { Interaccion } from '../../domains/organization/vademecum/schemas/interaccionSchema'
import type { Profilaxis } from '../../domains/organization/vademecum/schemas/profilaxisSchema'
import type { Anticoagulante } from '../../domains/organization/vademecum/schemas/anticoagulanteSchema'

const log = createLogger('vademecumService')

// ═══════════════════════════════════════════════════════════════
// TIPOS E INTERFACES DEL VADEMÉCUM
// ═══════════════════════════════════════════════════════════════

export interface FarmacoVademecum extends Omit<Partial<Farmaco>, 'numero' | 'familia' | 'nombre_generico'> {
  numero: number
  familia: string
  nombre_generico: string
  dosis_max_adulto_mg_por_kg?: number | null
  dosis_max_pediatrica_mg?: number | null
  fuente_revision?: string | null
  fecha_revision?: string | null
  curado_por?: string | null
  [key: string]: unknown
}

export type FarmacoInput = Partial<FarmacoVademecum> & {
  nombreGenerico?: string
  nombreComercial?: string | null
  posologiaAdulto?: string | null
  posologiaPediatrica?: string | null
  dosisMaxAdultoMg?: number | null
  dosisMaxPediatricaMgPorKg?: number | null
  contenidoPorUnidadMg?: number | null
  volumenPorUnidadMl?: number | null
  concentracionMgPorMl?: number | null
  duracionDias?: string | null
  alergiasCruzadas?: string[]
  requiereReceta?: boolean
  notasEspeciales?: string | null
  fuenteRevision?: string | null
  fechaRevision?: string | null
  curadoPor?: string | null
  [key: string]: unknown
}

export interface AlergiaCruzadaItem extends Partial<Omit<AlergiaCruzada, 'familia_alergia' | 'familia_farmaco' | 'severidad'>> {
  id?: string | number
  familia_alergia: string
  familia_farmaco: string
  severidad: string
  [key: string]: unknown
}

export type AlergiaCruzadaInput = Partial<AlergiaCruzadaItem> & {
  familiaAlergia?: string
  familiaFarmaco?: string
  porcentajeCruzado?: string | null
  notaClinica?: string | null
  [key: string]: unknown
}

export type InteraccionInput = Partial<Interaccion> & {
  farmacoA?: string
  farmacoB?: string
  [key: string]: unknown
}

export interface EvaluacionAlergiaCruzada {
  hayIncompatibilidad: boolean
  severidad: string | null
  porcentaje_cruzado: string | null
  nota_clinica: string | null
}

export interface MetadataCuracion {
  id?: string | number
  version?: string
  curado_por?: string
  fecha_curacion?: string | null
  fecha_proxima_revision?: string | null
  fuentes?: string[]
  total_farmacos?: number
  [key: string]: unknown
}

interface CacheVademecum {
  vademecum: FarmacoVademecum[] | null
  urgencia: FarmacoUrgencia[] | null
  antirresortivos: Antirresortivo[] | null
  alergiasCruzadas: AlergiaCruzadaItem[] | null
  interacciones: Interaccion[] | null
  profilaxisEndocarditis: Profilaxis[] | null
  manejoAnticoagulantes: Anticoagulante[] | null
  metadata: MetadataCuracion | null
  sincronizado: boolean
}

// ═══════════════════════════════════════════════════════════════
// CLAVES DE LOCALSTORAGE (caché de respaldo)
// ═══════════════════════════════════════════════════════════════
const CLAVES = {
  VADEMECUM: 'studio_dental_vademecum_v2',
  URGENCIA: 'studio_dental_vademecum_urgencia_v2',
  ANTIRRESORTIVOS: 'studio_dental_vademecum_antirresortivos_v2',
  ALERGIAS_CRUZADAS: 'studio_dental_alergias_cruzadas_v2',
  INTERACCIONES: 'studio_dental_interacciones_v2',
  PROFILAXIS_ENDOCARDITIS: 'studio_dental_profilaxis_endocarditis_v2',
  MANEJO_ANTICOAGULANTES: 'studio_dental_manejo_anticoagulantes_v2',
  METADATA: 'studio_dental_vademecum_metadata_v2',
  SINCRONIZADO: 'studio_dental_vademecum_sync_timestamp_v2'
} as const

// ═══════════════════════════════════════════════════════════════
// CACHÉ EN MEMORIA
// ═══════════════════════════════════════════════════════════════
let cache: CacheVademecum = {
  vademecum: null,
  urgencia: null,
  antirresortivos: null,
  alergiasCruzadas: null,
  interacciones: null,
  profilaxisEndocarditis: null,
  manejoAnticoagulantes: null,
  metadata: null,
  sincronizado: false
}

// ═══════════════════════════════════════════════════════════════
// DATOS DE RESPALDO MÍNIMOS (si Supabase no está disponible)
// Los 22 fármacos originales de src/data/vademecum.js (v1.0)
// ═══════════════════════════════════════════════════════════════
const DATOS_RESPALDO_MINIMOS: FarmacoVademecum[] = [
  { numero: 1, familia: 'anestesico_amida', nombre_generico: 'Lidocaína 2% + Epinefrina 1:100.000', presentacion: 'Tubos 1.8 ml', posologia_adulto: 'Infiltrativa / Troncular', posologia_pediatrica: '4.4 mg/kg', dosis_max_adulto_mg: 300, dosis_max_pediatrica_mg_por_kg: 4.4, contenido_por_unidad_mg: 36, volumen_por_unidad_ml: 1.8, concentracion_mg_por_ml: 20, dosis_max_adulto_mg_por_kg: 7.0, dosis_max_pediatrica_mg: 300, contraindicaciones: 'Bloqueo AV severo, feocromocitoma, alergia amidas, sulfito-sensibilidad', alergias_cruzadas: ['otras_amidas', 'metabisulfito_sodico'] },
  { numero: 2, familia: 'anestesico_amida', nombre_generico: 'Mepivacaína 3% sin vasoconstrictor', presentacion: 'Tubos 1.8 ml', posologia_adulto: 'Infiltrativa / Troncular', posologia_pediatrica: '4.4 mg/kg', dosis_max_adulto_mg: 400, dosis_max_pediatrica_mg_por_kg: 4.4, contenido_por_unidad_mg: 54, volumen_por_unidad_ml: 1.8, concentracion_mg_por_ml: 30, dosis_max_adulto_mg_por_kg: 4.4, dosis_max_pediatrica_mg: 200, contraindicaciones: 'Bloqueo AV, disfunción hepática severa', alergias_cruzadas: ['otras_amidas'] },
  { numero: 3, familia: 'anestesico_amida', nombre_generico: 'Articaína 4% + Epinefrina 1:100.000', presentacion: 'Tubos 1.7 ml / 1.8 ml', posologia_adulto: 'Infiltrativa / Troncular', posologia_pediatrica: '7.0 mg/kg (≥4 años)', dosis_max_adulto_mg: 500, dosis_max_pediatrica_mg_por_kg: 7.0, contenido_por_unidad_mg: 72, volumen_por_unidad_ml: 1.8, concentracion_mg_por_ml: 40, dosis_max_adulto_mg_por_kg: 7.0, dosis_max_pediatrica_mg: 300, contraindicaciones: 'Metahemoglobinemia, déficit colinesterasa, asma por sulfitos', alergias_cruzadas: ['sulfito_sensibilidad', 'amidas'] },
  { numero: 4, familia: 'anestesico_amida', nombre_generico: 'Bupivacaína 0.5% + Epinefrina 1:200.000', presentacion: 'Tubos 1.8 ml', posologia_adulto: 'Infiltrativa / Troncular', posologia_pediatrica: undefined, dosis_max_adulto_mg: 90, dosis_max_pediatrica_mg_por_kg: null, contenido_por_unidad_mg: 9, volumen_por_unidad_ml: 1.8, concentracion_mg_por_ml: 5, dosis_max_adulto_mg_por_kg: 1.3, dosis_max_pediatrica_mg: 50, contraindicaciones: 'Cardiopatía isquémica severa, niños <12 años, arritmias', alergias_cruzadas: ['otras_amidas', 'sulfitos'] },
  { numero: 5, familia: 'penicilina', nombre_generico: 'Amoxicilina 500 mg', presentacion: 'Cápsulas / Comprimidos', posologia_adulto: '500 mg c/8h', posologia_pediatrica: '40-50 mg/kg/día div c/8h', contraindicaciones: 'Hipersensibilidad betalactámicos, mononucleosis', alergias_cruzadas: ['cefalosporinas', 'carbapenemicos'] },
  { numero: 6, familia: 'penicilina', nombre_generico: 'Amoxicilina 875 mg', presentacion: 'Comprimidos', posologia_adulto: '875 mg c/12h', posologia_pediatrica: '40-50 mg/kg/día div c/12h', contraindicaciones: 'Hipersensibilidad betalactámicos', alergias_cruzadas: ['cefalosporinas'] },
  { numero: 7, familia: 'penicilina', nombre_generico: 'Amoxicilina 1 g', presentacion: 'Comprimidos', posologia_adulto: '1 g c/12h', posologia_pediatrica: undefined, contraindicaciones: 'Hipersensibilidad betalactámicos', alergias_cruzadas: ['cefalosporinas'] },
  { numero: 8, familia: 'penicilina', nombre_generico: 'Amoxicilina + Ácido Clavulánico 500/125 mg', presentacion: 'Comprimidos recubiertos', posologia_adulto: '1 comp c/8h', posologia_pediatrica: '40-50 mg/kg/día (base amox) div c/8h', contraindicaciones: 'Ictericia colestásica previa', alergias_cruzadas: ['cefalosporinas'] },
  { numero: 9, familia: 'lincosamida', nombre_generico: 'Clindamicina 300 mg', presentacion: 'Cápsulas', posologia_adulto: '300 mg c/6-8h', posologia_pediatrica: '10-25 mg/kg/día div c/6-8h', contraindicaciones: 'Colitis pseudomembranosa/C. difficile', alergias_cruzadas: ['lincomicina'] },
  { numero: 10, familia: 'macrolido', nombre_generico: 'Azitromicina 500 mg', presentacion: 'Comprimidos recubiertos', posologia_adulto: '500 mg c/24h', posologia_pediatrica: '10 mg/kg/día c/24h', contraindicaciones: 'QT largo, ergotamínicos, falla hepática severa', alergias_cruzadas: ['otros_macrolidos'] },
  { numero: 11, familia: 'nitroimidazol', nombre_generico: 'Metronidazol 500 mg', presentacion: 'Comprimidos', posologia_adulto: '500 mg c/8h', posologia_pediatrica: '30-40 mg/kg/día div c/8h', contraindicaciones: 'Alcohol (disulfiram), 1er trim embarazo, SNC', alergias_cruzadas: ['otros_nitroimidazoles'] },
  { numero: 12, familia: 'aine', nombre_generico: 'Ibuprofeno 400 mg', presentacion: 'Comprimidos recubiertos', posologia_adulto: '400 mg c/6-8h', posologia_pediatrica: '5-10 mg/kg/dosis', contraindicaciones: 'Úlcera activa, IRC severa, 3er trim gestación', alergias_cruzadas: ['otros_aines', 'ASA'] },
  { numero: 13, familia: 'aine', nombre_generico: 'Ibuprofeno 600 mg', presentacion: 'Comprimidos recubiertos', posologia_adulto: '600 mg c/8h', posologia_pediatrica: undefined, contraindicaciones: 'Falla cardíaca severa, hemorragia digestiva previa', alergias_cruzadas: ['otros_aines', 'ASA'] },
  { numero: 14, familia: 'aine', nombre_generico: 'Ketoprofeno 100 mg', presentacion: 'Comprimidos / Cápsulas', posologia_adulto: '100 mg c/12h o 50 mg c/8h', posologia_pediatrica: undefined, contraindicaciones: 'Úlcera péptica activa, IRC/hepática severa', alergias_cruzadas: ['ASA', 'derivados_acido_propionico'] },
  { numero: 15, familia: 'aine', nombre_generico: 'Ketorolaco 10 mg SL', presentacion: 'Comprimidos sublinguales', posologia_adulto: '10 mg c/8h SL', posologia_pediatrica: undefined, contraindicaciones: 'Úlcera péptica, IRC moderada-severa', alergias_cruzadas: ['otros_aines', 'ASA'] },
  { numero: 16, familia: 'aine', nombre_generico: 'Diclofenaco Sódico 50 mg', presentacion: 'Comprimidos entéricos', posologia_adulto: '50 mg c/8h', posologia_pediatrica: '0.5-2 mg/kg/día div c/8-12h (>1 año)', contraindicaciones: 'Cardiopatía isquémica, ACV previo, úlcera activa', alergias_cruzadas: ['otros_aines'] },
  { numero: 17, familia: 'paracetamol', nombre_generico: 'Paracetamol 500 mg', presentacion: 'Comprimidos', posologia_adulto: '500 mg - 1 g c/6-8h (máx 3-4 g/día)', posologia_pediatrica: '10-15 mg/kg/dosis c/6-8h', contraindicaciones: 'Falla hepática aguda, hepatopatía severa', alergias_cruzadas: ['hipersensibilidad_paracetamol'] },
  { numero: 18, familia: 'paracetamol', nombre_generico: 'Paracetamol 1 g', presentacion: 'Comprimidos', posologia_adulto: '1 g c/8h (máx 3-4 g/día)', posologia_pediatrica: undefined, contraindicaciones: 'Falla hepática grave, desnutrición extrema/alcoholismo', alergias_cruzadas: ['paracetamol'] },
  { numero: 19, familia: 'aine', nombre_generico: 'Clonixinato de Lisina 125 mg', presentacion: 'Comprimidos', posologia_adulto: '125-250 mg c/6-8h', posologia_pediatrica: undefined, contraindicaciones: 'Úlcera gastroduodenal activa, hemorragia digestiva', alergias_cruzadas: ['otros_aines'] },
  { numero: 20, familia: 'opioide', nombre_generico: 'Tramadol 37.5 mg + Paracetamol 325 mg', presentacion: 'Comprimidos', posologia_adulto: '1-2 comp c/8h (máx 8 comp/día)', posologia_pediatrica: undefined, contraindicaciones: 'Epilepsia, IMAO/ISRS, depresión respiratoria', alergias_cruzadas: ['opioides_fenantrenos'] },
  { numero: 21, familia: 'corticoide', nombre_generico: 'Dexametasona 4 mg', presentacion: 'Comprimidos', posologia_adulto: '4-8 mg prequirúrgico (o 4 mg c/24h x 2 días)', posologia_pediatrica: '0.1-0.2 mg/kg/dosis (máx 4 mg)', contraindicaciones: 'Infección sistémica activa, úlcera activa, psicosis', alergias_cruzadas: ['corticoides'] },
  { numero: 22, familia: 'antiseptico', nombre_generico: 'Clorhexidina 0.12%', presentacion: 'Colutorio 250 ml', posologia_adulto: 'Enjuague 15 ml sin diluir x 1 min c/12h', posologia_pediatrica: undefined, contraindicaciones: 'Hipersensibilidad, niños <6 años', alergias_cruzadas: [] }
]

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE LECTURA DESDE LOCALSTORAGE (respaldo)
// ═══════════════════════════════════════════════════════════════

const leerDesdeLocalStorage = <T>(clave: string): T | null => {
  try {
    const datos = localStorage.getItem(clave)
    if (!datos) return null
    return JSON.parse(datos) as T
  } catch (e: unknown) {
    log.error(`Error leyendo ${clave}:`, e)
    return null
  }
}

const escribirEnLocalStorage = (clave: string, datos: unknown): void => {
  try {
    localStorage.setItem(clave, JSON.stringify(datos))
  } catch (e: unknown) {
    log.error(`Error escribiendo ${clave}:`, e)
  }
}

const extraerMensajeError = (e: unknown): string => {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return typeof e === 'string' ? e : 'Error desconocido'
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE LECTURA (API pública de lectura)
// ═══════════════════════════════════════════════════════════════

/**
 * Retorna todos los fármacos regulares activos del vademécum.
 * Si la caché no está inicializada, intenta leer desde localStorage.
 * Si no hay datos en localStorage, retorna los datos de respaldo mínimos.
 */
export const obtenerVademecum = (): FarmacoVademecum[] => {
  if (cache.vademecum) {
    return cache.vademecum.filter(f => f.activo !== false)
  }

  const datosLocal = leerDesdeLocalStorage<FarmacoVademecum[]>(CLAVES.VADEMECUM)
  if (datosLocal && Array.isArray(datosLocal) && datosLocal.length > 0) {
    cache.vademecum = datosLocal
    return datosLocal.filter(f => f.activo !== false)
  }

  // Fallback: datos de respaldo mínimos (v1.0 original)
  return DATOS_RESPALDO_MINIMOS.filter(f => f.activo !== false)
}

/**
 * Retorna fármacos filtrados por familia.
 * @param familia - Ej: 'penicilina', 'aine', 'anestesico_amida'
 */
export const obtenerFarmacosPorFamilia = (familia?: string | null): FarmacoVademecum[] => {
  if (!familia || typeof familia !== 'string') return []

  const vademecum = obtenerVademecum()
  return vademecum.filter(f =>
    f.familia?.toLowerCase() === familia.toLowerCase()
  )
}

/**
 * Busca un fármaco específico por número.
 * @param numero - Número de registro (ej: 1 para Lidocaína)
 */
export const obtenerFarmacoPorNumero = (numero: number): FarmacoVademecum | null => {
  const vademecum = obtenerVademecum()
  return vademecum.find(f => f.numero === numero) || null
}

/**
 * Búsqueda por texto en nombre genérico para el formulario de prescripción.
 * @param texto - Texto a buscar (mínimo 2 caracteres)
 */
export const buscarFarmacoPorNombre = (texto?: string | null): FarmacoVademecum[] => {
  if (!texto || typeof texto !== 'string' || texto.trim().length < 2) {
    return []
  }

  const textoLower = texto.toLowerCase().trim()
  const vademecum = obtenerVademecum()

  return vademecum.filter(f =>
    f.nombre_generico?.toLowerCase().includes(textoLower)
  )
}

/**
 * Retorna los fármacos del carro de reanimación odontológico.
 */
export const obtenerFarmacosUrgencia = (): FarmacoUrgencia[] => {
  if (cache.urgencia) {
    return cache.urgencia.filter(f => f.activo !== false)
  }

  const datosLocal = leerDesdeLocalStorage<FarmacoUrgencia[]>(CLAVES.URGENCIA)
  if (datosLocal && Array.isArray(datosLocal) && datosLocal.length > 0) {
    cache.urgencia = datosLocal
    return datosLocal.filter(f => f.activo !== false)
  }

  return []
}

/**
 * Retorna los antirresortivos óseos con riesgo de MRONJ.
 */
export const obtenerAntirresortivos = (): Antirresortivo[] => {
  if (cache.antirresortivos) {
    return cache.antirresortivos.filter(f => f.activo !== false)
  }

  const datosLocal = leerDesdeLocalStorage<Antirresortivo[]>(CLAVES.ANTIRRESORTIVOS)
  if (datosLocal && Array.isArray(datosLocal) && datosLocal.length > 0) {
    cache.antirresortivos = datosLocal
    return datosLocal.filter(f => f.activo !== false)
  }

  return []
}

/**
 * Retorna la matriz completa de alergias cruzadas.
 */
export const obtenerAlergiasCruzadas = (): AlergiaCruzadaItem[] => {
  if (cache.alergiasCruzadas) {
    return cache.alergiasCruzadas.filter(a => a.activo !== false)
  }

  const datosLocal = leerDesdeLocalStorage<AlergiaCruzadaItem[]>(CLAVES.ALERGIAS_CRUZADAS)
  if (datosLocal && Array.isArray(datosLocal) && datosLocal.length > 0) {
    cache.alergiasCruzadas = datosLocal
    return datosLocal.filter(a => a.activo !== false)
  }

  // Fallback mínimo: las 2 reglas hardcodeadas de la versión original
  return [
    {
      familia_alergia: 'penicilina',
      familia_farmaco: 'penicilina',
      severidad: 'critica',
      porcentaje_cruzado: null,
      nota_clinica: 'Alergia directa'
    },
    {
      familia_alergia: 'aine',
      familia_farmaco: 'aine',
      severidad: 'critica',
      porcentaje_cruzado: null,
      nota_clinica: 'Reactividad cruzada entre AINEs'
    }
  ]
}

/**
 * Evalúa si hay alergia cruzada entre dos familias.
 * @param familiaAlergia - Familia a la que el paciente es alérgico
 * @param familiaFarmaco - Familia del fármaco a prescribir
 */
export const evaluarAlergiaCruzada = (
  familiaAlergia?: string | null,
  familiaFarmaco?: string | null
): EvaluacionAlergiaCruzada => {
  if (!familiaAlergia || !familiaFarmaco) {
    return { hayIncompatibilidad: false, severidad: null, porcentaje_cruzado: null, nota_clinica: null }
  }

  const alergias = obtenerAlergiasCruzadas()
  const regla = alergias.find(a =>
    a.familia_alergia?.toLowerCase() === familiaAlergia.toLowerCase() &&
    a.familia_farmaco?.toLowerCase() === familiaFarmaco.toLowerCase()
  )

  if (!regla) {
    return { hayIncompatibilidad: false, severidad: null, porcentaje_cruzado: null, nota_clinica: null }
  }

  if (regla.severidad === 'sin_relacion') {
    return {
      hayIncompatibilidad: false,
      severidad: null,
      porcentaje_cruzado: null,
      nota_clinica: regla.nota_clinica || null
    }
  }

  return {
    hayIncompatibilidad: true,
    severidad: regla.severidad,
    porcentaje_cruzado: regla.porcentaje_cruzado || null,
    nota_clinica: regla.nota_clinica || null
  }
}

/**
 * Retorna todas las interacciones farmacológicas registradas.
 */
export const obtenerInteracciones = (): Interaccion[] => {
  if (cache.interacciones) {
    return cache.interacciones.filter(i => i.activo !== false)
  }

  const datosLocal = leerDesdeLocalStorage<Interaccion[]>(CLAVES.INTERACCIONES)
  if (datosLocal && Array.isArray(datosLocal) && datosLocal.length > 0) {
    cache.interacciones = datosLocal
    return datosLocal.filter(i => i.activo !== false)
  }

  return []
}

/**
 * Retorna interacciones donde un fármaco específico está involucrado.
 * @param farmaco - Nombre del fármaco a buscar
 */
export const obtenerInteraccionesDeFarmaco = (farmaco?: string | null): Interaccion[] => {
  if (!farmaco || typeof farmaco !== 'string') return []

  const farmacoLower = farmaco.toLowerCase()
  const interacciones = obtenerInteracciones()

  return interacciones.filter(i =>
    i.farmaco_a?.toLowerCase().includes(farmacoLower) ||
    i.farmaco_b?.toLowerCase().includes(farmacoLower)
  )
}

/**
 * Retorna el protocolo completo de profilaxis de endocarditis (AHA 2021).
 */
export const obtenerProfilaxisEndocarditis = (): Profilaxis[] => {
  if (cache.profilaxisEndocarditis) {
    return cache.profilaxisEndocarditis.filter(p => p.activo !== false)
  }

  const datosLocal = leerDesdeLocalStorage<Profilaxis[]>(CLAVES.PROFILAXIS_ENDOCARDITIS)
  if (datosLocal && Array.isArray(datosLocal) && datosLocal.length > 0) {
    cache.profilaxisEndocarditis = datosLocal
    return datosLocal.filter(p => p.activo !== false)
  }

  return []
}

/**
 * Retorna las recomendaciones de manejo perioperatorio de anticoagulantes.
 */
export const obtenerManejoAnticoagulantes = (): Anticoagulante[] => {
  if (cache.manejoAnticoagulantes) {
    return cache.manejoAnticoagulantes.filter(m => m.activo !== false)
  }

  const datosLocal = leerDesdeLocalStorage<Anticoagulante[]>(CLAVES.MANEJO_ANTICOAGULANTES)
  if (datosLocal && Array.isArray(datosLocal) && datosLocal.length > 0) {
    cache.manejoAnticoagulantes = datosLocal
    return datosLocal.filter(m => m.activo !== false)
  }

  return []
}

/**
 * Retorna la metadata de la curación clínica.
 */
export const obtenerMetadataCuracion = (): MetadataCuracion => {
  if (cache.metadata) {
    return cache.metadata
  }

  const datosLocal = leerDesdeLocalStorage<MetadataCuracion>(CLAVES.METADATA)
  if (datosLocal && typeof datosLocal === 'object') {
    cache.metadata = datosLocal
    return datosLocal
  }

  // Metadata de respaldo mínima
  return {
    version: 'v1.0',
    curado_por: 'Vademécum base',
    fecha_curacion: null,
    fecha_proxima_revision: null,
    fuentes: [],
    total_farmacos: DATOS_RESPALDO_MINIMOS.length
  }
}

// ═══════════════════════════════════════════════════════════════
// SINCRONIZACIÓN DESDE SUPABASE (F4-02d pattern)
// ═══════════════════════════════════════════════════════════════

/**
 * Fuerza sincronización de todos los datos del vademécum desde Supabase.
 * Actualiza caché en memoria y localStorage como respaldo.
 * No retorna nada (async fire-and-forget).
 */
export const sincronizarDesdeSupabase = async (): Promise<void> => {
  if (!USE_SUPABASE || !supabase) {
    console.info('[vademecumService] Supabase no configurado, usando datos locales')
    return
  }

  try {
    // Sincronizar todas las tablas en paralelo
    const [
      vademecumRes,
      urgenciaRes,
      antirresortivosRes,
      alergiasRes,
      interaccionesRes,
      profilaxisRes,
      anticoagulantesRes,
      metadataRes
    ] = await Promise.all([
      supabase.from('vademecum').select('*').eq('activo', true),
      supabase.from('vademecum_urgencia').select('*').eq('activo', true),
      supabase.from('vademecum_antirresortivos').select('*').eq('activo', true),
      supabase.from('alergias_cruzadas').select('*').eq('activo', true),
      supabase.from('interacciones_farmacologicas').select('*').eq('activo', true),
      supabase.from('profilaxis_endocarditis').select('*').eq('activo', true),
      supabase.from('manejo_anticoagulantes').select('*').eq('activo', true),
      supabase.from('reference_data_meta').select('*').limit(1)
    ])

    // Procesar resultados
    const vademecumData = vademecumRes.data as FarmacoVademecum[] | null
    if (!vademecumRes.error && Array.isArray(vademecumData)) {
      cache.vademecum = vademecumData
      escribirEnLocalStorage(CLAVES.VADEMECUM, vademecumData)
    }

    const urgenciaData = urgenciaRes.data as FarmacoUrgencia[] | null
    if (!urgenciaRes.error && Array.isArray(urgenciaData)) {
      cache.urgencia = urgenciaData
      escribirEnLocalStorage(CLAVES.URGENCIA, urgenciaData)
    }

    const antirresortivosData = antirresortivosRes.data as Antirresortivo[] | null
    if (!antirresortivosRes.error && Array.isArray(antirresortivosData)) {
      cache.antirresortivos = antirresortivosData
      escribirEnLocalStorage(CLAVES.ANTIRRESORTIVOS, antirresortivosData)
    }

    const alergiasData = alergiasRes.data as AlergiaCruzadaItem[] | null
    if (!alergiasRes.error && Array.isArray(alergiasData)) {
      cache.alergiasCruzadas = alergiasData
      escribirEnLocalStorage(CLAVES.ALERGIAS_CRUZADAS, alergiasData)
    }

    const interaccionesData = interaccionesRes.data as Interaccion[] | null
    if (!interaccionesRes.error && Array.isArray(interaccionesData)) {
      cache.interacciones = interaccionesData
      escribirEnLocalStorage(CLAVES.INTERACCIONES, interaccionesData)
    }

    const profilaxisData = profilaxisRes.data as Profilaxis[] | null
    if (!profilaxisRes.error && Array.isArray(profilaxisData)) {
      cache.profilaxisEndocarditis = profilaxisData
      escribirEnLocalStorage(CLAVES.PROFILAXIS_ENDOCARDITIS, profilaxisData)
    }

    const anticoagulantesData = anticoagulantesRes.data as Anticoagulante[] | null
    if (!anticoagulantesRes.error && Array.isArray(anticoagulantesData)) {
      cache.manejoAnticoagulantes = anticoagulantesData
      escribirEnLocalStorage(CLAVES.MANEJO_ANTICOAGULANTES, anticoagulantesData)
    }

    const metadataData = metadataRes.data as MetadataCuracion[] | null
    if (!metadataRes.error && Array.isArray(metadataData) && metadataData.length > 0) {
      cache.metadata = metadataData[0]
      escribirEnLocalStorage(CLAVES.METADATA, metadataData[0])
    }

    // Registrar timestamp de sincronización
    const timestamp = new Date().toISOString()
    cache.sincronizado = true
    escribirEnLocalStorage(CLAVES.SINCRONIZADO, timestamp)

    log.info('Sincronización completa desde Supabase')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.VADEMECUM_CHANGED))
    }
  } catch (e: unknown) {
    log.error('Error en sincronización desde Supabase:', e)
    // No rompemos la app — los datos de respaldo siguen disponibles
  }
}

/**
 * Retorna true si la caché fue sincronizada desde Supabase.
 */
export const estaSincronizado = (): boolean => {
  return cache.sincronizado === true
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES INTERNAS (para testing)
// ═══════════════════════════════════════════════════════════════

/**
 * Limpia la caché en memoria (útil para tests).
 */
export const limpiarCache = (): void => {
  cache = {
    vademecum: null,
    urgencia: null,
    antirresortivos: null,
    alergiasCruzadas: null,
    interacciones: null,
    profilaxisEndocarditis: null,
    manejoAnticoagulantes: null,
    metadata: null,
    sincronizado: false
  }
}

// ═══════════════════════════════════════════════════════════════
// ESCRITURA (CRUD) — F4-03f-1
// ═══════════════════════════════════════════════════════════════

/**
 * Helper interno: emite evento realtime y notifica al usuario.
 */
const notificarCambioVademecum = (accion: string, detalle: Record<string, unknown>): void => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.VADEMECUM_CHANGED, { detail: detalle }))
    }
    notificationService.success(`Vademécum: ${accion}`, { titulo: 'Datos de referencia actualizados' })
  } catch (e: unknown) {
    log.warn('Error al notificar:', extraerMensajeError(e))
  }
}

/**
 * Guarda (INSERT/UPDATE) un fármaco en la tabla vademecum.
 */
export const guardarFarmaco = async (
  farmaco?: FarmacoInput | null
): Promise<{ exito: boolean; error?: string; data?: FarmacoVademecum }> => {
  if (!USE_SUPABASE || !supabase) {
    return { exito: false, error: 'Supabase no configurado' }
  }

  if (!farmaco || typeof farmaco !== 'object') {
    return { exito: false, error: 'Datos de fármaco inválidos' }
  }

  try {
    // Preparar payload (mapear camelCase a snake_case si es necesario)
    const payload = {
      numero: farmaco.numero,
      familia: farmaco.familia,
      nombre_generico: farmaco.nombre_generico || farmaco.nombreGenerico,
      nombre_comercial: farmaco.nombre_comercial || farmaco.nombreComercial || null,
      presentacion: farmaco.presentacion || null,
      posologia_adulto: farmaco.posologia_adulto || farmaco.posologiaAdulto || null,
      posologia_pediatrica: farmaco.posologia_pediatrica || farmaco.posologiaPediatrica || null,
      dosis_max_adulto_mg: farmaco.dosis_max_adulto_mg || farmaco.dosisMaxAdultoMg || null,
      dosis_max_pediatrica_mg_por_kg: farmaco.dosis_max_pediatrica_mg_por_kg || farmaco.dosisMaxPediatricaMgPorKg || null,
      contenido_por_unidad_mg: farmaco.contenido_por_unidad_mg || farmaco.contenidoPorUnidadMg || null,
      volumen_por_unidad_ml: farmaco.volumen_por_unidad_ml || farmaco.volumenPorUnidadMl || null,
      concentracion_mg_por_ml: farmaco.concentracion_mg_por_ml || farmaco.concentracionMgPorMl || null,
      duracion_dias: farmaco.duracion_dias || farmaco.duracionDias || null,
      contraindicaciones: farmaco.contraindicaciones || null,
      alergias_cruzadas: farmaco.alergias_cruzadas || farmaco.alergiasCruzadas || [],
      indicaciones: farmaco.indicaciones || null,
      requiere_receta: farmaco.requiere_receta ?? farmaco.requiereReceta ?? true,
      activo: farmaco.activo ?? true,
      notas_especiales: farmaco.notas_especiales || farmaco.notasEspeciales || null,
      fuente_revision: farmaco.fuente_revision || farmaco.fuenteRevision || 'Edición vía UI admin',
      fecha_revision: farmaco.fecha_revision || farmaco.fechaRevision || new Date().toISOString().split('T')[0],
      curado_por: farmaco.curado_por || farmaco.curadoPor || 'Odontólogo vía UI'
    }

    // UPSERT por número
    const { data, error } = await supabase
      .from('vademecum')
      .upsert(payload, { onConflict: 'numero' })
      .select()
      .single()

    if (error) throw error

    const farmacoGuardado = data as FarmacoVademecum

    // Actualizar caché local
    if (!cache.vademecum) cache.vademecum = []
    const idx = cache.vademecum.findIndex(f => f.numero === farmacoGuardado.numero)
    if (idx >= 0) {
      cache.vademecum[idx] = farmacoGuardado
    } else {
      cache.vademecum.push(farmacoGuardado)
    }
    escribirEnLocalStorage(CLAVES.VADEMECUM, cache.vademecum)

    notificarCambioVademecum(
      idx >= 0 ? `Fármaco #${farmacoGuardado.numero} actualizado` : `Fármaco #${farmacoGuardado.numero} creado`,
      { accion: idx >= 0 ? 'update' : 'insert', numero: farmacoGuardado.numero }
    )

    return { exito: true, data: farmacoGuardado }
  } catch (e: unknown) {
    const errorMsg = extraerMensajeError(e)
    log.error('Error al guardar fármaco:', e)
    notificationService.error(`Error al guardar fármaco: ${errorMsg}`, { titulo: 'Error' })
    return { exito: false, error: errorMsg }
  }
}

/**
 * Desactiva un fármaco (set activo=false). No borra el registro.
 */
export const desactivarFarmaco = async (numero: number): Promise<{ exito: boolean; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { exito: false, error: 'Supabase no configurado' }
  }

  try {
    const { error } = await supabase
      .from('vademecum')
      .update({ activo: false })
      .eq('numero', numero)

    if (error) throw error

    // Actualizar caché
    if (cache.vademecum) {
      const idx = cache.vademecum.findIndex(f => f.numero === numero)
      if (idx >= 0) {
        cache.vademecum[idx].activo = false
        escribirEnLocalStorage(CLAVES.VADEMECUM, cache.vademecum)
      }
    }

    notificarCambioVademecum(`Fármaco #${numero} desactivado`, { accion: 'delete', numero })
    return { exito: true }
  } catch (e: unknown) {
    const errorMsg = extraerMensajeError(e)
    log.error('Error al desactivar fármaco:', e)
    notificationService.error(`Error al desactivar: ${errorMsg}`, { titulo: 'Error' })
    return { exito: false, error: errorMsg }
  }
}

/**
 * Reactiva un fármaco previamente desactivado.
 */
export const reactivarFarmaco = async (numero: number): Promise<{ exito: boolean; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { exito: false, error: 'Supabase no configurado' }
  }

  try {
    const { error } = await supabase
      .from('vademecum')
      .update({ activo: true })
      .eq('numero', numero)

    if (error) throw error

    if (cache.vademecum) {
      const idx = cache.vademecum.findIndex(f => f.numero === numero)
      if (idx >= 0) {
        cache.vademecum[idx].activo = true
        escribirEnLocalStorage(CLAVES.VADEMECUM, cache.vademecum)
      }
    }

    notificarCambioVademecum(`Fármaco #${numero} reactivado`, { accion: 'update', numero })
    return { exito: true }
  } catch (e: unknown) {
    const errorMsg = extraerMensajeError(e)
    log.error('Error al reactivar:', e)
    return { exito: false, error: errorMsg }
  }
}

/**
 * Guarda una regla de alergia cruzada en la matriz.
 */
export const guardarAlergiaCruzada = async (
  regla: AlergiaCruzadaInput
): Promise<{ exito: boolean; error?: string; data?: AlergiaCruzadaItem }> => {
  if (!USE_SUPABASE || !supabase) {
    return { exito: false, error: 'Supabase no configurado' }
  }

  try {
    const payload = {
      familia_alergia: regla.familia_alergia || regla.familiaAlergia,
      familia_farmaco: regla.familia_farmaco || regla.familiaFarmaco,
      severidad: regla.severidad,
      porcentaje_cruzado: regla.porcentaje_cruzado || regla.porcentajeCruzado || null,
      nota_clinica: regla.nota_clinica || regla.notaClinica || null,
      activo: regla.activo ?? true
    }

    const { data, error } = await supabase
      .from('alergias_cruzadas')
      .upsert(payload, { onConflict: 'familia_alergia,familia_farmaco' })
      .select()
      .single()

    if (error) throw error

    const reglaGuardada = data as AlergiaCruzadaItem

    if (!cache.alergiasCruzadas) cache.alergiasCruzadas = []
    const idx = cache.alergiasCruzadas.findIndex(a =>
      a.familia_alergia === reglaGuardada.familia_alergia && a.familia_farmaco === reglaGuardada.familia_farmaco
    )
    if (idx >= 0) {
      cache.alergiasCruzadas[idx] = reglaGuardada
    } else {
      cache.alergiasCruzadas.push(reglaGuardada)
    }
    escribirEnLocalStorage(CLAVES.ALERGIAS_CRUZADAS, cache.alergiasCruzadas)

    notificarCambioVademecum(`Regla de alergia cruzada actualizada`, { accion: 'update', tabla: 'alergias_cruzadas' })
    return { exito: true, data: reglaGuardada }
  } catch (e: unknown) {
    const errorMsg = extraerMensajeError(e)
    log.error('Error al guardar alergia cruzada:', e)
    notificationService.error(`Error: ${errorMsg}`, { titulo: 'Error' })
    return { exito: false, error: errorMsg }
  }
}

/**
 * Guarda una interacción farmacológica.
 */
export const guardarInteraccion = async (
  interaccion: InteraccionInput
): Promise<{ exito: boolean; error?: string; data?: Interaccion }> => {
  if (!USE_SUPABASE || !supabase) {
    return { exito: false, error: 'Supabase no configurado' }
  }

  try {
    const payload = {
      farmaco_a: interaccion.farmaco_a || interaccion.farmacoA,
      farmaco_b: interaccion.farmaco_b || interaccion.farmacoB,
      efecto: interaccion.efecto,
      manejo: interaccion.manejo || null,
      severidad: interaccion.severidad || 'moderada',
      activo: interaccion.activo ?? true
    }

    const { data, error } = await supabase
      .from('interacciones_farmacologicas')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    const interaccionGuardada = data as Interaccion

    if (!cache.interacciones) cache.interacciones = []
    cache.interacciones.push(interaccionGuardada)
    escribirEnLocalStorage(CLAVES.INTERACCIONES, cache.interacciones)

    notificarCambioVademecum(`Interacción agregada`, { accion: 'insert', tabla: 'interacciones' })
    return { exito: true, data: interaccionGuardada }
  } catch (e: unknown) {
    const errorMsg = extraerMensajeError(e)
    log.error('Error al guardar interacción:', e)
    return { exito: false, error: errorMsg }
  }
}

/**
 * Guarda un protocolo de profilaxis de endocarditis.
 */
export const guardarProtocoloEndocarditis = async (
  protocolo: Profilaxis & Record<string, unknown>
): Promise<{ exito: boolean; error?: string; data?: Profilaxis }> => {
  if (!USE_SUPABASE || !supabase) {
    return { exito: false, error: 'Supabase no configurado' }
  }

  try {
    const { data, error } = await supabase
      .from('profilaxis_endocarditis')
      .insert(protocolo)
      .select()
      .single()

    if (error) throw error

    const protoGuardado = data as Profilaxis

    if (!cache.profilaxisEndocarditis) cache.profilaxisEndocarditis = []
    cache.profilaxisEndocarditis.push(protoGuardado)
    escribirEnLocalStorage(CLAVES.PROFILAXIS_ENDOCARDITIS, cache.profilaxisEndocarditis)

    notificarCambioVademecum(`Protocolo de endocarditis agregado`, { accion: 'insert', tabla: 'profilaxis_endocarditis' })
    return { exito: true, data: protoGuardado }
  } catch (e: unknown) {
    const errorMsg = extraerMensajeError(e)
    log.error('Error al guardar protocolo:', e)
    return { exito: false, error: errorMsg }
  }
}

/**
 * Guarda un manejo de anticoagulantes.
 */
export const guardarManejoAnticoagulante = async (
  manejo: Anticoagulante & Record<string, unknown>
): Promise<{ exito: boolean; error?: string; data?: Anticoagulante }> => {
  if (!USE_SUPABASE || !supabase) {
    return { exito: false, error: 'Supabase no configurado' }
  }

  try {
    const { data, error } = await supabase
      .from('manejo_anticoagulantes')
      .insert(manejo)
      .select()
      .single()

    if (error) throw error

    const manejoGuardado = data as Anticoagulante

    if (!cache.manejoAnticoagulantes) cache.manejoAnticoagulantes = []
    cache.manejoAnticoagulantes.push(manejoGuardado)
    escribirEnLocalStorage(CLAVES.MANEJO_ANTICOAGULANTES, cache.manejoAnticoagulantes)

    notificarCambioVademecum(`Manejo de anticoagulante agregado`, { accion: 'insert', tabla: 'manejo_anticoagulantes' })
    return { exito: true, data: manejoGuardado }
  } catch (e: unknown) {
    const errorMsg = extraerMensajeError(e)
    log.error('Error al guardar manejo:', e)
    return { exito: false, error: errorMsg }
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTACIÓN DEL SERVICIO
// ═══════════════════════════════════════════════════════════════
export { obtenerDosisAnestesia }

export const vademecumService = {
  obtenerVademecum,
  obtenerFarmacosPorFamilia,
  obtenerFarmacoPorNumero,
  buscarFarmacoPorNombre,
  obtenerFarmacosUrgencia,
  obtenerAntirresortivos,
  obtenerAlergiasCruzadas,
  evaluarAlergiaCruzada,
  obtenerInteracciones,
  obtenerInteraccionesDeFarmaco,
  obtenerProfilaxisEndocarditis,
  obtenerManejoAnticoagulantes,
  obtenerMetadataCuracion,
  obtenerDosisAnestesia,
  sincronizarDesdeSupabase,
  estaSincronizado,
  limpiarCache,
  // Métodos CRUD (F4-03f-1)
  guardarFarmaco,
  desactivarFarmaco,
  reactivarFarmaco,
  guardarAlergiaCruzada,
  guardarInteraccion,
  guardarProtocoloEndocarditis,
  guardarManejoAnticoagulante
}
