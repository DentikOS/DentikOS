import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'

export interface PrestacionImputable {
  id: string
  nombre: string
  valorBruto: number
  montoNeto: number
  montoImputado: number
  saldoPendiente: number
  estadoFinanciero: 'pendiente' | 'parcial' | 'pagado' | 'sin_saldo'
}

export interface PagoImputable {
  id: string
  monto: number
  metodoPago: string
  fecha: string
  referencia: string | null
  montoImputado: number
  montoSinImputar: number
}

export interface ImputacionRegistrada {
  id: string
  pagoId: string
  itemId: string
  itemNombre: string
  monto: number
  montoRevertido: number
  montoVigente: number
  actorUserId: string
  createdAt: string
  reversiones: Array<{
    id: string
    monto: number
    motivo: string
    actorUserId: string
    createdAt: string
  }>
}

export interface SnapshotImputacionesPresupuesto {
  presupuestoId: string
  items: PrestacionImputable[]
  pagos: PagoImputable[]
  imputaciones: ImputacionRegistrada[]
}

export interface ImputacionPagoInput {
  itemId: string
  monto: number
}

const registro = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}

const mapearSnapshot = (data: unknown): SnapshotImputacionesPresupuesto => {
  const source = registro(data)
  const lista = <T,>(value: unknown, mapper: (item: Record<string, unknown>) => T): T[] =>
    Array.isArray(value) ? value.map((item) => mapper(registro(item))) : []

  return {
    presupuestoId: String(source.presupuesto_id || ''),
    items: lista(source.items, (item) => ({
      id: String(item.id || ''),
      nombre: String(item.nombre || 'Prestación'),
      valorBruto: Number(item.valor_bruto || 0),
      montoNeto: Number(item.monto_neto || 0),
      montoImputado: Number(item.monto_imputado || 0),
      saldoPendiente: Number(item.saldo_pendiente || 0),
      estadoFinanciero: String(item.estado_financiero || 'pendiente') as PrestacionImputable['estadoFinanciero'],
    })),
    pagos: lista(source.pagos, (pago) => ({
      id: String(pago.id || ''),
      monto: Number(pago.monto || 0),
      metodoPago: String(pago.metodo_pago || ''),
      fecha: String(pago.fecha || ''),
      referencia: pago.referencia == null ? null : String(pago.referencia),
      montoImputado: Number(pago.monto_imputado || 0),
      montoSinImputar: Number(pago.monto_sin_imputar || 0),
    })),
    imputaciones: lista(source.imputaciones, (imputacion) => ({
      id: String(imputacion.id || ''),
      pagoId: String(imputacion.pago_id || ''),
      itemId: String(imputacion.item_id || ''),
      itemNombre: String(imputacion.item_nombre || 'Prestación'),
      monto: Number(imputacion.monto || 0),
      montoRevertido: Number(imputacion.monto_revertido || 0),
      montoVigente: Number(imputacion.monto_vigente || 0),
      actorUserId: String(imputacion.actor_user_id || ''),
      createdAt: String(imputacion.created_at || ''),
      reversiones: lista(imputacion.reversiones, (reversion) => ({
        id: String(reversion.id || ''),
        monto: Number(reversion.monto || 0),
        motivo: String(reversion.motivo || ''),
        actorUserId: String(reversion.actor_user_id || ''),
        createdAt: String(reversion.created_at || ''),
      })),
    })),
  }
}

const validarSesionClinica = (presupuestoId: string | number) => {
  const clinicaId = getClinicaActivaSync()
  if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) || !esUuidValido(presupuestoId)) {
    throw new Error('Se necesita una sesión clínica activa y un presupuesto sincronizado.')
  }
}

const validarImputaciones = (imputaciones: ImputacionPagoInput[]) => {
  const vistos = new Set<string>()
  let total = 0
  for (const item of imputaciones) {
    if (!esUuidValido(item.itemId) || !Number.isSafeInteger(item.monto) || item.monto <= 0 || vistos.has(item.itemId)) {
      throw new Error('Cada imputación debe tener una prestación válida y un monto entero positivo.')
    }
    vistos.add(item.itemId)
    total += item.monto
    if (!Number.isSafeInteger(total)) throw new Error('La suma de imputaciones no es válida.')
  }
  return imputaciones.map((item) => ({ item_id: item.itemId, monto: item.monto }))
}

export const notificarImputacionesPagoActualizadas = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('imputaciones_pago_actualizadas'))
}

export const imputacionesPagoService = {
  async listar(presupuestoId: string | number): Promise<SnapshotImputacionesPresupuesto> {
    validarSesionClinica(presupuestoId)
    const { data, error } = await supabase!.rpc('listar_imputaciones_presupuesto', {
      p_presupuesto_id: String(presupuestoId),
    })
    if (error || !data) throw new Error('No se pudo consultar la imputación de pagos del presupuesto.')
    return mapearSnapshot(data)
  },

  async imputar(input: {
    pagoId: string
    operacionId?: string
    imputaciones: ImputacionPagoInput[]
  }): Promise<void> {
    const clinicaId = getClinicaActivaSync()
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) || !esUuidValido(input.pagoId)) {
      throw new Error('Se necesita una sesión clínica activa para imputar el abono.')
    }
    const operacionId = input.operacionId || crypto.randomUUID()
    if (!esUuidValido(operacionId)) throw new Error('Identificador de operación inválido.')
    if (!input.imputaciones.length) throw new Error('Selecciona al menos una prestación para imputar.')
    const { error } = await supabase.rpc('registrar_imputaciones_pago', {
      p_pago_id: input.pagoId,
      p_operacion_id: operacionId,
      p_imputaciones: validarImputaciones(input.imputaciones),
    })
    if (error) throw new Error('No se pudo imputar el abono. Comprueba el saldo y vuelve a intentarlo.')
    notificarImputacionesPagoActualizadas()
  },

  async revertir(input: { imputacionId: string; motivo: string; operacionId?: string }): Promise<void> {
    const clinicaId = getClinicaActivaSync()
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) || !esUuidValido(input.imputacionId)) {
      throw new Error('Se necesita una sesión clínica activa para corregir la imputación.')
    }
    const operacionId = input.operacionId || crypto.randomUUID()
    if (!esUuidValido(operacionId)) throw new Error('Identificador de operación inválido.')
    if (input.motivo.trim().length < 5 || input.motivo.trim().length > 250) {
      throw new Error('Indica un motivo de corrección de entre 5 y 250 caracteres.')
    }
    const { error } = await supabase.rpc('revertir_imputacion_pago', {
      p_imputacion_id: input.imputacionId,
      p_operacion_id: operacionId,
      p_motivo: input.motivo.trim(),
    })
    if (error) throw new Error('No se pudo revertir la imputación. Comprueba el estado y vuelve a intentarlo.')
    notificarImputacionesPagoActualizadas()
  },
}
