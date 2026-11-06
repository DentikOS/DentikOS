import { useSesionStore } from '../../../../app/stores/sesionStore'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

const log = createLogger('treasuryCloudService')

export type TreasuryRow = Record<string, unknown>

export interface TreasurySnapshot {
  clinicaId: string
  rol: string
  cajaSesiones: TreasuryRow[]
  cajaMovimientos: TreasuryRow[]
  cuentasBancarias: TreasuryRow[]
  extractos: TreasuryRow[]
  extractoFilas: TreasuryRow[]
  conciliaciones: TreasuryRow[]
  gastos: TreasuryRow[]
  documentosGasto: TreasuryRow[]
  bonos: TreasuryRow[]
  liquidacionesBono: TreasuryRow[]
  parametrosProyeccion: TreasuryRow[]
  pagos: TreasuryRow[]
  presupuestos: TreasuryRow[]
  pacientes: TreasuryRow[]
}

export interface CashCountLine {
  valorMinor: number
  cantidad: number
}

export interface NewBankStatement {
  cuentaBancariaId: string
  hashArchivo: string
  moneda: string
  filas: Array<{ fecha: string; monto_minor: number; moneda: string; descripcion: string; referencia: string }>
  idempotencyKey: string
}

export interface NewExpense {
  fecha_emision: string
  fecha_pago?: string | null
  categoria: string
  proveedor_nombre: string
  proveedor_rut?: string | null
  descripcion: string
  moneda: string
  neto_minor: number
  iva_minor: number
  exento_minor: number
  total_minor: number
  iva_recuperable: boolean
  tipo_documento?: string | null
  folio_documento?: string | null
  estado?: 'pendiente' | 'pagado'
  metodo_pago?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro' | null
  idempotency_key?: string
}

export interface TreasuryContext {
  clinicaId: string
  userId: string
  rol: string
}

export class TreasuryCloudError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TreasuryCloudError'
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 3) | 8).toString(16)
  })
}

