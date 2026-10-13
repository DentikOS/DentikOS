import { useState, useMemo, useCallback } from 'react'
import {
  PLANTILLAS_DEFAULT,
  MENSAJES_HISTORIAL_DEFAULT,
  type PlantillaComunicacion,
  type MensajeHistorial
} from '../constants/comunicacionesConstants'
import { comunicacionesStorageService } from '../services/comunicacionesStorageService'
import {
  calcularResumenComunicaciones,
  type ResumenComunicaciones
} from '../utils/comunicacionesCalculations'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'

export interface PlantillaInput {
  id?: number | string
  nombre: string
  canal: string
  asunto: string
  cuerpo: string
  [key: string]: unknown
}

export interface RegistroEnvioInput {
  id?: number | string
  pacienteId?: number | string
  pacienteNombre?: string
  pacienteTelefono?: string
  pacienteEmail?: string
  canal?: string
  plantillaNombre?: string
  mensajeEnviado?: string
  fechaEnvio?: string
  horaEnvio?: string
  estado?: string
  notaBitacora?: string
  [key: string]: unknown
}

export interface UseComunicacionesReturn {
  plantillas: PlantillaComunicacion[]
  historial: MensajeHistorial[]
  resumen: ResumenComunicaciones
  busqueda: string
  setBusqueda: React.Dispatch<React.SetStateAction<string>>
  canalFiltro: string
  setCanalFiltro: React.Dispatch<React.SetStateAction<string>>
  estadoFiltro: string
  setEstadoFiltro: React.Dispatch<React.SetStateAction<string>>
  registrarOActualizarEnvio: (
    registroData: MensajeHistorial | RegistroEnvioInput
  ) => void
  cambiarEstadoConfirmacion: (
    idRegistro: number | string,
    nuevoEstado: string
  ) => void
  eliminarRegistroBitacora: (idRegistro: number | string) => Promise<void>
  agregarOEditarPlantilla: (
    plantillaData: PlantillaInput | PlantillaComunicacion
  ) => void
  eliminarPlantilla: (idPlantilla: number | string) => Promise<void>
}

export const useComunicaciones = (): UseComunicacionesReturn => {
  const { confirm } = useAppDialog()
  const [plantillas, setPlantillas] = useState<PlantillaComunicacion[]>(() =>
    comunicacionesStorageService.obtenerPlantillas([...PLANTILLAS_DEFAULT])
  )

  const [historial, setHistorial] = useState<MensajeHistorial[]>(() =>
    comunicacionesStorageService.obtenerHistorial([...MENSAJES_HISTORIAL_DEFAULT])
  )

  const [busqueda, setBusqueda] = useState<string>('')
  const [canalFiltro, setCanalFiltro] = useState<string>('Todos')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('Todos')

  const resumen = useMemo(
    () => calcularResumenComunicaciones(historial),
    [historial]
  )

  const historialFiltrado = useMemo(() => {
    return historial.filter(m => {
      const coincideCanal = canalFiltro === 'Todos' || m.canal === canalFiltro
      const coincideEstado = estadoFiltro === 'Todos' || m.estado === estadoFiltro
      const coincideBusqueda =
        !busqueda.trim() ||
        (m.pacienteNombre &&
          m.pacienteNombre.toLowerCase().includes(busqueda.toLowerCase())) ||
        (m.mensajeEnviado &&
          m.mensajeEnviado.toLowerCase().includes(busqueda.toLowerCase()))
      return coincideCanal && coincideEstado && coincideBusqueda
    })
  }, [historial, busqueda, canalFiltro, estadoFiltro])

  // Registrar o Modificar entrada en la Bitácora
  const registrarOActualizarEnvio = useCallback(
    (registroData: MensajeHistorial | RegistroEnvioInput) => {
      setHistorial(prev => {
        let actualizados: MensajeHistorial[] = []
        const existe = prev.some(m => String(m.id) === String(registroData.id))

        if (existe) {
          actualizados = prev.map(m =>
            String(m.id) === String(registroData.id)
              ? ({ ...m, ...registroData } as MensajeHistorial)
              : m
          )
        } else {
          actualizados = [registroData as MensajeHistorial, ...prev]
        }

        comunicacionesStorageService.guardarHistorial(actualizados)
        return actualizados
      })
    },
    []
  )

  // Modificación rápida de estado de confirmación
  const cambiarEstadoConfirmacion = useCallback(
    (idRegistro: number | string, nuevoEstado: string) => {
      setHistorial(prev => {
        const actualizados = prev.map(m =>
          String(m.id) === String(idRegistro) ? { ...m, estado: nuevoEstado } : m
        )
        comunicacionesStorageService.guardarHistorial(actualizados)
        return actualizados
      })
    },
    []
  )

  const eliminarRegistroBitacora = useCallback(
    async (idRegistro: number | string) => {
      const ok = await confirm({
        title: 'Eliminar entrada',
        description: '¿Estás seguro de eliminar esta entrada de la bitácora?',
        variant: 'danger',
        confirmText: 'Eliminar'
      })
      if (ok) {
        setHistorial(prev => {
          const actualizados = prev.filter(
            m => String(m.id) !== String(idRegistro)
          )
          comunicacionesStorageService.guardarHistorial(actualizados)
          return actualizados
        })
      }
    },
    [confirm]
  )

  const agregarOEditarPlantilla = useCallback(
    (plantillaData: PlantillaInput | PlantillaComunicacion) => {
      setPlantillas(prev => {
        let actualizadas: PlantillaComunicacion[] = []
        const existe = prev.some(p => String(p.id) === String(plantillaData.id))

        if (existe) {
          actualizadas = prev.map(p =>
            String(p.id) === String(plantillaData.id)
              ? (plantillaData as PlantillaComunicacion)
              : p
          )
        } else {
          const nueva: PlantillaComunicacion = {
            id: plantillaData.id ?? Date.now(),
            nombre: plantillaData.nombre,
            canal: plantillaData.canal,
            asunto: plantillaData.asunto,
            cuerpo: plantillaData.cuerpo
          }
          actualizadas = [nueva, ...prev]
        }

        comunicacionesStorageService.guardarPlantillas(actualizadas)
        return actualizadas
      })
    },
    []
  )

  const eliminarPlantilla = useCallback(
    async (idPlantilla: number | string) => {
      const ok = await confirm({
        title: 'Eliminar plantilla',
        description: '¿Deseas eliminar esta plantilla de mensajes?',
        variant: 'danger',
        confirmText: 'Eliminar'
      })
      if (ok) {
        setPlantillas(prev => {
          const actualizadas = prev.filter(
            p => String(p.id) !== String(idPlantilla)
          )
          comunicacionesStorageService.guardarPlantillas(actualizadas)
          return actualizadas
        })
      }
    },
    [confirm]
  )

  return {
    plantillas,
    historial: historialFiltrado,
    resumen,
    busqueda,
    setBusqueda,
    canalFiltro,
    setCanalFiltro,
    estadoFiltro,
    setEstadoFiltro,
    registrarOActualizarEnvio,
    cambiarEstadoConfirmacion,
    eliminarRegistroBitacora,
    agregarOEditarPlantilla,
    eliminarPlantilla
  }
}
