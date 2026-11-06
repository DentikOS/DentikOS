import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

const log = createLogger('laboratorioFinanceService')
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const METODOS_PAGO = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Cheque'] as const

export type MetodoPagoLaboratorio = typeof METODOS_PAGO[number]

export interface CostoOrdenLaboratorio {
  ordenId: string
  costoTotal: number
  precioPaciente: number | null
  moneda: 'CLP'
  updatedAt?: string
}

export interface PagoLaboratorio {
  id: string
  monto: number
  fecha: string
  metodoPago: MetodoPagoLaboratorio
  createdAt?: string
}

export interface ResumenPagosLaboratorio {
  ordenId: string
  totalPagado: number
  saldo: number
  costoTotal?: number
  pagos: PagoLaboratorio[]
}

export interface RegistrarPagoLaboratorioInput {
  ordenId: string
  monto: number
  fecha: string
  metodoPago: MetodoPagoLaboratorio
  idempotencyKey: string
}

export class LaboratorioFinanceError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LaboratorioFinanceError'
  }
}

const requireContext = async (): Promise<string> => {
  if (!USE_SUPABASE || !supabase) {
    throw new LaboratorioFinanceError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
  }
  const clinicaLocal = getClinicaActivaSync()
  if (!clinicaLocal) {
    throw new LaboratorioFinanceError('Se requiere una clínica activa', 'CLINIC_REQUIRED')
  }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session?.user?.id) {
    throw new LaboratorioFinanceError('Se requiere una sesión autenticada', 'AUTH_REQUIRED')
  }
  const { data: clinicaServidor, error: clinicError } = await supabase.rpc('clinica_actual')
  if (clinicError || !clinicaServidor) {
    throw new LaboratorioFinanceError('El servidor no confirmó una membresía activa', 'CLINIC_MEMBERSHIP_REQUIRED')
  }
  if (clinicaServidor !== clinicaLocal) {
    throw new LaboratorioFinanceError('La clínica activa del servidor no coincide con la seleccionada', 'CLINIC_CONTEXT_MISMATCH')
  }
  return clinicaServidor
}

const validarOrdenId = (ordenId: string): void => {
  if (!UUID_PATTERN.test(ordenId)) {
    throw new LaboratorioFinanceError('La orden seleccionada no es válida', 'INVALID_ORDER')
  }
}

const errorDeServidor = (message: string, code: string, cause: unknown): LaboratorioFinanceError => {
  log.warn(message)
  return new LaboratorioFinanceError(message, code, { cause })
}

const leerPago = (row: Record<string, unknown>): PagoLaboratorio => ({
  id: String(row.id || ''),
  monto: Number(row.monto || 0),
  fecha: String(row.fecha || ''),
  metodoPago: row.metodo_pago as MetodoPagoLaboratorio,
  ...(typeof row.created_at === 'string' ? { createdAt: row.created_at } : {})
})

