import { useState, useMemo, useEffect, useCallback } from 'react'
import type React from 'react'
import { finanzasStorageService, type MovimientoFinanciero, type ConvenioConfig } from '../services/finanzasStorageService'
import { calcularBalanceFinanzas } from '../utils/finanzasCalculations'
import { CONVENIOS_DEFAULT } from '../constants/finanzasConstants'
import { pagosStorageService, type Pago } from "../../payment/services/pagosStorageService"
import { obtenerAbonosPorPaciente, eliminarAbono, type AbonoFicha } from "../../payment/services/pagosAbonosLegacyService"
import { createLogger } from '../../../../infrastructure/logging/logger'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'
import { type BalanceFinanzas } from '../utils/finanzasCalculations'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'

const log = createLogger('useFinanzas')

export type { MovimientoFinanciero, ConvenioConfig }

export interface BalanceFinanzasResult extends BalanceFinanzas {}

export interface UseFinanzasReturn {
  movimientos: MovimientoFinanciero[]
  transaccionesDiaArqueo: MovimientoFinanciero[]
  fechaArqueo: string
  setFechaArqueo: React.Dispatch<React.SetStateAction<string>>
  balanceGlobal: BalanceFinanzasResult
  agregarMovimiento: (movData: MovimientoFinanciero) => void
  eliminarMovimiento: (id: string | number) => Promise<void>
  recargarTransaccionesConsolidadas: () => void
  convenios: ConvenioConfig[]
  actualizarDescuentoConvenio: (convenioId: string | number, nuevoDescuento: string | number) => void
}

