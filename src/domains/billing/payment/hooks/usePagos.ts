import { useState, useMemo, useCallback, useEffect } from 'react'
import type React from 'react'
import { PAGOS_DEFAULT } from '../constants/pagosConstants'
import { pagosStorageService, type Pago } from '../services/pagosStorageService'
import { sincronizarAbonoConFichaPaciente, removerAbonoDeFichaPaciente, type NuevoPagoAbono } from '../services/pagosAbonosLegacyService'
import { exportarAuditoriaPagosXLSX } from '../services/pagosExportService'
import { calcularResumenRecaudacion, type ResumenRecaudacion } from '../utils/pagosCalculations'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'

export type { Pago, ResumenRecaudacion }

export interface UsePagosReturn {
  pagos: Pago[]
  todosLosPagos: Pago[]
  resumen: ResumenRecaudacion
  busqueda: string
  setBusqueda: React.Dispatch<React.SetStateAction<string>>
  metodoFiltro: string
  setMetodoFiltro: React.Dispatch<React.SetStateAction<string>>
  estadoFiltro: string
  setEstadoFiltro: React.Dispatch<React.SetStateAction<string>>
  mostrarPurgados: boolean
  setMostrarPurgados: React.Dispatch<React.SetStateAction<boolean>>
  agregarOActualizarPago: (pagoData: Pago) => boolean | void | Promise<boolean>
  anularPago: (idPago: string | number, motivoAnulacion?: string) => Promise<void>
  purgarPago: (idPago: string | number, motivo: string) => Promise<boolean>
  exportarAuditoria: () => Promise<void>
  refrescarPagos: () => void
}

