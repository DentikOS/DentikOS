import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  presupuestosStorageService,
  type PresupuestoLocal
} from '../services/presupuestosStorageService'
import {
  calcularResumenPresupuestos,
  type ResumenPresupuestos
} from '../utils/presupuestosCalculations'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface UsePresupuestosReturn {
  presupuestos: PresupuestoLocal[]
  resumen: ResumenPresupuestos
  modalNuevoAbierto: boolean
  setModalNuevoAbierto: React.Dispatch<React.SetStateAction<boolean>>
  presupuestoImprimir: PresupuestoLocal | null
  setPresupuestoImprimir: React.Dispatch<
    React.SetStateAction<PresupuestoLocal | null>
  >
  estadoFiltro: string
  setEstadoFiltro: React.Dispatch<React.SetStateAction<string>>
  busqueda: string
  setBusqueda: React.Dispatch<React.SetStateAction<string>>
  agregarPresupuesto: (nuevoPresupuesto: PresupuestoLocal) => Promise<boolean>
  cambiarEstadoPresupuesto: (
    presupuestoId: string | number,
    nuevoEstado: string
  ) => Promise<boolean>
  archivarPresupuesto: (presupuestoId: string | number) => Promise<void>
}

export const usePresupuestos = (
  pacientes: (Paciente | { id: string | number; [key: string]: unknown })[] = [],
  _prestaciones: unknown[] = []
): UsePresupuestosReturn => {
  const { confirm } = useAppDialog()
  const [presupuestos, setPresupuestos] = useState<PresupuestoLocal[]>([])
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState<boolean>(false)
  const [presupuestoImprimir, setPresupuestoImprimir] =
    useState<PresupuestoLocal | null>(null)
  const [estadoFiltro, setEstadoFiltro] = useState<string>('Todos')
  const [busqueda, setBusqueda] = useState<string>('')

  const cargarPresupuestos = useCallback(() => {
    // Solo presupuestos formales (creados manualmente desde PresupuestosModulo).
    // Los consolidados virtuales (PRES-PAC-*) quedan solo en la Ficha Clínica
    // del paciente, no aparecen en este módulo para evitar confusión
    // (su estado se calcula desde items del plan, no desde presupuestos formales).
    const creadosDirectos = presupuestosStorageService.obtenerPresupuestos([])
    setPresupuestos(creadosDirectos)
  }, [pacientes])

  useEffect(() => {
    cargarPresupuestos()
    window.addEventListener('storage', cargarPresupuestos)
    window.addEventListener('presupuestos_actualizados', cargarPresupuestos)
    return () => {
      window.removeEventListener('storage', cargarPresupuestos)
      window.removeEventListener('presupuestos_actualizados', cargarPresupuestos)
    }
  }, [cargarPresupuestos])

  const agregarPresupuesto = useCallback(
    async (nuevoPresupuesto: PresupuestoLocal) => {
      const guardado = await presupuestosStorageService.guardarPresupuesto(nuevoPresupuesto)
      if (!guardado) return false
      cargarPresupuestos()
      return true
    },
    [cargarPresupuestos]
  )

  const cambiarEstadoPresupuesto = useCallback(
    async (presupuestoId: string | number, nuevoEstado: string) => {
      const actualizado = await presupuestosStorageService.actualizarEstadoPresupuesto(
        presupuestoId,
        nuevoEstado
      )
      if (actualizado) cargarPresupuestos()
      return actualizado
    },
    [cargarPresupuestos]
  )

  const archivarPresupuesto = useCallback(
    async (presupuestoId: string | number) => {
      const ok = await confirm({
        title: 'Archivar presupuesto',
        description: 'El presupuesto permanecerá en el historial de la clínica.',
        variant: 'warning',
        confirmText: 'Archivar'
      })
      if (ok) {
        if (await presupuestosStorageService.archivarPresupuesto(presupuestoId)) cargarPresupuestos()
      }
    },
    [cargarPresupuestos, confirm]
  )

  const resumen = useMemo(
    () => calcularResumenPresupuestos(presupuestos),
    [presupuestos]
  )

  const presupuestosFiltrados = useMemo(() => {
    return presupuestos.filter(p => {
      const coincideEstado =
        estadoFiltro === 'Todos' ? p.estado !== 'archivado' :
        estadoFiltro === 'Archivados' ? p.estado === 'archivado' : p.estado === estadoFiltro
      const texto = busqueda.trim().toLowerCase()
      const coincideBusqueda =
        !texto ||
        p.folio?.toLowerCase().includes(texto) ||
        p.pacienteNombre?.toLowerCase().includes(texto) ||
        p.pacienteRut?.toLowerCase().includes(texto)
      return coincideEstado && coincideBusqueda
    })
  }, [presupuestos, estadoFiltro, busqueda])

  return {
    presupuestos: presupuestosFiltrados,
    resumen,
    modalNuevoAbierto,
    setModalNuevoAbierto,
    presupuestoImprimir,
    setPresupuestoImprimir,
    estadoFiltro,
    setEstadoFiltro,
    busqueda,
    setBusqueda,
    agregarPresupuesto,
    cambiarEstadoPresupuesto,
    archivarPresupuesto
  }
}