export const laboratorioFinanceService = {
  async obtenerCostoOrden(ordenId: string): Promise<CostoOrdenLaboratorio | null> {
    const clinicaId = await requireContext()
    validarOrdenId(ordenId)
    if (!supabase) throw new LaboratorioFinanceError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.from('ordenes_laboratorio_costos')
      .select('orden_id,costo_total,precio_paciente,moneda,updated_at')
      .eq('clinica_id', clinicaId)
      .eq('orden_id', ordenId)
      .maybeSingle()
    if (error) throw errorDeServidor('No se pudo consultar el costo de la orden', 'COST_LOAD_FAILED', error)
    if (!data) return null
    const row = data as Record<string, unknown>
    return {
      ordenId: String(row.orden_id),
      costoTotal: Number(row.costo_total),
      precioPaciente: row.precio_paciente === null ? null : Number(row.precio_paciente),
      moneda: 'CLP',
      ...(typeof row.updated_at === 'string' ? { updatedAt: row.updated_at } : {})
    }
  },

  async obtenerPrecioPaciente(ordenId: string): Promise<number | null> {
    await requireContext()
    validarOrdenId(ordenId)
    if (!supabase) throw new LaboratorioFinanceError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('precio_paciente_orden_laboratorio', { p_orden_id: ordenId })
    if (error) throw errorDeServidor('No se pudo consultar el precio al paciente', 'PATIENT_PRICE_LOAD_FAILED', error)
    if (!data || typeof data !== 'object') {
      throw new LaboratorioFinanceError('El servidor no devolvió el precio de la orden', 'EMPTY_RESPONSE')
    }
    const precio = (data as { precio_paciente?: unknown }).precio_paciente
    return typeof precio === 'number' ? precio : null
  },

  async obtenerResumenPagos(ordenId: string): Promise<ResumenPagosLaboratorio> {
    await requireContext()
    validarOrdenId(ordenId)
    if (!supabase) throw new LaboratorioFinanceError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('resumen_pagos_laboratorio', { p_orden_id: ordenId })
    if (error?.code === 'P0002') {
      throw new LaboratorioFinanceError('La orden todavía no tiene costos registrados', 'COST_NOT_REGISTERED', { cause: error })
    }
    if (error) throw errorDeServidor('No se pudo consultar el saldo de la orden', 'PAYMENT_SUMMARY_FAILED', error)
    if (!data || typeof data !== 'object') {
      throw new LaboratorioFinanceError('El servidor no devolvió el saldo de la orden', 'EMPTY_RESPONSE')
    }
    const row = data as Record<string, unknown>
    const pagos = Array.isArray(row.pagos) ? row.pagos.map(pago => leerPago(pago as Record<string, unknown>)) : []
    return {
      ordenId: String(row.orden_id || ordenId),
      totalPagado: Number(row.total_pagado || 0),
      saldo: Number(row.saldo || 0),
      ...(typeof row.costo_total === 'number' ? { costoTotal: row.costo_total } : {}),
      pagos
    }
  },

  async guardarCostoOrden(input: {
    ordenId: string
    costoTotal: number
    precioPaciente: number | null
  }): Promise<void> {
    await requireContext()
    validarOrdenId(input.ordenId)
    if (!Number.isSafeInteger(input.costoTotal) || input.costoTotal < 0
      || (input.precioPaciente !== null && (!Number.isSafeInteger(input.precioPaciente) || input.precioPaciente < 0))) {
      throw new LaboratorioFinanceError('Los montos de la orden no son válidos', 'INVALID_AMOUNT')
    }
    if (!supabase) throw new LaboratorioFinanceError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { error } = await supabase.rpc('guardar_costo_orden_laboratorio', {
      p_orden_id: input.ordenId,
      p_costo_total: input.costoTotal,
      p_precio_paciente: input.precioPaciente
    })
    if (error) throw errorDeServidor('No se pudo guardar el costo de la orden', 'COST_SAVE_FAILED', error)
  },

  async registrarPago(input: RegistrarPagoLaboratorioInput): Promise<Record<string, unknown>> {
    await requireContext()
    validarOrdenId(input.ordenId)
    if (!Number.isSafeInteger(input.monto) || input.monto <= 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)
      || !METODOS_PAGO.includes(input.metodoPago)
      || !UUID_PATTERN.test(input.idempotencyKey)) {
      throw new LaboratorioFinanceError('Los datos del pago no son válidos', 'INVALID_PAYMENT')
    }
    if (!supabase) throw new LaboratorioFinanceError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('registrar_pago_laboratorio', {
      p_orden_id: input.ordenId,
      p_monto: input.monto,
      p_fecha: input.fecha,
      p_metodo_pago: input.metodoPago,
      p_idempotency_key: input.idempotencyKey
    })
    if (error) throw errorDeServidor('No se pudo registrar el pago de laboratorio', 'PAYMENT_SAVE_FAILED', error)
    if (!data || typeof data !== 'object') {
      throw new LaboratorioFinanceError('El servidor no confirmó el pago de laboratorio', 'EMPTY_RESPONSE')
    }
    return data as Record<string, unknown>
  },

  generarIdempotencyKey(): string {
    if (!globalThis.crypto?.randomUUID) {
      throw new LaboratorioFinanceError('El navegador no permite generar claves seguras', 'CRYPTO_UNAVAILABLE')
    }
    return globalThis.crypto.randomUUID()
  }
}
