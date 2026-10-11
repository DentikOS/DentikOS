import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ARANCEL_DEFAULT,
  PAQUETES_CLINICOS_DEFAULT
} from '../constants/prestacionesConstants'
import {
  prestacionesStorageService,
  type Prestacion,
  type PaqueteClinico
} from '../services/prestacionesStorageService'
import {
  calcularResumenArancel,
  type ResumenArancel
} from '../utils/prestacionesCalculations'
import { useEliminarPrestaciones } from './useEliminarPrestaciones'

export interface PrestacionInput {
  id?: number | string
  nombre: string
  especialidad?: string
  precio?: number | string
  precioParticular?: number | string
  precioFonasa?: number | string
  codigoFonasa?: string
  [key: string]: unknown
}

export interface PaqueteInput {
  id?: number | string
  nombre: string
  descripcion?: string
  precioCombo?: number | string
  ahorroEstimado?: string
  [key: string]: unknown
}

export interface UsePrestacionesReturn {
  prestaciones: Prestacion[]
  paquetes: PaqueteClinico[]
  resumen: ResumenArancel
  busqueda: string
  setBusqueda: React.Dispatch<React.SetStateAction<string>>
  especialidadFiltro: string
  setEspecialidadFiltro: React.Dispatch<React.SetStateAction<string>>
  agregarOActualizarPrestacion: (prestacionData: PrestacionInput) => void
  eliminarPrestacion: (id: number | string) => Promise<void>
  aplicarReajusteMasivo: (porcentaje: number | string) => void
  agregarPaquete: (nuevoPack: PaqueteInput) => void
  eliminarPaquete: (id: number | string) => Promise<void>
}