export const usePagos = (): UsePagosReturn => {
  const { confirm, alert } = useAppDialog()
  const userProfile = useSesionStore((state) => state.userProfile)
  const [pagos, setPagos] = useState<Pago[]>(() => 
    pagosStorageService.obtenerPagos(PAGOS_DEFAULT as unknown as Pago[])
  )

  const [busqueda, setBusqueda] = useState<string>('')
  const [metodoFiltro, setMetodoFiltro] = useState<string>('Todos')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('Todos')
  const [mostrarPurgados, setMostrarPurgados] = useState<boolean>(false)

  const resumen = useMemo(() => calcularResumenRecaudacion(pagos), [pagos])

  const pagosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return pagos.filter(p => {
      const coincideMetodo = metodoFiltro === 'Todos' || p.metodoPago === metodoFiltro
      const coincideEstado = estadoFiltro === 'Todos' ? (p.estado !== 'Purgado' || mostrarPurgados) : p.estado === estadoFiltro
      const coincideBusqueda = !q ||
        (p.folioComprobante || '').toLowerCase().includes(q) ||
        (p.folioDTE || '').toLowerCase().includes(q) ||
        (p.pacienteNombre || '').toLowerCase().includes(q) ||
        (p.pacienteRut || '').toLowerCase().includes(q)
      return coincideMetodo && coincideEstado && coincideBusqueda
    })
  }, [pagos, busqueda, metodoFiltro, estadoFiltro, mostrarPurgados])

  const agregarOActualizarPago = useCallback((pagoData: Pago): boolean | void | Promise<boolean> => {
    if (!pagoData?.folioComprobante || !pagoData?.pacienteNombre) {
      alert({ title: 'Pago inválido', description: 'El pago requiere folio y paciente.', variant: 'error' })
      return false
    }
    const metodoPago = String(pagoData.metodoPago || pagoData.metodo_pago || '').trim().toLowerCase()
    if (metodoPago === 'efectivo' || metodoPago === 'cash') {
      return (async () => {
        try {
          const confirmado = await pagosStorageService.registrarPago(pagoData)
          if (!confirmado?.sincronizado) {
            await alert({
              title: 'Efectivo no confirmado',
              description: 'El servidor no confirmó el pago. Verifica la conexión y que la caja de esta clínica y moneda esté abierta.',
              variant: 'error'
            })
            return false
          }
          setPagos((prev) => {
            const existe = prev.some((p) => String(p.id) === String(confirmado.id)
              || String(p.id) === String(pagoData.id))
            return existe
              ? prev.map((p) => String(p.id) === String(confirmado.id) || String(p.id) === String(pagoData.id)
                ? { ...p, ...confirmado } : p)
              : [confirmado, ...prev]
          })
          if (confirmado.pacienteId) {
            sincronizarAbonoConFichaPaciente(confirmado.pacienteId, confirmado as unknown as NuevoPagoAbono)
          }
          return true
        } catch {
          await alert({
            title: 'Efectivo no confirmado',
            description: 'El servidor no confirmó el pago. Verifica la conexión y que la caja de esta clínica y moneda esté abierta.',
            variant: 'error'
          })
          return false
        }
      })()
    }
    setPagos(prev => {
      const existe = prev.some(p => String(p.id) === String(pagoData.id))
      const actualizados = existe
        ? prev.map(p => String(p.id) === String(pagoData.id) ? { ...p, ...pagoData } : p)
        : [pagoData, ...prev]
      pagosStorageService.guardarPagos(actualizados)
      if (typeof pagosStorageService.registrarPago === 'function') {
        pagosStorageService.registrarPago(pagoData).catch(() => {})
      }
      if (pagoData.pacienteId) {
        sincronizarAbonoConFichaPaciente(pagoData.pacienteId, pagoData as unknown as NuevoPagoAbono)
      }
      return actualizados
    })
  }, [alert])

  const anularPago = useCallback(async (idPago: string | number, motivoAnulacion?: string): Promise<void> => {
    const ok = await confirm({
      title: 'Anular comprobante de pago',
      description: '¿Estás seguro de anular este comprobante de pago? El registro quedará guardado en auditoría.',
      variant: 'danger',
      confirmText: 'Anular'
    })
    if (ok) {
      setPagos(prev => {
        const actualizados = prev.map(p => {
          if (String(p.id) === String(idPago)) {
            // Propagar anulación al Plan de Tratamiento (Commit C)
            if (p.pacienteId) {
              removerAbonoDeFichaPaciente(p.pacienteId, p.id)
            }
            return {
              ...p,
              estado: 'Anulado',
              motivoAnulacion: motivoAnulacion || 'Anulado por usuario',
              fechaAnulacion: new Date().toLocaleDateString('es-CL')
            }
          }
          return p
        })
        pagosStorageService.guardarPagos(actualizados)
        return actualizados
      })
    }
  }, [confirm])

  const purgarPago = useCallback(async (idPago: string | number, motivo: string): Promise<boolean> => {
    if (!motivo || motivo.trim().length < 10) {
      await alert({ title: 'Motivo inválido', description: 'El motivo debe tener al menos 10 caracteres.', variant: 'warning', confirmText: 'Entendido' })
      return false
    }
    // Obtener el pago antes de purgar para conocer pacienteId
    const pagoAPurgar = pagos.find(p => String(p.id) === String(idPago))
    const ok = pagosStorageService.purgarPago(idPago, motivo, userProfile?.email || 'desconocido')
    if (ok) {
      // Propagar purga al Plan de Tratamiento (Commit C)
      if (pagoAPurgar?.pacienteId) {
        removerAbonoDeFichaPaciente(pagoAPurgar.pacienteId, idPago)
      }
      setPagos([...pagosStorageService.obtenerPagos([])])
      await alert({
        title: 'Pago purgado',
        description: 'El pago fue eliminado definitivamente del sistema. La acción quedó registrada en auditoría.',
        variant: 'success',
        confirmText: 'Entendido'
      })
      return true
    }
    await alert({
      title: 'Error al purgar',
      description: 'No se encontró el pago en el sistema.',
      variant: 'error',
      confirmText: 'Entendido'
    })
    return false
  }, [alert, userProfile, pagos])

  const exportarAuditoria = useCallback(async (): Promise<void> => {
    const todos = pagosStorageService.obtenerPagosParaAuditoria()
    const resultado = await exportarAuditoriaPagosXLSX(todos)
    if (resultado.ok) {
      await alert({ title: 'Auditoría exportada', description: `Se exportaron ${resultado.total} pagos (vigentes, anulados y purgados) a ${resultado.nombreArchivo}.`, variant: 'success', confirmText: 'Entendido' })
    } else {
      await alert({ title: 'Error al exportar', description: 'No se pudo generar el archivo.', variant: 'error', confirmText: 'Entendido' })
    }
  }, [alert])

  const refrescarPagos = useCallback((): void => {
    const nuevos = pagosStorageService.obtenerPagos([]).map(p => ({ ...p }))
    setPagos(nuevos)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const actualizarDesdeSupabase = (): void => {
      void pagosStorageService.sincronizarDesdeSupabase().then(() => {
        setPagos(pagosStorageService.obtenerPagos([]).map(p => ({ ...p })))
      }).catch(() => {
        setPagos(pagosStorageService.obtenerPagos([]).map(p => ({ ...p })))
      })
    }
    window.addEventListener(REALTIME_EVENTS.PAGOS_CHANGED, actualizarDesdeSupabase)
    return () => window.removeEventListener(REALTIME_EVENTS.PAGOS_CHANGED, actualizarDesdeSupabase)
  }, [])

  return {
    pagos: pagosFiltrados,
    todosLosPagos: pagos,
    resumen,
    busqueda,
    setBusqueda,
    metodoFiltro,
    setMetodoFiltro,
    estadoFiltro,
    setEstadoFiltro,
    mostrarPurgados,
    setMostrarPurgados,
    agregarOActualizarPago,
    anularPago,
    purgarPago,
    exportarAuditoria,
    refrescarPagos,
  }
}