export const treasuryCloudService = {
  async requireContext(allowedRoles: readonly string[] = ['admin']): Promise<TreasuryContext> {
    if (!USE_SUPABASE || !supabase) {
      throw new TreasuryCloudError('Tesorería requiere conexión con Supabase.', 'SUPABASE_UNAVAILABLE')
    }
    const clinicaLocal = useSesionStore.getState().clinicaActual
    if (!clinicaLocal) throw new TreasuryCloudError('Selecciona una clínica activa.', 'CLINIC_REQUIRED')

    const [{ data: sessionData, error: sessionError }, clinicResult, roleResult] = await Promise.all([
      supabase.auth.getSession(),
      supabase.rpc('clinica_actual'),
      supabase.rpc('rol_en_clinica_actual')
    ])
    if (sessionError || !sessionData.session?.user?.id) {
      throw new TreasuryCloudError('La sesión autenticada no está disponible.', 'AUTH_REQUIRED', { cause: sessionError })
    }
    if (clinicResult.error || roleResult.error || typeof clinicResult.data !== 'string' || typeof roleResult.data !== 'string') {
      throw new TreasuryCloudError('El servidor no confirmó la membresía activa.', 'MEMBERSHIP_REQUIRED', {
        cause: clinicResult.error || roleResult.error
      })
    }
    if (clinicResult.data !== clinicaLocal) {
      throw new TreasuryCloudError('La clínica activa del servidor no coincide con la aplicación.', 'CLINIC_CONTEXT_MISMATCH')
    }
    if (!allowedRoles.includes(roleResult.data)) {
      throw new TreasuryCloudError('Tu rol no tiene acceso a esta operación de tesorería.', 'ROLE_FORBIDDEN')
    }
    return { clinicaId: clinicResult.data, userId: sessionData.session.user.id, rol: roleResult.data }
  },

  async cargar(): Promise<TreasurySnapshot> {
    const context = await this.requireContext(['admin', 'recepcion'])
    const [cajaSesiones, cajaMovimientos] = await Promise.all([
      leerTabla('bp15_caja_sesiones', context.clinicaId, 'fecha_operacion'),
      leerTabla('bp15_caja_movimientos', context.clinicaId, 'created_at')
    ])
    const base: TreasurySnapshot = {
      clinicaId: context.clinicaId,
      rol: context.rol,
      cajaSesiones,
      cajaMovimientos,
      cuentasBancarias: [], extractos: [], extractoFilas: [], conciliaciones: [],
      gastos: [], documentosGasto: [], bonos: [], liquidacionesBono: [],
      parametrosProyeccion: [], pagos: [], presupuestos: [], pacientes: []
    }
    if (context.rol === 'recepcion') return base

    const [cuentasBancarias, extractos, extractoFilas, conciliaciones, gastos, documentosGasto,
      bonos, liquidacionesBono, parametrosProyeccion, pagos, presupuestos, pacientes] = await Promise.all([
      leerTabla('bp15_cuentas_bancarias', context.clinicaId, 'created_at'),
      leerTabla('bp15_extractos', context.clinicaId, 'importado_at'),
      leerTabla('bp15_extracto_filas', context.clinicaId, 'fecha'),
      leerTabla('bp15_conciliaciones', context.clinicaId, 'created_at'),
      leerTabla('bp15_gastos', context.clinicaId, 'fecha_emision'),
      leerTabla('bp15_gasto_documentos', context.clinicaId, 'created_at'),
      leerTabla('bp15_bonos', context.clinicaId, 'created_at'),
      leerTabla('bp15_bono_liquidaciones', context.clinicaId, 'fecha'),
      leerTabla('bp15_parametros_proyeccion', context.clinicaId, 'updated_at'),
      leerTabla('pagos', context.clinicaId, 'fecha'),
      leerTabla('presupuestos', context.clinicaId, 'created_at'),
      leerTabla('pacientes', context.clinicaId, 'nombre')
    ])
    return { ...base, cuentasBancarias, extractos, extractoFilas, conciliaciones, gastos,
      documentosGasto, bonos, liquidacionesBono, parametrosProyeccion, pagos, presupuestos, pacientes }
  },

  async abrirCaja(moneda: string, montoAperturaMinor: number): Promise<string> {
    await this.requireContext(['admin', 'recepcion'])
    validarImporte(montoAperturaMinor)
    if (!/^[A-Z]{3}$/.test(moneda)) throw new TreasuryCloudError('Moneda inválida.', 'INVALID_CURRENCY')
    if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('bp15_abrir_caja', {
      p_moneda: moneda, p_monto_apertura_minor: montoAperturaMinor, p_idempotency_key: uuid()
    })
    if (error || typeof data !== 'string') throw mapearError(error, 'No se pudo abrir la caja.')
    return data
  },

  async cerrarCaja(sesionId: string, conteo: readonly CashCountLine[], motivo: string): Promise<TreasuryRow> {
    await this.requireContext(['admin', 'recepcion'])
    if (!UUID_PATTERN.test(sesionId) || conteo.length < 1 || conteo.length > 30) {
      throw new TreasuryCloudError('El cierre tiene datos inválidos.', 'INVALID_CASH_CLOSE')
    }
    if (conteo.some((line) => !Number.isSafeInteger(line.valorMinor) || line.valorMinor <= 0
      || !Number.isSafeInteger(line.cantidad) || line.cantidad <= 0)) {
      throw new TreasuryCloudError('Revisa las denominaciones y cantidades del arqueo.', 'INVALID_CASH_COUNT')
    }
    if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('bp15_cerrar_caja', {
      p_caja_sesion_id: sesionId,
      p_conteo: conteo,
      p_motivo: motivo.trim() || null,
      p_idempotency_key: uuid()
    })
    if (error || !data || typeof data !== 'object') throw mapearError(error, 'No se pudo cerrar la caja.')
    return data as TreasuryRow
  },

  async guardarCuentaBancaria(input: {
    alias: string; entidad: string; ultimosCuatro: string; moneda: string; activa?: boolean
  }): Promise<void> {
    const { clinicaId, userId } = await this.requireContext()
    if (!input.alias.trim() || input.alias.trim().length > 80 || !input.entidad.trim()
      || input.entidad.trim().length > 120 || !/^\d{4}$/.test(input.ultimosCuatro)
      || !/^[A-Z]{3}$/.test(input.moneda)) {
      throw new TreasuryCloudError('Revisa el alias, banco, últimos cuatro dígitos y moneda de la cuenta.', 'INVALID_BANK_ACCOUNT')
    }
    if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
    const row = { clinica_id: clinicaId, alias: input.alias.trim(), entidad: input.entidad.trim(),
      ultimos_cuatro: input.ultimosCuatro, moneda: input.moneda, activa: input.activa ?? true,
      created_by: userId, updated_by: userId }
    const { error } = await supabase.from('bp15_cuentas_bancarias').insert(row)
    if (error) throw mapearError(error, 'No se pudo guardar la cuenta bancaria.')
  },

  async importarExtracto(input: NewBankStatement): Promise<string> {
    const { rol } = await this.requireContext()
    if (rol !== 'admin') throw new TreasuryCloudError('Solo admin puede importar extractos.', 'ROLE_FORBIDDEN')
    if (!UUID_PATTERN.test(input.cuentaBancariaId) || !/^[0-9a-f]{64}$/.test(input.hashArchivo)
      || input.filas.length < 1 || input.filas.length > 10_000) {
      throw new TreasuryCloudError('El extracto no cumple los límites de importación.', 'INVALID_STATEMENT')
    }
    if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
    const fechas = input.filas.map((row) => row.fecha).sort()
    const { data, error } = await supabase.rpc('bp15_importar_extracto', {
      p_cuenta_bancaria_id: input.cuentaBancariaId,
      p_hash_archivo: input.hashArchivo,
      p_moneda: input.moneda,
      p_fecha_desde: fechas[0],
      p_fecha_hasta: fechas[fechas.length - 1],
      p_filas: input.filas,
      p_idempotency_key: input.idempotencyKey
    })
    if (error || typeof data !== 'string') throw mapearError(error, 'No se pudo importar el extracto.')
    return data
  },

  async conciliar(input: { extractoFilaId: string; moneda: string; tipoFuente: 'pago' | 'gasto' | 'bono'; fuenteId: string }): Promise<void> {
    const { clinicaId } = await this.requireContext()
    if (!supabase || !UUID_PATTERN.test(input.extractoFilaId) || !UUID_PATTERN.test(input.fuenteId)) {
      throw new TreasuryCloudError('La conciliación tiene referencias inválidas.', 'INVALID_RECONCILIATION')
    }
    const row = {
      clinica_id: clinicaId, extracto_fila_id: input.extractoFilaId, moneda: input.moneda,
      pago_id: input.tipoFuente === 'pago' ? input.fuenteId : null,
      gasto_id: input.tipoFuente === 'gasto' ? input.fuenteId : null,
      bono_liquidacion_id: input.tipoFuente === 'bono' ? input.fuenteId : null,
      idempotency_key: uuid(), created_by: await usuarioActual(), updated_by: await usuarioActual()
    }
    const { error } = await supabase.from('bp15_conciliaciones').insert(row)
    if (error) throw mapearError(error, 'No se pudo confirmar la conciliación.')
  },

  async revertirConciliacion(id: string, motivo: string): Promise<void> {
    await this.requireContext()
    if (!supabase || !UUID_PATTERN.test(id) || motivo.trim().length < 5) {
      throw new TreasuryCloudError('La reversión requiere un motivo de al menos 5 caracteres.', 'INVALID_REVERSAL')
    }
    const { error } = await supabase.from('bp15_conciliaciones')
      .update({ estado: 'revertida', motivo_reversion: motivo.trim() }).eq('id', id)
    if (error) throw mapearError(error, 'No se pudo revertir la conciliación.')
  },

  async guardarGasto(input: NewExpense): Promise<void> {
    const { clinicaId, userId } = await this.requireContext()
    if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
    if (input.total_minor !== input.neto_minor + input.iva_minor + input.exento_minor) {
      throw new TreasuryCloudError('El total debe coincidir con neto, IVA y exento.', 'INVALID_EXPENSE_TOTAL')
    }
    const { error } = await supabase.from('bp15_gastos').insert({
      ...input, clinica_id: clinicaId, created_by: userId, updated_by: userId, idempotency_key: input.idempotency_key || uuid()
    })
    if (error) throw mapearError(error, 'No se pudo registrar el gasto.')
  },

  async pagarGasto(gastoId: string, fechaPago: string, metodoPago: string): Promise<void> {
    await this.requireContext()
    if (!supabase || !UUID_PATTERN.test(gastoId)) throw new TreasuryCloudError('Gasto inválido.', 'INVALID_EXPENSE')
    const { error } = await supabase.from('bp15_gastos').update({ estado: 'pagado', fecha_pago: fechaPago, metodo_pago: metodoPago }).eq('id', gastoId)
    if (error) throw mapearError(error, 'No se pudo registrar el pago del gasto.')
  },

  async anularGasto(gastoId: string, motivo: string): Promise<void> {
    await this.requireContext()
    if (!supabase || !UUID_PATTERN.test(gastoId) || motivo.trim().length < 5) {
      throw new TreasuryCloudError('La anulación requiere un motivo de al menos 5 caracteres.', 'INVALID_ANNULMENT')
    }
    const { error } = await supabase.from('bp15_gastos').update({ estado: 'anulado', motivo_anulacion: motivo.trim() }).eq('id', gastoId)
    if (error) throw mapearError(error, 'No se pudo anular el gasto.')
  },

  async guardarBono(input: {
    numero_bono: string; paciente_id?: string | null; prevision: string; moneda: string;
    monto_total_minor: number; aporte_minor: number; copago_minor: number;
    fecha_emision?: string | null; fecha_vencimiento?: string | null; estado?: string
  }): Promise<void> {
    const { clinicaId, userId } = await this.requireContext()
    if (!supabase || input.monto_total_minor !== input.aporte_minor + input.copago_minor) {
      throw new TreasuryCloudError('El total del bono debe ser igual al aporte más el copago.', 'INVALID_BONO_TOTAL')
    }
    const { error } = await supabase.from('bp15_bonos').insert({ ...input, clinica_id: clinicaId,
      created_by: userId, updated_by: userId, idempotency_key: uuid() })
    if (error) throw mapearError(error, 'No se pudo registrar el bono.')
  },

  async liquidarBono(input: { bonoId: string; montoMinor: number; moneda: string; fecha: string; metodoPago: string; referencia?: string }): Promise<void> {
    const { clinicaId, userId } = await this.requireContext()
    if (!supabase || !UUID_PATTERN.test(input.bonoId)) throw new TreasuryCloudError('Bono inválido.', 'INVALID_BONO')
    const { error } = await supabase.from('bp15_bono_liquidaciones').insert({
      clinica_id: clinicaId, bono_id: input.bonoId, monto_minor: input.montoMinor, moneda: input.moneda,
      fecha: input.fecha, metodo_pago: input.metodoPago, referencia: input.referencia?.trim() || null,
      estado: 'confirmada', created_by: userId, updated_by: userId, idempotency_key: uuid()
    })
    if (error) throw mapearError(error, 'No se pudo registrar la liquidación del bono.')
  },

  async guardarParametrosProyeccion(input: { moneda: string; escenario: string; tasaBps: number; horizonteDias: number }): Promise<void> {
    const { clinicaId, userId } = await this.requireContext()
    if (!Number.isSafeInteger(input.tasaBps) || input.tasaBps < 0 || input.tasaBps > 10_000) {
      throw new TreasuryCloudError('La tasa debe estar entre 0 y 100%.', 'INVALID_PROJECTION_RATE')
    }
    if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
    if (!/^[A-Z]{3}$/.test(input.moneda) || !['optimista', 'realista', 'pesimista'].includes(input.escenario)
      || !Number.isSafeInteger(input.horizonteDias) || input.horizonteDias < 1 || input.horizonteDias > 3650) {
      throw new TreasuryCloudError('La moneda, escenario o horizonte de proyección no es válido.', 'INVALID_PROJECTION_INPUT')
    }
    const { error } = await supabase.from('bp15_parametros_proyeccion').upsert({
      clinica_id: clinicaId, moneda: input.moneda, escenario: input.escenario,
      tasa_cobranza_bps: input.tasaBps, horizonte_dias: input.horizonteDias,
      created_by: userId, updated_by: userId
    }, { onConflict: 'clinica_id,moneda,escenario' })
    if (error) throw mapearError(error, 'No se pudieron guardar los parámetros de proyección.')
  },

  async subirDocumentoGasto(input: { gastoId: string; file: File }): Promise<void> {
    const { rol } = await this.requireContext()
    if (!supabase || rol !== 'admin' || !UUID_PATTERN.test(input.gastoId)) {
      throw new TreasuryCloudError('Solo admin puede asociar respaldos a un gasto válido.', 'EXPENSE_DOCUMENT_FORBIDDEN')
    }
    const file = input.file
    if (!file || file.size < 1 || file.size > 10 * 1024 * 1024
      || !['application/pdf', 'application/xml', 'text/xml', 'image/jpeg', 'image/png'].includes(file.type)) {
      throw new TreasuryCloudError('El respaldo debe ser PDF, XML, JPG o PNG y no superar 10 MB.', 'INVALID_EXPENSE_DOCUMENT')
    }
    const bytes = await file.arrayBuffer()
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (byte) => byte.toString(16).padStart(2, '0')).join('')
    const solicitar = async (body: Record<string, unknown>) => {
      const { data, error } = await supabase!.functions.invoke('r2-finanzas-documento-url', { body })
      if (error || !data) throw new TreasuryCloudError('No se pudo autorizar el respaldo financiero.', 'EXPENSE_DOCUMENT_AUTH_FAILED')
      return data as Record<string, unknown>
    }
    const upload = await solicitar({ action: 'upload', gasto_id: input.gastoId,
      mime_type: file.type, bytes: file.size, sha256 })
    if (typeof upload.upload_url !== 'string' || typeof upload.r2_key !== 'string'
      || !upload.upload_headers || typeof upload.upload_headers !== 'object') {
      throw new TreasuryCloudError('El servidor devolvió una autorización incompleta.', 'EXPENSE_DOCUMENT_AUTH_FAILED')
    }
    let response: Response
    try {
      response = await fetch(upload.upload_url, { method: 'PUT',
        headers: upload.upload_headers as Record<string, string>, body: file })
    } catch {
      throw new TreasuryCloudError('No se pudo subir el respaldo al almacenamiento privado.', 'EXPENSE_DOCUMENT_UPLOAD_FAILED')
    }
    if (!response.ok) throw new TreasuryCloudError('No se pudo subir el respaldo al almacenamiento privado.', 'EXPENSE_DOCUMENT_UPLOAD_FAILED')
    await solicitar({ action: 'confirm', gasto_id: input.gastoId, r2_key: upload.r2_key,
      mime_type: file.type, bytes: file.size, sha256 })
  },

  async descargarDocumentoGasto(documentoId: string): Promise<void> {
    const { rol } = await this.requireContext()
    if (!supabase || rol !== 'admin' || !UUID_PATTERN.test(documentoId)) {
      throw new TreasuryCloudError('Solo admin puede descargar un respaldo válido.', 'EXPENSE_DOCUMENT_FORBIDDEN')
    }
    const { data, error } = await supabase.functions.invoke('r2-finanzas-documento-url', {
      body: { action: 'download', documento_id: documentoId }
    })
    if (error || !data || typeof data.download_url !== 'string'
      || !data.download_headers || typeof data.download_headers !== 'object') {
      throw new TreasuryCloudError('No se pudo autorizar la descarga del respaldo.', 'EXPENSE_DOCUMENT_DOWNLOAD_FAILED')
    }
    let response: Response
    try {
      response = await fetch(data.download_url, { method: 'GET', headers: data.download_headers as Record<string, string> })
    } catch {
      throw new TreasuryCloudError('No se pudo descargar el respaldo privado.', 'EXPENSE_DOCUMENT_DOWNLOAD_FAILED')
    }
    if (!response.ok) throw new TreasuryCloudError('No se pudo descargar el respaldo privado.', 'EXPENSE_DOCUMENT_DOWNLOAD_FAILED')
    const blob = await response.blob()
    const extension = data.mime_type === 'application/pdf' ? 'pdf'
      : data.mime_type === 'image/png' ? 'png' : data.mime_type === 'image/jpeg' ? 'jpg' : 'xml'
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `respaldo-${documentoId}.${extension}`
    link.click()
    URL.revokeObjectURL(url)
  }
}