export const useFinanzas = (pacientes: Paciente[] = []): UseFinanzasReturn => {
  const { confirm } = useAppDialog()
  const [movimientosManuales, setMovimientosManuales] = useState<MovimientoFinanciero[]>(() =>
    finanzasStorageService.obtenerMovimientos([]) || []
  )
  const [convenios, setConvenios] = useState<ConvenioConfig[]>(() =>
    finanzasStorageService.obtenerConvenios([...CONVENIOS_DEFAULT])
  )
  const [fechaArqueo, setFechaArqueo] = useState<string>(
    new Date().toLocaleDateString('es-CL')
  )
  const [todosLosAbonosYPagos, setTodosLosAbonosYPagos] = useState<MovimientoFinanciero[]>([])

  const recargarTransaccionesConsolidadas = useCallback((): void => {
    const lista: MovimientoFinanciero[] = []
    const hoy = () => new Date().toLocaleDateString('es-CL')
    let pagos: Pago[] = []
    try {
      pagos = pagosStorageService.obtenerPagos([]) || []
    } catch (e) {
      log.error(e)
    }
    const idsPago = new Set(pagos.map(p => String(p.id)))
    // Pagos globales vigentes: los anulados quedan solo en auditoría de Pagos
    pagos.forEach(p => {
      if (p.estado === 'Anulado' || p.estado === 'Purgado') return
      const ventaInventario = typeof p.concepto === 'string' && p.concepto.startsWith('Venta de inventario ')
      lista.push({
        id: `pago_global_${p.id}`,
        fecha: p.fecha || hoy(),
        tipo: 'Ingreso',
        categoria: ventaInventario ? 'Venta de Inventario' : 'Pago Paciente (Boleta/Factura)',
        monto: parseInt(String(p.monto || 0), 10),
        moneda: p.moneda || 'CLP',
        metodoPago: p.metodoPago || 'Efectivo',
        pacienteNombre: p.pacienteNombre || (ventaInventario ? 'Venta de inventario' : 'Paciente General'),
        origen: 'Pagos'
      })
    })
    // Abonos de ficha que NO duplican un pago global (evita doble conteo)
    const idsAbonoVistos = new Set<string>()
    pacientes.forEach(pac => {
      let abonos: AbonoFicha[] = []
      try {
        abonos = obtenerAbonosPorPaciente(pac.id) || []
      } catch (e) {
        log.error(e)
      }
      abonos.forEach(a => {
        const aid = String(a.id)
        if (idsPago.has(aid) || idsAbonoVistos.has(aid)) return
        idsAbonoVistos.add(aid)
        lista.push({
          id: `abono_${pac.id}_${a.id}`,
          fecha: a.fecha || hoy(),
          tipo: 'Ingreso',
          categoria: 'Abono Plan de Tratamiento',
          monto: parseInt(String(a.monto || 0), 10),
          moneda: 'CLP',
          metodoPago: a.metodoPago || 'Efectivo',
          pacienteNombre: pac.nombre,
          origen: 'Presupuestos'
        })
      })
    })
    setTodosLosAbonosYPagos(lista)
  }, [pacientes])

  useEffect(() => {
    recargarTransaccionesConsolidadas()
    window.addEventListener('storage', recargarTransaccionesConsolidadas)
    return () => window.removeEventListener('storage', recargarTransaccionesConsolidadas)
  }, [recargarTransaccionesConsolidadas])

  useEffect(() => {
    const actualizarPagos = (): void => {
      void pagosStorageService.sincronizarDesdeSupabase().then(recargarTransaccionesConsolidadas).catch(recargarTransaccionesConsolidadas)
    }
    window.addEventListener(REALTIME_EVENTS.PAGOS_CHANGED, actualizarPagos)
    return () => window.removeEventListener(REALTIME_EVENTS.PAGOS_CHANGED, actualizarPagos)
  }, [recargarTransaccionesConsolidadas])

  const movimientosConsolidadosTotal = useMemo(() => {
    return [...movimientosManuales, ...todosLosAbonosYPagos]
  }, [movimientosManuales, todosLosAbonosYPagos])

  const transaccionesDiaArqueo = useMemo(() => {
    return movimientosConsolidadosTotal.filter(m => m.fecha === fechaArqueo)
  }, [movimientosConsolidadosTotal, fechaArqueo])

  const balanceGlobal = useMemo(() => {
    return calcularBalanceFinanzas(movimientosConsolidadosTotal) as BalanceFinanzasResult
  }, [movimientosConsolidadosTotal])

  const agregarMovimiento = useCallback((movData: MovimientoFinanciero): void => {
    setMovimientosManuales(prev => {
      const actualizados = [movData, ...prev]
      finanzasStorageService.guardarMovimientos(actualizados)
      return actualizados
    })
  }, [])

  const eliminarMovimiento = useCallback(async (id: string | number): Promise<void> => {
    const strId = String(id)
    const movimientoLaboratorio = movimientosManuales.find(m => String(m.id) === strId)
    if (movimientoLaboratorio?.ordenLaboratorioId || movimientoLaboratorio?.categoria === 'Laboratorio Dental') return
    const esPagoGlobal = strId.startsWith('pago_global_')
    const esAbono = strId.startsWith('abono_')
    const ok = await confirm({
      title: 'Eliminar movimiento',
      description: esPagoGlobal || esAbono
        ? 'Se eliminará el registro original en Pagos / Ficha Clínica. ¿Continuar?'
        : '¿Deseas eliminar este registro de movimiento de caja chica?',
      variant: 'danger',
      confirmText: 'Eliminar'
    })
    if (!ok) return
    if (esPagoGlobal) {
      pagosStorageService.eliminarPago(strId.replace('pago_global_', ''))
    } else if (esAbono) {
      const partes = strId.split('_')
      eliminarAbono(partes[1], partes.slice(2).join('_'))
    } else {
      setMovimientosManuales(prev => {
        const actualizados = prev.filter(m => String(m.id) !== strId)
        finanzasStorageService.guardarMovimientos(actualizados)
        return actualizados
      })
    }
    recargarTransaccionesConsolidadas()
  }, [confirm, movimientosManuales, recargarTransaccionesConsolidadas])

  const actualizarDescuentoConvenio = useCallback((convenioId: string | number, nuevoDescuento: string | number): void => {
    setConvenios(prev => {
      const actualizados = prev.map(c =>
        c.id === convenioId ? { ...c, descuentoDefecto: parseFloat(String(nuevoDescuento)) || 0 } : c
      )
      finanzasStorageService.guardarConvenios(actualizados)
      return actualizados
    })
  }, [])

  return {
    movimientos: movimientosConsolidadosTotal,
    transaccionesDiaArqueo,
    fechaArqueo,
    setFechaArqueo,
    balanceGlobal,
    agregarMovimiento,
    eliminarMovimiento,
    recargarTransaccionesConsolidadas,
    convenios,
    actualizarDescuentoConvenio
  }
}