export const usePrestaciones = (
  prestacionesProp?: Prestacion[] | null,
  setPrestacionesProp?: ((prestaciones: Prestacion[]) => void) | null
): UsePrestacionesReturn => {
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>(() => {
    const guardadas = prestacionesStorageService.obtenerPrestaciones(
      ARANCEL_DEFAULT as unknown as Prestacion[]
    )
    const base = guardadas && guardadas.length > 0 ? guardadas : (ARANCEL_DEFAULT as unknown as Prestacion[])
    return base.map(p => ({
      ...p,
      precio: parseFloat(String(p.precio ?? p.precioParticular)) || 0,
      precioParticular: parseFloat(String(p.precioParticular ?? p.precio)) || 0
    }))
  })

  const [paquetes, setPaquetes] = useState<PaqueteClinico[]>(() => {
    const guardados = prestacionesStorageService.obtenerPaquetes(
      [...PAQUETES_CLINICOS_DEFAULT] as unknown as PaqueteClinico[]
    )
    return guardados && guardados.length > 0
      ? guardados
      : ([...PAQUETES_CLINICOS_DEFAULT] as unknown as PaqueteClinico[])
  })

  const [busqueda, setBusqueda] = useState<string>('')
  const [especialidadFiltro, setEspecialidadFiltro] = useState<string>('Todas')

  // Sincronizador global reactivo
  const guardarYSincronizarGlobal = useCallback(
    (nuevasPrestaciones: Prestacion[]) => {
      const normalizadas = nuevasPrestaciones.map(p => ({
        ...p,
        precio: parseFloat(String(p.precio ?? p.precioParticular)) || 0,
        precioParticular: parseFloat(String(p.precioParticular ?? p.precio)) || 0
      }))

      setPrestaciones(normalizadas)
      prestacionesStorageService.guardarPrestaciones(normalizadas)

      if (setPrestacionesProp) {
        setPrestacionesProp(normalizadas)
      }

      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(
        new CustomEvent('arancel_actualizado', { detail: normalizadas })
      )
    },
    [setPrestacionesProp]
  )

  useEffect(() => {
    if (prestacionesProp && prestacionesProp.length > 0) {
      setPrestaciones(
        prestacionesProp.map(p => ({
          ...p,
          precio: parseFloat(String(p.precio ?? p.precioParticular)) || 0,
          precioParticular: parseFloat(String(p.precioParticular ?? p.precio)) || 0
        }))
      )
    }
  }, [prestacionesProp])

  const resumen = useMemo(
    () => calcularResumenArancel(prestaciones),
    [prestaciones]
  )

  const prestacionesFiltradas = useMemo(() => {
    return prestaciones.filter(p => {
      const coincideEsp =
        especialidadFiltro === 'Todas' || p.especialidad === especialidadFiltro
      const coincideBusqueda =
        !busqueda.trim() ||
        (p.nombre && p.nombre.toLowerCase().includes(busqueda.toLowerCase())) ||
        (p.codigoFonasa &&
          p.codigoFonasa.toLowerCase().includes(busqueda.toLowerCase()))
      return coincideEsp && coincideBusqueda
    })
  }, [prestaciones, busqueda, especialidadFiltro])

  const agregarOActualizarPrestacion = useCallback(
    (prestacionData: PrestacionInput) => {
      let actualizadas: Prestacion[] = []
      const existe = prestaciones.some(
        p => String(p.id) === String(prestacionData.id)
      )

      const valPrecio =
        parseFloat(String(prestacionData.precioParticular ?? prestacionData.precio)) || 0

      const prestacionNormalizada: Prestacion = {
        id: prestacionData.id || Date.now(),
        nombre: prestacionData.nombre,
        especialidad: prestacionData.especialidad || 'General',
        precio: valPrecio,
        precioParticular: valPrecio,
        precioFonasa: parseFloat(String(prestacionData.precioFonasa)) || 0,
        codigoFonasa: prestacionData.codigoFonasa || ''
      }

      if (existe) {
        actualizadas = prestaciones.map(p =>
          String(p.id) === String(prestacionData.id) ? prestacionNormalizada : p
        )
      } else {
        actualizadas = [prestacionNormalizada, ...prestaciones]
      }

      guardarYSincronizarGlobal(actualizadas)
    },
    [prestaciones, guardarYSincronizarGlobal]
  )

  const aplicarReajusteMasivo = useCallback(
    (porcentaje: number | string) => {
      const factor = 1 + (parseFloat(String(porcentaje)) || 0) / 100
      const actualizadas: Prestacion[] = prestaciones.map(p => {
        const pParticular = Math.round(
          (parseFloat(String(p.precioParticular ?? p.precio)) || 0) * factor
        )
        return {
          ...p,
          precio: pParticular,
          precioParticular: pParticular,
          precioFonasa: Math.round((parseFloat(String(p.precioFonasa)) || 0) * factor)
        }
      })
      guardarYSincronizarGlobal(actualizadas)
    },
    [prestaciones, guardarYSincronizarGlobal]
  )

  // Crear o Editar Paquetes Promocionales
  const agregarOEditarPaquete = useCallback(
    (nuevoPack: PaqueteInput) => {
      const valPrecio =
        typeof nuevoPack.precioCombo === 'number'
          ? nuevoPack.precioCombo
          : parseFloat(String(nuevoPack.precioCombo).replace(/[^0-9]/g, '')) || 0

      const packId = nuevoPack.id || Date.now()
      const nombreLimpio = nuevoPack.nombre

      const packNormalizado: Prestacion & PaqueteClinico = {
        id: packId,
        nombre: nombreLimpio,
        especialidad: 'Pack Promocional',
        precio: valPrecio,
        precioParticular: valPrecio,
        precioFonasa: valPrecio,
        codigoFonasa: '',
        precioCombo: valPrecio,
        descripcion: nuevoPack.descripcion,
        ahorroEstimado: nuevoPack.ahorroEstimado
      }

      setPaquetes(prev => {
        const existe = prev.some(p => String(p.id) === String(packId))
        const actualizados = existe
          ? prev.map(p => (String(p.id) === String(packId) ? packNormalizado : p))
          : [packNormalizado, ...prev]
        prestacionesStorageService.guardarPaquetes(actualizados)
        return actualizados
      })

      // Sincronizar en el catálogo de arancel general para Plan de Tratamiento
      const existeEnArancel = prestaciones.some(p => String(p.id) === String(packId))
      const actualizadasArancel = existeEnArancel
        ? prestaciones.map(p =>
            String(p.id) === String(packId) ? packNormalizado : p
          )
        : [packNormalizado, ...prestaciones]

      guardarYSincronizarGlobal(actualizadasArancel)
    },
    [prestaciones, guardarYSincronizarGlobal]
  )

  const { eliminarPrestacion, eliminarPaquete } = useEliminarPrestaciones({
    prestaciones,
    guardarYSincronizarGlobal,
    setPaquetes
  })

  return {
    prestaciones: prestacionesFiltradas,
    paquetes,
    resumen,
    busqueda,
    setBusqueda,
    especialidadFiltro,
    setEspecialidadFiltro,
    agregarOActualizarPrestacion,
    eliminarPrestacion,
    aplicarReajusteMasivo,
    agregarPaquete: agregarOEditarPaquete,
    eliminarPaquete
  }
}