async function leerTabla(tabla: string, clinicaId: string, ordenarPor: string): Promise<TreasuryRow[]> {
  if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
  const { data, error } = await supabase.from(tabla).select('*').eq('clinica_id', clinicaId).order(ordenarPor, { ascending: false })
  if (error) {
    log.warn(`No se pudo cargar ${tabla} desde Supabase`)
    throw mapearError(error, 'No se pudieron sincronizar los datos de tesorería.')
  }
  return (data || []) as TreasuryRow[]
}

async function usuarioActual(): Promise<string> {
  if (!supabase) throw new TreasuryCloudError('Supabase no está disponible.', 'SUPABASE_UNAVAILABLE')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id) throw new TreasuryCloudError('La sesión autenticada no está disponible.', 'AUTH_REQUIRED')
  return data.session.user.id
}

function validarImporte(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new TreasuryCloudError('El monto debe ser un entero no negativo.', 'INVALID_AMOUNT')
}

function mapearError(error: { message?: string; code?: string } | null, mensaje: string): TreasuryCloudError {
  const code = error?.message?.includes('no-session') ? 'CASH_SESSION_REQUIRED' : (error?.code || 'TREASURY_WRITE_FAILED')
  return new TreasuryCloudError(code === 'CASH_SESSION_REQUIRED'
    ? 'Abre la caja de esta clínica y moneda antes de confirmar efectivo.'
    : mensaje, code)
}
