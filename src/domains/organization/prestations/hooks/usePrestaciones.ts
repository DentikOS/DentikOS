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
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { prestacionesSupabaseService } from '../services/prestacionesSupabaseService'

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
  agregarOActualizarPrestacion: (prestacionData: PrestacionInput) => Promise<void>
  eliminarPrestacion: (id: number | string) => Promise<void>
  aplicarReajusteMasivo: (porcentaje: number | string) => Promise<void>
  agregarPaquete: (nuevoPack: PaqueteInput) => Promise<void>
  eliminarPaquete: (id: number | string) => Promise<void>
}

export const usePrestaciones = (
  prestacionesProp?: Prestacion[] | null,
  setPrestacionesProp?: ((prestaciones: Prestacion[]) => void) | null
): UsePrestacionesReturn => {
  const clinicaActiva = USE_SUPABASE ? getClinicaActivaSync() : null
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>(() => {
    if (USE_SUPABASE) return []
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
      USE_SUPABASE ? [] : [...PAQUETES_CLINICOS_DEFAULT] as unknown as PaqueteClinico[]
    )
    return guardados && guardados.length > 0
      ? guardados
      : (USE_SUPABASE ? [] : [...PAQUETES_CLINICOS_DEFAULT] as unknown as PaqueteClinico[])
  })
  const [paquetesClinicaCache, setPaquetesClinicaCache] = useState(clinicaActiva)

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
      if (!USE_SUPABASE) prestacionesStorageService.guardarPrestaciones(normalizadas)

      if (setPrestacionesProp) {
        setPrestacionesProp(normalizadas)
      }

      if (!USE_SUPABASE) {
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new CustomEvent('arancel_actualizado', { detail: normalizadas }))
      }
    },
    [setPrestacionesProp]
  )

  useEffect(() => {
    if (prestacionesProp) {
      setPrestaciones(
        prestacionesProp.map(p => ({
          ...p,
          precio: parseFloat(String(p.precio ?? p.precioParticular)) || 0,
          precioParticular: parseFloat(String(p.precioParticular ?? p.precio)) || 0
        }))
      )
    }
  }, [prestacionesProp])

  useEffect(() => {
    if (!USE_SUPABASE || paquetesClinicaCache === clinicaActiva) return
    setPaquetes(prestacionesStorageService.obtenerPaquetes(undefined) ?? [])
    setPaquetesClinicaCache(clinicaActiva)
  }, [clinicaActiva, paquetesClinicaCache])

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

  const paquetesVisibles = useMemo(() => {
    if (!USE_SUPABASE) return paquetes
    const locales = paquetesClinicaCache === clinicaActiva ? paquetes : []
    const remotos = prestaciones.filter(p => p.especialidad === 'Pack Promocional')
    const mismoPack = (local: PaqueteClinico, remoto: Prestacion): boolean =>
      String(local.id) === String(remoto.id) || (
        local.nombre.trim().toLowerCase() === remoto.nombre.trim().toLowerCase() &&
        Number(local.precioCombo ?? local.precio ?? local.precioParticular ?? 0) === remoto.precioParticular
      )
    const visibles = remotos.map((remoto) => {
      const local = locales.find(p => mismoPack(p, remoto))
      const descripcionRemota = typeof remoto.descripcion === 'string' ? remoto.descripcion.trim() : ''
      const ahorroRemoto = typeof remoto.ahorroEstimado === 'string' ? remoto.ahorroEstimado.trim() : ''
      const descripcionLocal = local?.descripcion?.trim() ?? ''
      const ahorroLocal = local?.ahorroEstimado?.trim() ?? ''
      const metadataPendiente = (!descripcionRemota && Boolean(descripcionLocal)) ||
        (!ahorroRemoto && Boolean(ahorroLocal))
      return {
        ...remoto,
        descripcion: descripcionRemota || descripcionLocal || undefined,
        ahorroEstimado: ahorroRemoto || ahorroLocal || undefined,
        ...(metadataPendiente ? { pendienteCompartir: true } : {}),
      }
    })
    const localesNoCompartidos = locales
      .filter(local => !remotos.some(remoto => mismoPack(local, remoto)))
      .map(local => ({ ...local, pendienteCompartir: true }))
    return [...visibles, ...localesNoCompartidos] as PaqueteClinico[]
  }, [prestaciones, paquetes, paquetesClinicaCache, clinicaActiva])

  const agregarOActualizarPrestacion = useCallback(
    async (prestacionData: PrestacionInput) => {
      let actualizadas: Prestacion[] = []
      const existente = prestaciones.find(p => String(p.id) === String(prestacionData.id))
      const existe = Boolean(existente)

      const valPrecio =
        parseFloat(String(prestacionData.precioParticular ?? prestacionData.precio)) || 0

      const prestacionNormalizada: Prestacion = {
        ...(existente ?? {}),
        id: prestacionData.id || Date.now(),
        nombre: prestacionData.nombre,
        especialidad: prestacionData.especialidad || 'General',
        precio: valPrecio,
        precioParticular: valPrecio,
        precioFonasa: parseFloat(String(prestacionData.precioFonasa)) || 0,
        codigoFonasa: prestacionData.codigoFonasa || '',
        equipamientoRequerido: Array.isArray(prestacionData.equipamientoRequerido)
          ? prestacionData.equipamientoRequerido as Prestacion['equipamientoRequerido']
          : existente?.equipamientoRequerido ?? [],
        ...(existente?.especialidad === 'Pack Promocional' ? { precioCombo: valPrecio } : {}),
      }

      if (existe) {
        actualizadas = prestaciones.map(p =>
          String(p.id) === String(prestacionData.id) ? prestacionNormalizada : p
        )
      } else {
        actualizadas = [prestacionNormalizada, ...prestaciones]
      }

      if (USE_SUPABASE) {
        const guardada = await prestacionesSupabaseService.guardar(prestacionNormalizada)
        actualizadas = existe
          ? prestaciones.map(p => String(p.id) === String(prestacionData.id) ? guardada : p)
          : [guardada, ...prestaciones]
      }
      if (!USE_SUPABASE && existente?.especialidad === 'Pack Promocional') {
        setPaquetes(prev => {
          const actualizados = prev.map(p => String(p.id) === String(existente.id)
            ? { ...p, ...prestacionNormalizada, precioCombo: valPrecio } : p)
          if (!USE_SUPABASE) prestacionesStorageService.guardarPaquetes(actualizados)
          return actualizados
        })
      }
      guardarYSincronizarGlobal(actualizadas)
    },
    [prestaciones, guardarYSincronizarGlobal]
  )

  const aplicarReajusteMasivo = useCallback(
    async (porcentaje: number | string) => {
      const pct = typeof porcentaje === 'string' && !porcentaje.trim() ? NaN : Number(porcentaje)
      if (!Number.isFinite(pct) || pct < -100 || pct > 10000) {
        throw new Error('El porcentaje debe estar entre -100% y 10000%.')
      }
      if (USE_SUPABASE) {
        const confirmadas = await prestacionesSupabaseService.reajustarMasivo(pct, prestaciones)
        guardarYSincronizarGlobal(confirmadas)
        return
      }

      const factor = 1 + pct / 100
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
    async (nuevoPack: PaqueteInput) => {
      const valPrecio =
        typeof nuevoPack.precioCombo === 'number'
          ? nuevoPack.precioCombo
          : parseFloat(String(nuevoPack.precioCombo).replace(/[^0-9]/g, '')) || 0

      const packId = nuevoPack.id || Date.now()
      const nombreLimpio = nuevoPack.nombre

      let packNormalizado: Prestacion & PaqueteClinico = {
        id: packId,
        nombre: nombreLimpio,
        especialidad: 'Pack Promocional',
        precio: valPrecio,
        precioParticular: valPrecio,
        precioFonasa: valPrecio,
        codigoFonasa: '',
        equipamientoRequerido: [],
        precioCombo: valPrecio,
        descripcion: nuevoPack.descripcion,
        ahorroEstimado: nuevoPack.ahorroEstimado
      }

      if (USE_SUPABASE) {
        const guardada = await prestacionesSupabaseService.guardar(packNormalizado)
        packNormalizado = { ...packNormalizado, ...guardada }
      }

      setPaquetes(prev => {
        const existe = prev.some(p => String(p.id) === String(packId))
        const actualizados = existe
          ? prev.map(p => (String(p.id) === String(packId) ? packNormalizado : p))
          : [packNormalizado, ...prev]
        if (!USE_SUPABASE) prestacionesStorageService.guardarPaquetes(actualizados)
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
    paquetes: paquetesVisibles,
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
