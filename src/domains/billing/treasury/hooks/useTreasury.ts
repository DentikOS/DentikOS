import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { treasuryCloudService, type CashCountLine, type NewExpense, type NewBankStatement, type TreasuryRow, type TreasurySnapshot } from '../services/treasuryCloudService'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { suscribirseATabla } from '../../../../infrastructure/realtime/realtimeService'

export interface TreasuryActions {
  abrirCaja: (moneda: string, aperturaMinor: number) => Promise<void>
  cerrarCaja: (sesionId: string, conteo: readonly CashCountLine[], motivo: string) => Promise<TreasuryRow>
  guardarCuentaBancaria: (input: { alias: string; entidad: string; ultimosCuatro: string; moneda: string }) => Promise<void>
  importarExtracto: (input: NewBankStatement) => Promise<string>
  conciliar: (input: { extractoFilaId: string; moneda: string; tipoFuente: 'pago' | 'gasto' | 'bono'; fuenteId: string }) => Promise<void>
  revertirConciliacion: (id: string, motivo: string) => Promise<void>
  guardarGasto: (input: NewExpense) => Promise<void>
  pagarGasto: (id: string, fecha: string, metodo: string) => Promise<void>
  anularGasto: (id: string, motivo: string) => Promise<void>
  guardarBono: (input: Parameters<typeof treasuryCloudService.guardarBono>[0]) => Promise<void>
  liquidarBono: (input: Parameters<typeof treasuryCloudService.liquidarBono>[0]) => Promise<void>
  guardarParametros: (input: Parameters<typeof treasuryCloudService.guardarParametrosProyeccion>[0]) => Promise<void>
  subirDocumentoGasto: (input: { gastoId: string; file: File }) => Promise<void>
  descargarDocumentoGasto: (documentoId: string) => Promise<void>
}

export interface TreasuryHookResult {
  snapshot: TreasurySnapshot | null
  loading: boolean
  error: string | null
  online: boolean
  refrescar: () => Promise<void>
  acciones: TreasuryActions
}

const TABLAS_TESORERIA = [
  'bp15_caja_sesiones', 'bp15_caja_eventos', 'bp15_caja_movimientos',
  'bp15_cuentas_bancarias', 'bp15_extractos', 'bp15_extracto_filas', 'bp15_conciliaciones',
  'bp15_gastos', 'bp15_gasto_documentos', 'bp15_bonos', 'bp15_bono_liquidaciones',
  'bp15_parametros_proyeccion', 'pagos', 'presupuestos'
] as const

export function useTreasury(): TreasuryHookResult {
  const clinicaId = useSesionStore((state) => state.clinicaActual)
  const rol = useSesionStore((state) => state.userProfile?.rol)
  const [snapshot, setSnapshot] = useState<TreasurySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const loadSequence = useRef(0)
  const activeClinic = useRef(clinicaId)
  const activeRole = useRef(rol)

  const refrescar = useCallback(async (): Promise<void> => {
    const sequence = ++loadSequence.current
    if (!clinicaId || !rol || !USE_SUPABASE) {
      setSnapshot(null)
      setLoading(false)
      setError('Tesorería requiere una clínica activa y Supabase configurado.')
      return
    }
    if (rol !== 'admin' && rol !== 'recepcion') {
      setSnapshot(null)
      setLoading(false)
      setError('Tu rol no tiene acceso a Finanzas y Tesorería.')
      return
    }
    setLoading(true)
    try {
      const next = await treasuryCloudService.cargar()
      if (sequence !== loadSequence.current || activeClinic.current !== clinicaId || activeRole.current !== rol) return
      if (next.clinicaId !== clinicaId) throw new Error('El servidor respondió con otra clínica activa.')
      setSnapshot(next)
      setError(null)
      setOnline(true)
    } catch (cause) {
      if (sequence !== loadSequence.current || activeClinic.current !== clinicaId || activeRole.current !== rol) return
      const message = cause instanceof Error ? cause.message : 'No se pudieron sincronizar los datos de tesorería.'
      setError(message)
      if (typeof navigator !== 'undefined' && !navigator.onLine) setOnline(false)
    } finally {
      if (sequence === loadSequence.current && activeClinic.current === clinicaId && activeRole.current === rol) setLoading(false)
    }
  }, [clinicaId, rol])

  const ejecutar = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setOnline(false)
      throw new Error('Esta operación requiere conexión. No se guardó ningún cambio.')
    }
    const result = await operation()
    await refrescar()
    return result
  }, [refrescar])

  useEffect(() => {
    activeClinic.current = clinicaId
    activeRole.current = rol
    const seq = loadSequence
    seq.current++
    setSnapshot(null)
    setError(null)
    void refrescar()
    return () => { seq.current++ }
  }, [clinicaId, rol, refrescar])

  useEffect(() => {
    if (!clinicaId || !USE_SUPABASE) return
    const subscriptions = TABLAS_TESORERIA.map((tabla) => suscribirseATabla(tabla, () => { void refrescar() }, {
      filtro: { columna: 'clinica_id', valor: clinicaId }
    })).filter((subscription) => subscription !== null)
    return () => subscriptions.forEach((subscription) => subscription.unsubscribe())
  }, [clinicaId, refrescar])

  useEffect(() => {
    const handleOnline = (): void => { setOnline(true); void refrescar() }
    const handleOffline = (): void => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refrescar])

  const acciones = useMemo<TreasuryActions>(() => ({
    abrirCaja: async (moneda, apertura) => { await ejecutar(() => treasuryCloudService.abrirCaja(moneda, apertura)) },
    cerrarCaja: (id, conteo, motivo) => ejecutar(() => treasuryCloudService.cerrarCaja(id, conteo, motivo)),
    guardarCuentaBancaria: (input) => ejecutar(() => treasuryCloudService.guardarCuentaBancaria(input)),
    importarExtracto: (input) => ejecutar(() => treasuryCloudService.importarExtracto(input)),
    conciliar: (input) => ejecutar(() => treasuryCloudService.conciliar(input)),
    revertirConciliacion: (id, motivo) => ejecutar(() => treasuryCloudService.revertirConciliacion(id, motivo)),
    guardarGasto: (input) => ejecutar(() => treasuryCloudService.guardarGasto(input)),
    pagarGasto: (id, fecha, metodo) => ejecutar(() => treasuryCloudService.pagarGasto(id, fecha, metodo)),
    anularGasto: (id, motivo) => ejecutar(() => treasuryCloudService.anularGasto(id, motivo)),
    guardarBono: (input) => ejecutar(() => treasuryCloudService.guardarBono(input)),
    liquidarBono: (input) => ejecutar(() => treasuryCloudService.liquidarBono(input)),
    guardarParametros: (input) => ejecutar(() => treasuryCloudService.guardarParametrosProyeccion(input)),
    subirDocumentoGasto: (input) => ejecutar(() => treasuryCloudService.subirDocumentoGasto(input)),
    descargarDocumentoGasto: (id) => treasuryCloudService.descargarDocumentoGasto(id)
  }), [ejecutar])

  const snapshotVisible = snapshot?.clinicaId === clinicaId && snapshot.rol === rol ? snapshot : null
  return { snapshot: snapshotVisible, loading, error, online, refrescar, acciones }
}
